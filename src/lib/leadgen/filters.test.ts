import { describe, expect, it } from "vitest";
import { applyLeadOpportunityFilters } from "@/lib/leadgen/filters";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";

describe("leadgen filters", () => {
  const leads = getMockLeadOpportunities();

  it("filters by city", () => {
    const filtered = applyLeadOpportunityFilters(leads, { city: "oakland" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].city).toBe("Oakland");
  });

  it("filters by category", () => {
    const filtered = applyLeadOpportunityFilters(leads, { category: "roof" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toContain("Roof");
  });

  it("filters by minimum score", () => {
    const filtered = applyLeadOpportunityFilters(leads, { minNeedScore: 75 });
    expect(filtered.every((lead) => lead.estimatedNeedScore >= 75)).toBe(true);
  });

  it("filters by missing website", () => {
    const filtered = applyLeadOpportunityFilters(leads, { websiteStatus: "missing" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((lead) => !lead.hasWebsite)).toBe(true);
  });

  it("filters by source and status", () => {
    const filtered = applyLeadOpportunityFilters(leads, {
      source: "domain_list",
      status: "new",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].source).toBe("domain_list");
    expect(filtered[0].status).toBe("new");
  });
});
