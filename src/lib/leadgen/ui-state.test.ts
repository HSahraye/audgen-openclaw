import { describe, expect, it } from "vitest";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import { deriveLeadgenUiState } from "@/lib/leadgen/ui-state";

describe("leadgen ui state", () => {
  it("returns empty state when no leads match filters", () => {
    const state = deriveLeadgenUiState([], new Set());
    expect(state.hasLeads).toBe(false);
    expect(state.isEmpty).toBe(true);
  });

  it("reports selected count and export enabled", () => {
    const leads = getMockLeadOpportunities();
    const selected = new Set([leads[0].id]);
    const state = deriveLeadgenUiState(leads, selected);
    expect(state.hasLeads).toBe(true);
    expect(state.selectedCount).toBe(1);
    expect(state.exportDisabled).toBe(false);
  });
});
