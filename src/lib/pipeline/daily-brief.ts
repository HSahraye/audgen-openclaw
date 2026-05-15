import { prisma } from "@/lib/prisma";
import { normalizeStage, type LeadStage } from "./stages";

/**
 * Daily brief, derived from pipeline state.
 *
 * Existing /brief surface is heuristic (call-today, ghost, warm). This
 * helper produces a complementary pipeline-state-driven brief that asks:
 * "given where each lead is in the funnel right now, what are the top
 * actions for today?"
 *
 * Output is workspace-scoped. Caller MUST resolve workspaceId from the
 * session; this helper never accepts an unverified id.
 *
 * Strategy (rule-based v1 \u2014 the scoring loop in Phase 2 can re-rank
 * these later):
 *  - REPLIED:        highest priority \u2014 someone replied and hasn't been
 *                    moved forward yet.
 *  - QUALIFIED:      next \u2014 ready for proposal / call booking.
 *  - PROPOSAL_SENT:  follow up if it's been > N days since the proposal
 *                    activity.
 *  - CONTACTED:      ready for a follow-up touch if it's been > N days
 *                    since LEAD_CONTACTED.
 *  - CALL_BOOKED:    keep on the schedule view (do not duplicate the
 *                    call-today list, but surface upcoming calls).
 * Inactive: WON, LOST, DISQUALIFIED are excluded.
 *
 * The brief returns up to TOTAL_BUDGET leads, prioritised by stage and
 * recency. Each lead carries a `reason` string explaining why it is in
 * the brief, suitable for direct display.
 */

export type DailyBriefItem = {
  leadId: string;
  businessName: string;
  stage: LeadStage;
  score: number;
  reason: string;
  // ms-since-last-activity, used by the dashboard to render relative time.
  lastActivityAgeMs: number | null;
};

export type DailyBrief = {
  workspaceId: string;
  asOf: Date;
  items: DailyBriefItem[];
  totals: {
    repliedAwaiting: number;
    qualifiedAwaiting: number;
    proposalsStale: number;
    contactedStale: number;
    callBookedUpcoming: number;
  };
};

const TOTAL_BUDGET = 25;
const PROPOSAL_STALE_DAYS = 3;
const CONTACTED_STALE_DAYS = 4;

const STAGE_PRIORITY: Record<LeadStage, number> = {
  REPLIED: 1,
  QUALIFIED: 2,
  PROPOSAL_SENT: 3,
  CALL_BOOKED: 4,
  CONTACTED: 5,
  PREPARED: 6,
  AUDIT_GENERATED: 7,
  SCORED: 8,
  IMPORTED: 9,
  NEW: 10,
  NURTURE: 90,
  LOST: 99,
  WON: 99,
  DISQUALIFIED: 99,
};

function daysAgo(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function reasonFor(stage: LeadStage, lastActivity: Date | null, lastContacted: Date | null): string {
  if (stage === "REPLIED") return "Replied — has not been moved forward.";
  if (stage === "QUALIFIED") return "Qualified — ready for proposal or call booking.";
  if (stage === "PROPOSAL_SENT") {
    const days = daysAgo(lastActivity);
    if (days !== null && days >= PROPOSAL_STALE_DAYS)
      return `Proposal sent ${days}d ago — follow up.`;
    return "Proposal sent recently — keep on the watch list.";
  }
  if (stage === "CALL_BOOKED") return "Call booked — prep + confirm.";
  if (stage === "CONTACTED") {
    const days = daysAgo(lastContacted ?? lastActivity);
    if (days !== null && days >= CONTACTED_STALE_DAYS)
      return `Contacted ${days}d ago, no reply — second touch.`;
    return "Recently contacted — leave a beat.";
  }
  return `Stage: ${stage}`;
}

export async function buildPipelineDailyBrief(workspaceId: string): Promise<DailyBrief> {
  if (!workspaceId) throw new Error("daily-brief: workspaceId required");

  // Pull a wider candidate set than we will return so we can score and trim.
  const candidates = await prisma.lead.findMany({
    where: {
      workspaceId,
      status: {
        notIn: ["WON", "LOST", "DISQUALIFIED", "won", "lost", "disqualified"],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { score: "desc" }],
    take: 200,
    select: {
      id: true,
      businessName: true,
      status: true,
      score: true,
      lastContactedAt: true,
      updatedAt: true,
    },
  });

  const ranked: DailyBriefItem[] = candidates
    .map((lead) => {
      const stage = normalizeStage(lead.status);
      const lastActivityAgeMs = lead.updatedAt
        ? Date.now() - lead.updatedAt.getTime()
        : null;
      return {
        leadId: lead.id,
        businessName: lead.businessName,
        stage,
        score: lead.score,
        reason: reasonFor(stage, lead.updatedAt, lead.lastContactedAt),
        lastActivityAgeMs,
      };
    })
    .filter((it) => STAGE_PRIORITY[it.stage] < 99)
    .sort((a, b) => {
      const sp = STAGE_PRIORITY[a.stage] - STAGE_PRIORITY[b.stage];
      if (sp !== 0) return sp;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, TOTAL_BUDGET);

  const totals = {
    repliedAwaiting: ranked.filter((i) => i.stage === "REPLIED").length,
    qualifiedAwaiting: ranked.filter((i) => i.stage === "QUALIFIED").length,
    proposalsStale: ranked.filter(
      (i) =>
        i.stage === "PROPOSAL_SENT" &&
        i.lastActivityAgeMs !== null &&
        i.lastActivityAgeMs >= PROPOSAL_STALE_DAYS * 24 * 60 * 60 * 1000,
    ).length,
    contactedStale: ranked.filter(
      (i) =>
        i.stage === "CONTACTED" &&
        i.lastActivityAgeMs !== null &&
        i.lastActivityAgeMs >= CONTACTED_STALE_DAYS * 24 * 60 * 60 * 1000,
    ).length,
    callBookedUpcoming: ranked.filter((i) => i.stage === "CALL_BOOKED").length,
  };

  return { workspaceId, asOf: new Date(), items: ranked, totals };
}
