import { prisma } from "@/lib/prisma";
import { buildActivityCreate } from "./activity";
import {
  isLeadStage,
  isValidTransition,
  normalizeStage,
  type LeadStage,
} from "./stages";

/**
 * Manual reply logging.
 *
 * The first pass of reply intelligence is manual: a seller hears back from
 * a prospect (phone, email, SMS, in person) and records it in AuditGen.
 * Email/SMS provider integrations (Phase 4) will write replies through
 * the same helper.
 *
 * We do not have a dedicated `Reply` model yet. To stay non-destructive
 * we store replies as:
 *   - OutreachLog row with type="reply" and the note body
 *   - Activity row with type=REPLY_LOGGED and structured metadata
 *     (classification, suggestedStage, actorUserId)
 *
 * The follow-up migration plan (prisma/MIGRATION_PLAN_REPLY_MODEL.md)
 * promotes this to a first-class `Reply` table once the data shape is
 * stable. Until then, queries should treat (OutreachLog where type="reply"
 * for the row, Activity where type=REPLY_LOGGED for the classification)
 * as the canonical reply ledger.
 *
 * Optional auto-transition table maps classifications to a sensible next
 * stage. The helper only transitions if the move is valid from the lead's
 * current stage; otherwise it logs the reply and leaves the stage alone.
 */

export const REPLY_CLASSIFICATIONS = [
  "INTERESTED",
  "NOT_INTERESTED",
  "WRONG_CONTACT",
  "FOLLOW_UP_LATER",
  "PRICING_OBJECTION",
  "ALREADY_HAS_PROVIDER",
  "BOUNCED",
  "ANGRY",
  "BOOKED_CALL",
  "NEEDS_MORE_INFO",
] as const;

export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

export function isReplyClassification(v: unknown): v is ReplyClassification {
  return (
    typeof v === "string" &&
    (REPLY_CLASSIFICATIONS as readonly string[]).includes(v)
  );
}

/**
 * Maps a classification to the stage the lead should land in IF the
 * transition is valid from its current stage. The transition is only
 * applied when isValidTransition(current, suggested) is true; otherwise
 * the reply is recorded without changing stage.
 *
 * NOT_INTERESTED and FOLLOW_UP_LATER are intentionally mapped to NURTURE
 * by default. A separate UI flow can mark them LOST if needed.
 * BOUNCED -> DISQUALIFIED. WRONG_CONTACT -> DISQUALIFIED. ANGRY ->
 * DISQUALIFIED (with a "log to ops" todo for human review).
 */
export const CLASSIFICATION_TARGET_STAGE: Record<ReplyClassification, LeadStage | null> = {
  INTERESTED: "QUALIFIED",
  NOT_INTERESTED: "NURTURE",
  WRONG_CONTACT: "DISQUALIFIED",
  FOLLOW_UP_LATER: "NURTURE",
  PRICING_OBJECTION: "QUALIFIED",
  ALREADY_HAS_PROVIDER: "LOST",
  BOUNCED: "DISQUALIFIED",
  ANGRY: "DISQUALIFIED",
  BOOKED_CALL: "CALL_BOOKED",
  NEEDS_MORE_INFO: "QUALIFIED",
};

export type LogReplyArgs = {
  leadId: string;
  workspaceId: string;
  actorUserId: string | null;
  classification: ReplyClassification;
  body?: string | null;
  /** If true, attempt the auto-transition table above. Default true. */
  autoTransition?: boolean;
};

export type LogReplyResult =
  | {
      ok: true;
      outreachLogId: string;
      activityId: string;
      previousStage: LeadStage;
      nextStage: LeadStage; // unchanged when no transition is applied
      stageChanged: boolean;
    }
  | {
      ok: false;
      error:
        | "missing_required"
        | "invalid_classification"
        | "lead_not_found";
    };

export async function logManualReply(args: LogReplyArgs): Promise<LogReplyResult> {
  if (!args || !args.leadId || !args.workspaceId || !args.classification) {
    return { ok: false, error: "missing_required" };
  }
  if (!isReplyClassification(args.classification)) {
    return { ok: false, error: "invalid_classification" };
  }

  // Composite WHERE so cross-tenant attempts collapse to lead_not_found.
  const lead = await prisma.lead.findFirst({
    where: { id: args.leadId, workspaceId: args.workspaceId },
    select: { id: true, status: true },
  });
  if (!lead) return { ok: false, error: "lead_not_found" };

  const previousStage = normalizeStage(lead.status);
  const autoTransition = args.autoTransition !== false;
  const target = CLASSIFICATION_TARGET_STAGE[args.classification];
  const willTransition =
    autoTransition &&
    target !== null &&
    isLeadStage(target) &&
    isValidTransition(previousStage, target);
  const nextStage: LeadStage = willTransition ? (target as LeadStage) : previousStage;

  const activityData = buildActivityCreate({
    workspaceId: args.workspaceId,
    leadId: args.leadId,
    type: "REPLY_LOGGED",
    detail: args.body ?? null,
    source: args.actorUserId ? "user" : "system",
    metadata: {
      classification: args.classification,
      previousStage,
      nextStage,
      stageChanged: willTransition,
      actorUserId: args.actorUserId ?? null,
    },
  });

  // Build the ops array as a discriminated tuple. Prisma's $transaction
  // overloads both an array form and a callback form; we want the array.
  const outreachOp = prisma.outreachLog.create({
    data: {
      workspaceId: args.workspaceId,
      leadId: args.leadId,
      type: "reply",
      notes: args.body ?? null,
    },
  });
  const activityOp = prisma.activity.create({ data: activityData });
  const result = willTransition
    ? await prisma.$transaction([
        outreachOp,
        activityOp,
        prisma.lead.update({
          where: { id: args.leadId },
          data: {
            status: nextStage,
            lastContactedAt: new Date(),
          },
        }),
      ])
    : await prisma.$transaction([outreachOp, activityOp]);

  // result is [outreachLog, activity, (lead?)]
  const outreachLogId = (result[0] as { id: string }).id;
  const activityId = (result[1] as { id: string }).id;

  return {
    ok: true,
    outreachLogId,
    activityId,
    previousStage,
    nextStage,
    stageChanged: willTransition,
  };
}
