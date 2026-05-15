import { prisma } from "@/lib/prisma";
import { normalizeStage, LEAD_STAGES, type LeadStage } from "./stages";

/**
 * Local strict workspace scope. We do not depend on the
 * `strictWorkspaceScope` helper from src/lib/workspace.ts because that
 * helper lives on the security/admin-auth-hardening branch — keeping this
 * feature self-contained means it can land in either order without
 * conflicts.
 */
function scope(workspaceId: string) {
  return { workspaceId } as const;
}

/**
 * Pipeline counters for a workspace dashboard.
 *
 * All queries are strictly scoped to the workspaceId passed in. Callers
 * MUST resolve workspaceId from the session, never from client input.
 *
 * Raw counters are derived from existing tables:
 *   - leads imported / scored / audit-generated / prepared / contacted
 *     / replied / qualified / call-booked / proposal-sent / won / lost /
 *     nurture / disqualified  \u2192 Lead.status normalized via normalizeStage.
 *   - replies-logged           \u2192 Activity rows with type=REPLY_LOGGED.
 *   - audits-generated         \u2192 Activity rows with type=AUDIT_GENERATED.
 *
 * Rates are derived from the raw counters; close-rate is won/proposal,
 * reply-rate is replied/contacted, proposal-rate is proposal/booked.
 * Empty workspaces return zero for everything (no divide-by-zero).
 */

export type StageCounts = Record<LeadStage, number>;

export type PipelineMetrics = {
  workspaceId: string;
  asOf: Date;
  counts: StageCounts;
  // Derived counters that map to the dashboard tiles spec.
  derived: {
    leadsImported: number;
    leadsScored: number;
    auditsGenerated: number;
    outreachPrepared: number;
    leadsContacted: number;
    repliesLogged: number;
    callsBooked: number;
    proposalsSent: number;
    won: number;
    lost: number;
    nurture: number;
    disqualified: number;
  };
  rates: {
    connectionRate: number; // contacted / imported
    replyRate: number; // replied / contacted
    bookedCallRate: number; // booked / replied
    proposalRate: number; // proposal / booked
    closeRate: number; // won / proposal
  };
};

function emptyCounts(): StageCounts {
  return LEAD_STAGES.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as StageCounts);
}

function safeRatio(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  const r = num / den;
  return Math.max(0, Math.min(1, r));
}

/**
 * Compute pipeline metrics for a workspace.
 *
 * @param workspaceId  must be the session-derived workspaceId.
 */
export async function getPipelineMetrics(workspaceId: string): Promise<PipelineMetrics> {
  if (!workspaceId) {
    throw new Error("pipeline counters: workspaceId required");
  }

  // groupBy by Lead.status (free-text). Normalize each bucket into the
  // canonical LeadStage enum and aggregate.
  const groups = await prisma.lead.groupBy({
    by: ["status"],
    where: scope(workspaceId),
    _count: { _all: true },
  });

  const counts = emptyCounts();
  for (const g of groups) {
    const stage = normalizeStage(g.status);
    counts[stage] += g._count._all;
  }

  // Replies and audits are counted from Activity, not from a stage \u2014 they
  // can happen multiple times per lead and we want raw event counts.
  const [replyCount, auditCount, prepCount, contactCount, callCount, proposalCount] =
    await Promise.all([
      prisma.activity.count({ where: { ...scope(workspaceId), type: "REPLY_LOGGED" } }),
      prisma.activity.count({ where: { ...scope(workspaceId), type: "AUDIT_GENERATED" } }),
      prisma.activity.count({ where: { ...scope(workspaceId), type: "OUTREACH_PREPARED" } }),
      prisma.activity.count({ where: { ...scope(workspaceId), type: "LEAD_CONTACTED" } }),
      prisma.activity.count({ where: { ...scope(workspaceId), type: "CALL_BOOKED" } }),
      prisma.activity.count({ where: { ...scope(workspaceId), type: "PROPOSAL_SENT" } }),
    ]);

  // Imported = every lead created in this workspace. Use Lead row count
  // rather than activity \u2014 imports can happen pre-activity ledger.
  const leadsImported = Object.values(counts).reduce((a, b) => a + b, 0);

  // "Leads scored" \u2014 every Lead row has a score so we count those with
  // score > 0 to approximate "actually scored vs. default".
  const leadsScoredAgg = await prisma.lead.aggregate({
    where: { ...scope(workspaceId), score: { gt: 0 } },
    _count: { _all: true },
  });
  const leadsScored = leadsScoredAgg._count._all;

  const derived = {
    leadsImported,
    leadsScored,
    auditsGenerated: auditCount,
    outreachPrepared: prepCount,
    // Prefer activity-based contacted; fall back to the stage bucket if
    // older code hasn't written LEAD_CONTACTED activities yet.
    leadsContacted: contactCount > 0 ? contactCount : counts.CONTACTED,
    repliesLogged: replyCount,
    callsBooked: callCount > 0 ? callCount : counts.CALL_BOOKED,
    proposalsSent: proposalCount > 0 ? proposalCount : counts.PROPOSAL_SENT,
    won: counts.WON,
    lost: counts.LOST,
    nurture: counts.NURTURE,
    disqualified: counts.DISQUALIFIED,
  };

  const rates = {
    connectionRate: safeRatio(derived.leadsContacted, derived.leadsImported),
    replyRate: safeRatio(derived.repliesLogged, derived.leadsContacted),
    bookedCallRate: safeRatio(derived.callsBooked, derived.repliesLogged),
    proposalRate: safeRatio(derived.proposalsSent, derived.callsBooked),
    closeRate: safeRatio(derived.won, derived.proposalsSent),
  };

  return {
    workspaceId,
    asOf: new Date(),
    counts,
    derived,
    rates,
  };
}

/**
 * Helper for callers that already have the raw groupBy + activity counts
 * (e.g. dashboards that aggregate multiple workspaces). Pure function,
 * no DB calls, easy to unit-test.
 */
export function composeMetrics(input: {
  workspaceId: string;
  asOf?: Date;
  stageCounts: Partial<StageCounts>;
  activityCounts: {
    REPLY_LOGGED?: number;
    AUDIT_GENERATED?: number;
    OUTREACH_PREPARED?: number;
    LEAD_CONTACTED?: number;
    CALL_BOOKED?: number;
    PROPOSAL_SENT?: number;
  };
  leadsScored?: number;
}): PipelineMetrics {
  const counts = emptyCounts();
  for (const s of LEAD_STAGES) counts[s] = input.stageCounts[s] ?? 0;
  const replyCount = input.activityCounts.REPLY_LOGGED ?? 0;
  const auditCount = input.activityCounts.AUDIT_GENERATED ?? 0;
  const prepCount = input.activityCounts.OUTREACH_PREPARED ?? 0;
  const contactCount = input.activityCounts.LEAD_CONTACTED ?? 0;
  const callCount = input.activityCounts.CALL_BOOKED ?? 0;
  const proposalCount = input.activityCounts.PROPOSAL_SENT ?? 0;
  const leadsImported = Object.values(counts).reduce((a, b) => a + b, 0);
  const derived = {
    leadsImported,
    leadsScored: input.leadsScored ?? 0,
    auditsGenerated: auditCount,
    outreachPrepared: prepCount,
    leadsContacted: contactCount > 0 ? contactCount : counts.CONTACTED,
    repliesLogged: replyCount,
    callsBooked: callCount > 0 ? callCount : counts.CALL_BOOKED,
    proposalsSent: proposalCount > 0 ? proposalCount : counts.PROPOSAL_SENT,
    won: counts.WON,
    lost: counts.LOST,
    nurture: counts.NURTURE,
    disqualified: counts.DISQUALIFIED,
  };
  const rates = {
    connectionRate: safeRatio(derived.leadsContacted, derived.leadsImported),
    replyRate: safeRatio(derived.repliesLogged, derived.leadsContacted),
    bookedCallRate: safeRatio(derived.callsBooked, derived.repliesLogged),
    proposalRate: safeRatio(derived.proposalsSent, derived.callsBooked),
    closeRate: safeRatio(derived.won, derived.proposalsSent),
  };
  return { workspaceId: input.workspaceId, asOf: input.asOf ?? new Date(), counts, derived, rates };
}
