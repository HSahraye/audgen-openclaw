import { prisma } from "@/lib/prisma";
import { normalizeStage, type LeadStage } from "./stages";
import type { ReplyClassification } from "./replies";

/**
 * Next-best-action engine.
 *
 * Given a lead's current pipeline state, return the single recommended
 * next move with a reason. Used by the prep page, the daily brief, and
 * the eventual reply auto-suggestion UI.
 *
 * Inputs come from existing tables: Lead (stage, score, lastContactedAt,
 * nextFollowUpAt) and the Activity ledger (REPLY_LOGGED + metadata,
 * LEAD_CONTACTED, etc.). No DB writes. Strict workspace scope.
 *
 * Rules are rule-based v1. Each rule is small, named, and unit-tested
 * so we can swap individual rules without touching the surface. Phase 2
 * can A/B an LLM rule against any individual rule.
 */

export type NextActionKind =
  | "send_proposal"
  | "book_call"
  | "follow_up_email"
  | "follow_up_call"
  | "prepare_outreach"
  | "send_first_outreach"
  | "log_outcome"
  | "nurture_pause"
  | "disqualify"
  | "do_nothing";

export type NextBestAction = {
  kind: NextActionKind;
  reason: string;
  urgency: "high" | "medium" | "low";
  /** Optional concrete CTA text the UI can render. */
  cta?: string;
};

export type NextBestActionInput = {
  workspaceId: string;
  leadId: string;
};

/**
 * Pure decision function. Easy to test without a DB. The DB wrapper
 * below loads the inputs and delegates here.
 */
export function decideNextBestAction(input: {
  stage: LeadStage;
  score: number;
  lastReplyClassification?: ReplyClassification | null;
  lastReplyAt?: Date | null;
  lastContactedAt?: Date | null;
  now?: Date;
}): NextBestAction {
  const now = input.now ?? new Date();
  const replyAgeDays = input.lastReplyAt
    ? Math.floor((now.getTime() - input.lastReplyAt.getTime()) / 86_400_000)
    : null;
  const contactAgeDays = input.lastContactedAt
    ? Math.floor((now.getTime() - input.lastContactedAt.getTime()) / 86_400_000)
    : null;

  // Terminal stages: nothing to do here.
  if (input.stage === "WON") {
    return { kind: "do_nothing", urgency: "low", reason: "Deal won." };
  }
  if (input.stage === "LOST" || input.stage === "DISQUALIFIED") {
    return {
      kind: "log_outcome",
      urgency: "low",
      reason: "Capture lost reason if not already logged.",
    };
  }

  // Reply-driven actions take priority.
  if (input.lastReplyClassification) {
    switch (input.lastReplyClassification) {
      case "BOOKED_CALL":
        return {
          kind: "book_call",
          urgency: "high",
          reason: "Prospect confirmed a call. Send the calendar invite + prep notes.",
          cta: "Confirm the call",
        };
      case "INTERESTED":
        return {
          kind: "send_proposal",
          urgency: "high",
          reason: "Prospect is interested. Send the proposal grounded in their audit.",
          cta: "Send proposal",
        };
      case "NEEDS_MORE_INFO":
        return {
          kind: "follow_up_email",
          urgency: "high",
          reason: "Prospect asked for more detail. Send one focused follow-up.",
          cta: "Send follow-up email",
        };
      case "PRICING_OBJECTION":
        return {
          kind: "follow_up_email",
          urgency: "high",
          reason: "Pricing objection. Counter with value framing + outcome guarantee.",
          cta: "Send value-framed reply",
        };
      case "FOLLOW_UP_LATER":
        return {
          kind: "nurture_pause",
          urgency: "low",
          reason: "Prospect asked to be reached out to later. Drop into nurture.",
          cta: "Move to nurture",
        };
      case "ALREADY_HAS_PROVIDER":
        return {
          kind: "nurture_pause",
          urgency: "low",
          reason: "Locked with a current provider. Quarterly nurture is fine.",
        };
      case "NOT_INTERESTED":
        return {
          kind: "nurture_pause",
          urgency: "low",
          reason: "Not interested today. Quarterly nurture; don't push.",
        };
      case "WRONG_CONTACT":
      case "BOUNCED":
        return {
          kind: "disqualify",
          urgency: "low",
          reason: "Bad contact. Disqualify and free up the seat.",
        };
      case "ANGRY":
        return {
          kind: "disqualify",
          urgency: "medium",
          reason: "Hostile reply. Disqualify and add to suppression list.",
        };
    }
  }

  // Stage-driven actions when no reply has been logged yet.
  switch (input.stage) {
    case "PROPOSAL_SENT": {
      const stale = replyAgeDays === null && (contactAgeDays ?? 0) >= 3;
      return stale
        ? {
            kind: "follow_up_email",
            urgency: "high",
            reason: `Proposal sent ${contactAgeDays}d ago, no movement. Bump.`,
            cta: "Send proposal nudge",
          }
        : {
            kind: "do_nothing",
            urgency: "low",
            reason: "Proposal is in flight. Wait one more day.",
          };
    }
    case "CALL_BOOKED":
      return {
        kind: "book_call",
        urgency: "high",
        reason: "Call is booked. Prep the talking points and confirm.",
        cta: "Open prep",
      };
    case "QUALIFIED":
      return {
        kind: "book_call",
        urgency: "high",
        reason: "Lead qualified. Book the call now while they're warm.",
        cta: "Book a call",
      };
    case "REPLIED":
      return {
        kind: "follow_up_email",
        urgency: "high",
        reason: "Prospect replied. Move the conversation forward in one message.",
        cta: "Send next message",
      };
    case "CONTACTED": {
      const stale = (contactAgeDays ?? 0) >= 4;
      return stale
        ? {
            kind: "follow_up_call",
            urgency: "medium",
            reason: `Contacted ${contactAgeDays}d ago, no reply. Second touch.`,
            cta: "Second touch",
          }
        : {
            kind: "do_nothing",
            urgency: "low",
            reason: "Recently contacted. Give it a beat.",
          };
    }
    case "PREPARED":
      return {
        kind: "send_first_outreach",
        urgency: "medium",
        reason: "Outreach prep ready. Send the first message.",
        cta: "Send first outreach",
      };
    case "AUDIT_GENERATED":
      return {
        kind: "prepare_outreach",
        urgency: "medium",
        reason: "Audit is ready. Prep the pitch + email.",
        cta: "Prep outreach",
      };
    case "SCORED":
    case "IMPORTED":
    case "NEW":
      // High-scoring untouched leads get a priority bump.
      return {
        kind: "prepare_outreach",
        urgency: input.score >= 70 ? "high" : "low",
        reason:
          input.score >= 70
            ? "High-score lead with no outreach yet. Move on it today."
            : "Run the audit + prep workflow when capacity allows.",
        cta: "Prep outreach",
      };
    case "NURTURE":
      return {
        kind: "do_nothing",
        urgency: "low",
        reason: "Nurture queue. Auto-touch on cadence.",
      };
  }

  return { kind: "do_nothing", urgency: "low", reason: "No action." };
}

/**
 * DB-backed wrapper. Strictly workspace-scoped.
 */
export async function getNextBestAction(
  input: NextBestActionInput,
): Promise<NextBestAction | null> {
  if (!input?.workspaceId || !input?.leadId) {
    throw new Error("next-best-action: workspaceId and leadId required");
  }
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, workspaceId: input.workspaceId },
    select: { id: true, status: true, score: true, lastContactedAt: true },
  });
  if (!lead) return null;

  // Pull the most recent REPLY_LOGGED activity to extract the classification.
  const lastReply = await prisma.activity.findFirst({
    where: { workspaceId: input.workspaceId, leadId: input.leadId, type: "REPLY_LOGGED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadataJson: true },
  });

  let lastReplyClassification: ReplyClassification | null = null;
  if (lastReply?.metadataJson) {
    try {
      const meta = JSON.parse(lastReply.metadataJson) as { classification?: string };
      if (meta.classification) {
        lastReplyClassification = meta.classification as ReplyClassification;
      }
    } catch {
      // Malformed metadata is non-fatal \u2014 we just don't use it.
    }
  }

  return decideNextBestAction({
    stage: normalizeStage(lead.status),
    score: lead.score,
    lastReplyClassification,
    lastReplyAt: lastReply?.createdAt ?? null,
    lastContactedAt: lead.lastContactedAt ?? null,
  });
}
