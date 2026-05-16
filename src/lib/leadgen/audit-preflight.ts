export type LeadgenAuditPreflight = {
  selectedCount: number;
  batchLimit: number;
  canQueue: boolean;
  requiresApproval: boolean;
  estimatedCreditImpact: string;
  warning: string | null;
};

export function buildLeadgenAuditPreflight(
  selectedCount: number,
  remainingEntitlement: number,
  options: { batchLimit?: number; requiresApproval?: boolean } = {},
): LeadgenAuditPreflight {
  const batchLimit = options.batchLimit ?? 20;
  const requiresApproval = options.requiresApproval ?? true;
  const exceedsBatch = selectedCount > batchLimit;
  const exceedsEntitlement = selectedCount > remainingEntitlement;
  const warning = exceedsBatch
    ? `Selected ${selectedCount} leads, but phase-2 batch limit is ${batchLimit}.`
    : exceedsEntitlement
      ? `Selected ${selectedCount} leads, but workspace entitlement remaining is ${remainingEntitlement}.`
      : null;

  return {
    selectedCount,
    batchLimit,
    canQueue: selectedCount > 0 && !warning,
    requiresApproval,
    estimatedCreditImpact: `${selectedCount} potential audits (approval-gated, no live generation in phase 2).`,
    warning,
  };
}
