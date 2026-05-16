export type LeadgenAuditPreflight = {
  selectedCount: number;
  batchLimit: number;
  monthlyCreditRemaining: number;
  canQueue: boolean;
  requiresApproval: boolean;
  estimatedCreditImpact: string;
  warning: string | null;
};

export type WorkspaceMonthlyCreditAllocation = {
  workspaceId: string;
  monthlyCreditLimit: number;
  usedCredits: number;
  remainingCredits: number;
};

export const LEADGEN_AUDIT_BATCH_LIMIT = 10;
export const LEADGEN_MONTHLY_CREDIT_LIMIT = 100;
export const LEADGEN_PREFLIGHT_LIMIT_ERROR = "Batch exceeds allowed preflight limits.";

export function buildLeadgenAuditPreflight(
  selectedCount: number,
  remainingEntitlement: number,
  options: { batchLimit?: number; requiresApproval?: boolean; monthlyCreditRemaining?: number } = {},
): LeadgenAuditPreflight {
  const batchLimit = options.batchLimit ?? LEADGEN_AUDIT_BATCH_LIMIT;
  const requiresApproval = options.requiresApproval ?? true;
  const monthlyCreditRemaining = options.monthlyCreditRemaining ?? LEADGEN_MONTHLY_CREDIT_LIMIT;
  const exceedsBatch = selectedCount > batchLimit;
  const exceedsMonthlyCredits = selectedCount > monthlyCreditRemaining;
  const exceedsEntitlement = selectedCount > remainingEntitlement;
  const warning = exceedsBatch
    ? LEADGEN_PREFLIGHT_LIMIT_ERROR
    : exceedsMonthlyCredits
      ? LEADGEN_PREFLIGHT_LIMIT_ERROR
    : exceedsEntitlement
      ? LEADGEN_PREFLIGHT_LIMIT_ERROR
      : null;

  return {
    selectedCount,
    batchLimit,
    monthlyCreditRemaining,
    canQueue: selectedCount > 0 && !warning,
    requiresApproval,
    estimatedCreditImpact: `${selectedCount} potential audits (approval-gated, no live generation in phase 2).`,
    warning,
  };
}

export async function getWorkspaceMonthlyCreditAllocation(
  workspaceId: string,
): Promise<WorkspaceMonthlyCreditAllocation> {
  const usedCredits = 0;
  return {
    workspaceId,
    monthlyCreditLimit: LEADGEN_MONTHLY_CREDIT_LIMIT,
    usedCredits,
    remainingCredits: Math.max(0, LEADGEN_MONTHLY_CREDIT_LIMIT - usedCredits),
  };
}
