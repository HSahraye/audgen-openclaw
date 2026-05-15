import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, type PlanLimits } from "@/lib/billing/plans";
import { getWorkspacePlanTier } from "@/lib/billing/entitlements";

/**
 * Usage forecast helper.
 *
 * `getWorkspaceUsageForecast(workspaceId)` returns the canonical UI-ready
 * shape: current tier, the per-metric limit, the per-metric used count
 * this billing period, the percentage consumed, and a status (ok |
 * warning | over). It powers the settings/billing usage block and the
 * "upgrade prompt" gates on import / audit / outreach surfaces.
 *
 * Pure-ish: pulls from PLAN_LIMITS and UsageRecord (current period).
 * No writes. Strictly workspace-scoped. Caller MUST resolve workspaceId
 * from the session.
 *
 * Definitions:
 *   - Period: the first of the current month (UTC) through end-of-month.
 *     Matches the existing UsageRecord (workspaceId, metric, periodStart)
 *     unique key shape.
 *   - "warning" threshold = 80% of limit
 *   - "over" = used >= limit
 */

export type UsageMetricKey =
  | "auditsPerMonth"
  | "importsPerMonth"
  | "activeLeads"
  | "templates"
  | "seats"
  | "outreachGenerations"
  | "proposalGenerations";

export type UsageStatus = "ok" | "warning" | "over";

export type UsageMetricSnapshot = {
  key: UsageMetricKey;
  label: string;
  limit: number;
  used: number;
  remaining: number;
  pctConsumed: number; // 0..1
  status: UsageStatus;
};

export type UsageForecast = {
  workspaceId: string;
  asOf: Date;
  periodStart: Date;
  periodEnd: Date;
  planTier: string;
  metrics: UsageMetricSnapshot[];
  worstStatus: UsageStatus;
};

const METRIC_LABELS: Record<UsageMetricKey, string> = {
  auditsPerMonth: "Audits this month",
  importsPerMonth: "Lead imports this month",
  activeLeads: "Active leads",
  templates: "Templates",
  seats: "Team seats",
  outreachGenerations: "Outreach generations",
  proposalGenerations: "Proposal generations",
};

// UsageRecord.metric naming convention. We store the same key the plan
// uses; if your existing UsageRecord rows use different names, add an
// alias here. Keep this synchronised with src/lib/billing/usage/index.ts.
const RECORD_METRIC_FOR: Record<UsageMetricKey, string[]> = {
  auditsPerMonth: ["audits", "auditsPerMonth", "audit_generated"],
  importsPerMonth: ["imports", "importsPerMonth", "lead_imported"],
  activeLeads: ["activeLeads", "active_leads"],
  templates: ["templates"],
  seats: ["seats"],
  outreachGenerations: ["outreachGenerations", "outreach", "outreach_generated"],
  proposalGenerations: ["proposalGenerations", "proposal", "proposal_generated"],
};

function currentPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function statusFor(used: number, limit: number): UsageStatus {
  if (limit <= 0) return "ok";
  if (used >= limit) return "over";
  if (used / limit >= 0.8) return "warning";
  return "ok";
}

function worstOf(a: UsageStatus, b: UsageStatus): UsageStatus {
  const rank = { ok: 0, warning: 1, over: 2 } as const;
  return rank[b] > rank[a] ? b : a;
}

/**
 * Pure composer for tests and offline analysis. Pass in the plan limits
 * and the used-per-metric map; get back the snapshot.
 */
export function composeForecast(input: {
  workspaceId: string;
  planTier: string;
  limits: PlanLimits;
  usedByMetric: Partial<Record<UsageMetricKey, number>>;
  asOf?: Date;
}): UsageForecast {
  const now = input.asOf ?? new Date();
  const { start, end } = currentPeriod(now);
  const metrics: UsageMetricSnapshot[] = (
    Object.keys(input.limits) as UsageMetricKey[]
  ).map((key) => {
    const limit = input.limits[key];
    const used = input.usedByMetric[key] ?? 0;
    const remaining = Math.max(0, limit - used);
    const pctConsumed = limit > 0 ? Math.min(1, used / limit) : 0;
    return {
      key,
      label: METRIC_LABELS[key],
      limit,
      used,
      remaining,
      pctConsumed,
      status: statusFor(used, limit),
    };
  });
  const worstStatus = metrics.reduce<UsageStatus>(
    (acc, m) => worstOf(acc, m.status),
    "ok",
  );
  return {
    workspaceId: input.workspaceId,
    asOf: now,
    periodStart: start,
    periodEnd: end,
    planTier: input.planTier,
    metrics,
    worstStatus,
  };
}

export async function getWorkspaceUsageForecast(
  workspaceId: string,
): Promise<UsageForecast> {
  if (!workspaceId) throw new Error("usage-forecast: workspaceId required");
  const planTier = await getWorkspacePlanTier(workspaceId);
  const limits = PLAN_LIMITS[planTier];
  const { start } = currentPeriod();

  const records = await prisma.usageRecord.findMany({
    where: { workspaceId, periodStart: start },
    select: { metric: true, quantity: true },
  });

  const usedByMetric: Partial<Record<UsageMetricKey, number>> = {};
  for (const r of records) {
    for (const key of Object.keys(RECORD_METRIC_FOR) as UsageMetricKey[]) {
      if (RECORD_METRIC_FOR[key].includes(r.metric)) {
        usedByMetric[key] = (usedByMetric[key] ?? 0) + r.quantity;
      }
    }
  }

  return composeForecast({ workspaceId, planTier, limits, usedByMetric });
}
