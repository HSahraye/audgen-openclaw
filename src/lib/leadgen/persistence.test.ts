import { describe, expect, it } from "vitest";
import {
  deserializeLeadgenViewFilters,
  getPresetLeadgenSavedViews,
  serializeLeadgenViewFilters,
} from "@/lib/leadgen/persistence";

describe("leadgen persistence helpers", () => {
  it("serializes and deserializes saved view filters stably", () => {
    const filters = { city: "San Jose", minNeedScore: 70, status: "reviewed" as const };
    const serialized = serializeLeadgenViewFilters(filters);
    const parsed = deserializeLeadgenViewFilters(serialized);
    expect(parsed).toEqual(filters);
  });

  it("falls back to empty filters when deserialization fails", () => {
    expect(deserializeLeadgenViewFilters("not-json")).toEqual({});
  });

  it("returns required preset saved views", () => {
    const names = getPresetLeadgenSavedViews().map((item) => item.name);
    expect(names).toContain("Missing Website");
    expect(names).toContain("High Opportunity");
    expect(names).toContain("Queued");
  });
});
