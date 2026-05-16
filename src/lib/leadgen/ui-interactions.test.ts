import { describe, expect, it } from "vitest";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import {
  canExportSelected,
  mergeImportedLeads,
  selectAllVisibleLeads,
  toggleLeadSelection,
} from "@/lib/leadgen/ui-interactions";

describe("leadgen UI interaction helpers", () => {
  it("toggles selection of a lead", () => {
    const leads = getMockLeadOpportunities();
    const selected = toggleLeadSelection(new Set<string>(), leads[0].id);
    expect(selected.has(leads[0].id)).toBe(true);
  });

  it("selects and clears all visible leads", () => {
    const leads = getMockLeadOpportunities();
    const ids = leads.slice(0, 2).map((lead) => lead.id);
    const selected = selectAllVisibleLeads(new Set<string>(), ids, false);
    expect(selected.size).toBe(2);
    const cleared = selectAllVisibleLeads(selected, ids, true);
    expect(cleared.size).toBe(0);
  });

  it("merges imported leads without duplicating ids", () => {
    const leads = getMockLeadOpportunities();
    const merged = mergeImportedLeads(leads, [leads[0], { ...leads[1], id: "new-id" }]);
    const ids = merged.map((lead) => lead.id);
    expect(ids.filter((id) => id === leads[0].id)).toHaveLength(1);
    expect(ids).toContain("new-id");
  });

  it("enables export only when selection exists", () => {
    expect(canExportSelected(0)).toBe(false);
    expect(canExportSelected(3)).toBe(true);
  });
});
