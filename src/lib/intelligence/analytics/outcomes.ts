import { prisma } from "@/lib/prisma";
import { normalizeStage } from "@/lib/pipeline/stages";

/**
 * Outcome analytics: conversion breakdowns by vertical (category) and
 * city (location). Sits one layer above the scoring feedback skeleton.
 * Where `feedback.ts` produces lift coefficients for the scorer, this
 * file produces dashboard-ready rollups for the operator.
 *
 * Differences from `feedback.ts`:
 *  - Includes funnel rates (contact \u2192 reply \u2192 booked \u2192 proposal \u2192 won),
 *    not just close rate.
 *  - Does not require DEAL_WON / DEAL_LOST activities; it can produce a
 *    useful picture from current stage alone, falling back to activity
 *    counts when present.
 *  - Returns rows sorted by sample size; thin buckets are still listed
 *    but flagged.
 *
 * Workspace-scoped server-side. Caller MUST resolve workspaceId from
 * the session.
 */

export type OutcomeBucket = {
  key: string;
  total: number;
  contacted: number;
  replied: number;
  booked: number;
  proposal: number;
  won: number;
  lost: number;
  rates: {
    contactRate: number;
    replyRate: number;
    bookedRate: number;
    proposalRate: number;
    closeRate: number;
  };
  thin: boolean;
};

export type OutcomeAnalyticsReport = {
  workspaceId: string;
  asOf: Date;
  byCategory: OutcomeBucket[];
  byLocation: OutcomeBucket[];
};

const THIN_THRESHOLD = 10;

function rate(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return Math.max(0, Math.min(1, num / den));
}

type LeadRow = {
  id: string;
  category: string | null;
  location: string | null;
  status: string;
};

type ActivityCount = {
  leadId: string;
  type: string;
  count: number;
};

function bucketKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  return t.length === 0 ? null : t;
}

/**
 * Pure aggregator. Easy to test, also reusable if you ever want to
 * roll up an exported snapshot of leads + activities.
 */
export function aggregateOutcomes(
  workspaceId: string,
  leads: LeadRow[],
  activitiesByLead: Map<string, Record<string, number>>,
  asOf: Date = new Date(),
): OutcomeAnalyticsReport {
  type Bucket = {
    total: number;
    contacted: number;
    replied: number;
    booked: number;
    proposal: number;
    won: number;
    lost: number;
  };
  const empty = (): Bucket => ({
    total: 0, contacted: 0, replied: 0, booked: 0, proposal: 0, won: 0, lost: 0,
  });
  const byCat = new Map<string, Bucket>();
  const byLoc = new Map<string, Bucket>();

  for (const lead of leads) {
    const stage = normalizeStage(lead.status);
    const acts = activitiesByLead.get(lead.id) ?? {};
    const contacted = (acts.LEAD_CONTACTED ?? 0) > 0 || stage === "CONTACTED" || stage === "REPLIED" || stage === "QUALIFIED" || stage === "CALL_BOOKED" || stage === "PROPOSAL_SENT" || stage === "WON" || stage === "LOST";
    const replied = (acts.REPLY_LOGGED ?? 0) > 0 || stage === "REPLIED" || stage === "QUALIFIED" || stage === "CALL_BOOKED" || stage === "PROPOSAL_SENT" || stage === "WON";
    const booked = (acts.CALL_BOOKED ?? 0) > 0 || stage === "CALL_BOOKED" || stage === "PROPOSAL_SENT" || stage === "WON";
    const proposal = (acts.PROPOSAL_SENT ?? 0) > 0 || stage === "PROPOSAL_SENT" || stage === "WON";
    const won = (acts.DEAL_WON ?? 0) > 0 || stage === "WON";
    const lost = (acts.DEAL_LOST ?? 0) > 0 || stage === "LOST";

    function bump(map: Map<string, Bucket>, key: string | null) {
      if (!key) return;
      const b = map.get(key) ?? empty();
      b.total += 1;
      if (contacted) b.contacted += 1;
      if (replied) b.replied += 1;
      if (booked) b.booked += 1;
      if (proposal) b.proposal += 1;
      if (won) b.won += 1;
      if (lost) b.lost += 1;
      map.set(key, b);
    }
    bump(byCat, bucketKey(lead.category));
    bump(byLoc, bucketKey(lead.location));
  }

  function compose(map: Map<string, Bucket>): OutcomeBucket[] {
    return [...map.entries()]
      .map(([key, b]) => ({
        key,
        total: b.total,
        contacted: b.contacted,
        replied: b.replied,
        booked: b.booked,
        proposal: b.proposal,
        won: b.won,
        lost: b.lost,
        rates: {
          contactRate: rate(b.contacted, b.total),
          replyRate: rate(b.replied, b.contacted),
          bookedRate: rate(b.booked, b.replied),
          proposalRate: rate(b.proposal, b.booked),
          closeRate: rate(b.won, b.proposal),
        },
        thin: b.total < THIN_THRESHOLD,
      }))
      .sort((a, b) => b.total - a.total);
  }

  return {
    workspaceId,
    asOf,
    byCategory: compose(byCat),
    byLocation: compose(byLoc),
  };
}

/**
 * DB-backed entry point. Strict workspace scope.
 */
export async function getOutcomeAnalytics(
  workspaceId: string,
): Promise<OutcomeAnalyticsReport> {
  if (!workspaceId) throw new Error("outcome-analytics: workspaceId required");

  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    select: { id: true, category: true, location: true, status: true },
  });

  const activities = await prisma.activity.findMany({
    where: {
      workspaceId,
      type: {
        in: ["LEAD_CONTACTED", "REPLY_LOGGED", "CALL_BOOKED", "PROPOSAL_SENT", "DEAL_WON", "DEAL_LOST"],
      },
      leadId: { not: null },
    },
    select: { leadId: true, type: true },
  });

  const activitiesByLead = new Map<string, Record<string, number>>();
  for (const a of activities) {
    if (!a.leadId) continue;
    const m = activitiesByLead.get(a.leadId) ?? {};
    m[a.type] = (m[a.type] ?? 0) + 1;
    activitiesByLead.set(a.leadId, m);
  }

  return aggregateOutcomes(workspaceId, leads, activitiesByLead);
}
