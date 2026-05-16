import type { LeadOpportunity } from "@/lib/leadgen/types";

export type LeadgenUiState = {
  hasLeads: boolean;
  isEmpty: boolean;
  selectedCount: number;
  exportDisabled: boolean;
};

export function deriveLeadgenUiState(
  filteredLeads: LeadOpportunity[],
  selectedIds: Set<string>,
): LeadgenUiState {
  const selectedCount = filteredLeads.filter((lead) => selectedIds.has(lead.id)).length;
  return {
    hasLeads: filteredLeads.length > 0,
    isEmpty: filteredLeads.length === 0,
    selectedCount,
    exportDisabled: selectedCount === 0,
  };
}
