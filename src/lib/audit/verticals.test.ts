import { describe, expect, it } from "vitest";
import {
  ALL_VERTICALS,
  getVerticalIntelligence,
  inferVerticalFromCategory,
  listVerticalKeys,
} from "./verticals";

describe("vertical taxonomy registry", () => {
  it("seeds the 11 verticals the operator agreed on", () => {
    const keys = listVerticalKeys();
    expect(keys).toEqual(
      expect.arrayContaining([
        "hvac",
        "dental",
        "roofing",
        "med_spa",
        "restaurant",
        "fitness",
        "auto_repair",
        "beauty_salon",
        "legal",
        "accounting",
        "generic_local_services",
      ]),
    );
    expect(keys.length).toBe(11);
  });

  it("each vertical carries the structured intelligence the system prompt iterates over", () => {
    for (const v of ALL_VERTICALS) {
      expect(v.key).toMatch(/^[a-z_]+$/);
      expect(v.displayName.length).toBeGreaterThan(0);
      expect(["phone", "email", "linkedin"]).toContain(v.outreachChannel);
      expect(v.priceRange.min).toBeGreaterThan(0);
      expect(v.priceRange.max).toBeGreaterThanOrEqual(v.priceRange.min);
      expect(v.buyerBehaviour.length).toBeGreaterThanOrEqual(4);
      expect(v.signalsToCheck.length).toBeGreaterThanOrEqual(4);
      expect(v.exampleFindings.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("inferVerticalFromCategory matches the obvious aliases", () => {
    expect(inferVerticalFromCategory("HVAC contractor")).toBe("hvac");
    expect(inferVerticalFromCategory("Air conditioning repair")).toBe("hvac");
    expect(inferVerticalFromCategory("Cosmetic dentist")).toBe("dental");
    expect(inferVerticalFromCategory("Roofing services")).toBe("roofing");
    expect(inferVerticalFromCategory("Family law attorney")).toBe("legal");
    expect(inferVerticalFromCategory("Medical spa & aesthetics")).toBe("med_spa");
    expect(inferVerticalFromCategory("CrossFit gym")).toBe("fitness");
    expect(inferVerticalFromCategory("Italian restaurant")).toBe("restaurant");
    expect(inferVerticalFromCategory("CPA tax services")).toBe("accounting");
    expect(inferVerticalFromCategory("Auto mechanic shop")).toBe("auto_repair");
    expect(inferVerticalFromCategory("Hair salon")).toBe("beauty_salon");
  });

  it("inferVerticalFromCategory returns null for unknown / empty input", () => {
    expect(inferVerticalFromCategory(null)).toBeNull();
    expect(inferVerticalFromCategory(undefined)).toBeNull();
    expect(inferVerticalFromCategory("")).toBeNull();
    expect(inferVerticalFromCategory("Spaceship dealership")).toBeNull();
  });

  it("getVerticalIntelligence falls back to generic when key is unknown", () => {
    expect(getVerticalIntelligence("hvac").key).toBe("hvac");
    expect(getVerticalIntelligence("not-a-real-vertical").key).toBe("generic_local_services");
  });
});
