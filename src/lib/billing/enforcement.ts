import {
  getWorkspaceUsageForecast,
  type UsageForecast,
  type UsageMetricKey,
} from "@/lib/billing/usage/forecast";
import { ensureWorkspaceOperational } from "@/lib/billing/entitlements";

/**
 * Billing plan enforcement gate.
 *
 * Single entry point that every revenue-critical action calls before
 * mutating state. Returns an EnforcementDecision: allow, soft (warn
 * but proceed), or block.
 *
 * Strategy:
 *  - First: workspace operational gate. If the workspace is suspended,
 *    delinquent, canceled, or trial-expired, BLOCK regardless of usage.
 *  - Then: load the current usage forecast and check the metric the
 *    action touches.
 *      * status='over'    -> BLOCK with a clear upgrade prompt.
 *      * status='warning' -> SOFT allow with a warning string.
 *      * status='ok'      -> ALLOW.
 *
 * The helper is workspace-scoped and read-only. It does not increment
 * usage \u2014 that happens on success inside the action handler (existing
 * src/lib/billing/usage helpers).
 */

export type GuardedAction =
  | "import_lead"
  | "generate_audit"
  | "send_outreach"
  | "send_proposal"
  | "create_template"
  | "add_seat";

const ACTION_TO_METRIC: Record<GuardedAction, UsageMetricKey> = {
  import_lead: "importsPerMonth",
  generate_audit: "auditsPerMonth",
  send_outreach: "outreachGenerations",
  send_proposal: "proposalGenerations",
  create_template: "templates",
  add_seat: "seats",
};

export type EnforcementDecision =
  | { ok: true; soft?: false; forecast: UsageForecast }
  | { ok: true; soft: true; warning: string; forecast: UsageForecast }
  | {
      ok: false;
      reason: string;
      upgradePrompt: string;
      forecast?: UsageForecast;
    };

const UPGRADE_PROMPT: Record<UsageMetricKey, string> = {
  auditsPerMonth: "You've hit this month's audit limit. Upgrade your plan to keep generating audits.",
  importsPerMonth: "You've hit this month's import limit. Upgrade your plan to import more leads.",
  activeLeads: "You're at your active-leads cap. Archive cold leads or upgrade your plan.",
  templates: "You're at the template cap for this plan. Upgrade to add more.",
  seats: "All seats are in use. Upgrade your plan or remove a teammate.",
  outreachGenerations: "Outreach generations are exhausted this month. Upgrade to keep sending.",
  proposalGenerations: "Proposal generations are exhausted this month. Upgrade to keep sending.",
};

/**
 * Pure decision over an operational status + a forecast. Easy to test
 * without a DB.
 */
export function decideEnforcement(
  action: GuardedAction,
  operational: { ok: boolean; reason?: string },
  forecast: UsageForecast,
): EnforcementDecision {
  if (!operational.ok) {
    return {
      ok: false,
      reason: operational.reason || "Workspace is not operational.",
      upgradePrompt:
        "Update billing or contact support to reactivate this workspace.",
      forecast,
    };
  }
  const metricKey = ACTION_TO_METRIC[action];
  const m = forecast.metrics.find((x) => x.key === metricKey);
  if (!m) {
    // Unknown metric \u2014 should never happen, but allow rather than crash.
    return { ok: true, forecast };
  }
  if (m.status === "over") {
    return {
      ok: false,
      reason: `Plan limit reached for ${m.label}.`,
      upgradePrompt: UPGRADE_PROMPT[metricKey],
      forecast,
    };
  }
  if (m.status === "warning") {
    return {
      ok: true,
      soft: true,
      warning: `Approaching the ${m.label} cap (${m.used}/${m.limit}). Consider upgrading soon.`,
      forecast,
    };
  }
  return { ok: true, forecast };
}

/**
 * DB-backed entry point. Resolve workspaceId from the session before
 * calling \u2014 do NOT pass a client-supplied id.
 */
export async function enforcePlanForAction(
  workspaceId: string,
  action: GuardedAction,
): Promise<EnforcementDecision> {
  if (!workspaceId) {
    return {
      ok: false,
      reason: "Workspace context missing.",
      upgradePrompt: "Sign in to continue.",
    };
  }
  const [operational, forecast] = await Promise.all([
    ensureWorkspaceOperational(workspaceId),
    getWorkspaceUsageForecast(workspaceId),
  ]);
  return decideEnforcement(action, operational, forecast);
}
