import type { LeadOpportunity } from "@/lib/leadgen/types";

export function toggleLeadSelection(current: Set<string>, leadId: string) {
  const next = new Set(current);
  if (next.has(leadId)) next.delete(leadId);
  else next.add(leadId);
  return next;
}

export function selectAllVisibleLeads(current: Set<string>, visibleLeadIds: string[], allSelected: boolean) {
  const next = new Set(current);
  if (allSelected) {
    visibleLeadIds.forEach((id) => next.delete(id));
  } else {
    visibleLeadIds.forEach((id) => next.add(id));
  }
  return next;
}

export function mergeImportedLeads(current: LeadOpportunity[], imported: LeadOpportunity[]) {
  const seen = new Set(current.map((lead) => lead.id));
  const fresh = imported.filter((lead) => !seen.has(lead.id));
  return [...fresh, ...current];
}

export function canExportSelected(selectedCount: number) {
  return selectedCount > 0;
}
