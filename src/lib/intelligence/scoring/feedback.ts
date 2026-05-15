import { prisma } from "@/lib/prisma";

/**
 * Scoring feedback-loop skeleton.
 *
 * Phase 2 (revenue intelligence) needs a closed loop: every won/lost
 * deal teaches the scorer which lead signals actually predict close.
 * This file is the skeleton \u2014 it reads outcomes from the Activity
 * ledger and produces per-signal lift coefficients without touching the
 * live scorer yet. The scorer remains rule-based until the coefficients
 * stabilise on enough data; this just makes the data accessible.
 *
 * Inputs: Lead rows + Activity rows (DEAL_WON / DEAL_LOST).
 * Output: ScoringFeedbackReport (per-signal lift over baseline).
 *
 * Design notes
 *  - Workspace-scoped server-side. Caller MUST resolve workspaceId
 *    from the session.
 *  - Read-only. No writes. No schema changes.
 *  - Returns zero-lift / N/A buckets cleanly when data is thin; the
 *    point of the skeleton is to NOT pretend we have a trained model.
 *  - Lift is computed against the workspace baseline (overall win
 *    rate). Per-signal win rate / baseline. > 1.0 means the signal is
 *    associated with closes; < 1.0 means the opposite.
 *  - We bucket the lead's score band, category, and location. These
 *    are the obvious starting signals; richer features (template id,
 *    vertical pack, audit issue) follow once those are first-class.
 */

export type ScoreBand = "0-20" | "21-40" | "41-60" | "61-80" | "81-100";

export type ScoringFeedbackReport = {
  workspaceId: string;
  asOf: Date;
  totals: {
    decided: number; // leads with a DEAL_WON or DEAL_LOST activity
    won: number;
    lost: number;
    baselineCloseRate: number; // won / decided
  };
  byScoreBand: Array<{
    band: ScoreBand;
    decided: number;
    won: number;
    closeRate: number;
    lift: number; // closeRate / baselineCloseRate; 1.0 = average; NaN-safe
  }>;
  byCategory: Array<{
    category: string;
    decided: number;
    won: number;
    closeRate: number;
    lift: number;
  }>;
  byLocation: Array<{
    location: string;
    decided: number;
    won: number;
    closeRate: number;
    lift: number;
  }>;
  thinDataNotes: string[];
};

const MIN_DECIDED_FOR_LIFT = 5;

function bandFor(score: number): ScoreBand {
  if (score <= 20) return "0-20";
  if (score <= 40) return "21-40";
  if (score <= 60) return "41-60";
  if (score <= 80) return "61-80";
  return "81-100";
}

function rate(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return num / den;
}

function lift(closeRate: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return closeRate / baseline;
}

type DecidedLead = {
  score: number;
  category: string | null;
  location: string | null;
  outcome: "won" | "lost";
};

/**
 * Pure aggregator. Useful for tests and for offline analysis of an
 * exported snapshot. The DB-backed version below is a thin wrapper.
 */
export function aggregateFeedback(
  decided: DecidedLead[],
  workspaceId: string,
  asOf: Date = new Date(),
): ScoringFeedbackReport {
  const won = decided.filter((d) => d.outcome === "won").length;
  const lost = decided.length - won;
  const baselineCloseRate = rate(won, decided.length);

  function group<K extends string>(
    keyFn: (d: DecidedLead) => K | null,
  ): Array<{ key: K; decided: number; won: number; closeRate: number; lift: number }> {
    const buckets = new Map<K, { decided: number; won: number }>();
    for (const d of decided) {
      const k = keyFn(d);
      if (!k) continue;
      const b = buckets.get(k) ?? { decided: 0, won: 0 };
      b.decided += 1;
      if (d.outcome === "won") b.won += 1;
      buckets.set(k, b);
    }
    return [...buckets.entries()]
      .map(([k, b]) => {
        const cr = rate(b.won, b.decided);
        return {
          key: k,
          decided: b.decided,
          won: b.won,
          closeRate: cr,
          lift: lift(cr, baselineCloseRate),
        };
      })
      .sort((a, b) => b.decided - a.decided);
  }

  const byScoreBandRaw = group<ScoreBand>((d) => bandFor(d.score));
  const byCategoryRaw = group<string>((d) => (d.category ? d.category.toLowerCase() : null));
  const byLocationRaw = group<string>((d) => (d.location ? d.location.toLowerCase() : null));

  const thinDataNotes: string[] = [];
  if (decided.length < MIN_DECIDED_FOR_LIFT) {
    thinDataNotes.push(
      `Only ${decided.length} decided deal(s); lift coefficients are not reliable yet (need >= ${MIN_DECIDED_FOR_LIFT}).`,
    );
  }

  return {
    workspaceId,
    asOf,
    totals: {
      decided: decided.length,
      won,
      lost,
      baselineCloseRate,
    },
    byScoreBand: byScoreBandRaw.map(({ key, ...rest }) => ({ band: key, ...rest })),
    byCategory: byCategoryRaw.map(({ key, ...rest }) => ({ category: key, ...rest })),
    byLocation: byLocationRaw.map(({ key, ...rest }) => ({ location: key, ...rest })),
    thinDataNotes,
  };
}

/**
 * DB-backed entry point. Reads decided leads from the Activity ledger
 * (DEAL_WON / DEAL_LOST) and joins back to the Lead row for the score,
 * category, and location features.
 */
export async function getScoringFeedback(
  workspaceId: string,
): Promise<ScoringFeedbackReport> {
  if (!workspaceId) throw new Error("scoring-feedback: workspaceId required");

  // Pull the latest decision per lead. If a lead has both DEAL_WON and
  // DEAL_LOST (shouldn't happen, but be defensive), the most recent wins.
  const activities = await prisma.activity.findMany({
    where: {
      workspaceId,
      type: { in: ["DEAL_WON", "DEAL_LOST"] },
      leadId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { leadId: true, type: true, createdAt: true },
  });

  const outcomeByLead = new Map<string, "won" | "lost">();
  for (const a of activities) {
    if (!a.leadId) continue;
    if (outcomeByLead.has(a.leadId)) continue; // latest wins
    outcomeByLead.set(a.leadId, a.type === "DEAL_WON" ? "won" : "lost");
  }

  if (outcomeByLead.size === 0) {
    return aggregateFeedback([], workspaceId);
  }

  const leadIds = [...outcomeByLead.keys()];
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, workspaceId },
    select: { id: true, score: true, category: true, location: true },
  });

  const decided: DecidedLead[] = leads
    .map((lead) => {
      const outcome = outcomeByLead.get(lead.id);
      if (!outcome) return null;
      return {
        score: lead.score,
        category: lead.category ?? null,
        location: lead.location ?? null,
        outcome,
      };
    })
    .filter((d): d is DecidedLead => d !== null);

  return aggregateFeedback(decided, workspaceId);
}
