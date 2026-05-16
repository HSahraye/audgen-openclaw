import { describe, it, expect } from "vitest";
import type { LeadIntelligence } from "@/lib/intelligence/types";
import { buildOutreachPlan } from "./angles";

function fakeIntel(overrides: Partial<LeadIntelligence> = {}): LeadIntelligence {
  return {
    scores: {
      seo: 50,
      performance: 50,
      trust: 50,
      conversion: 50,
      accessibility: 50,
      branding: 50,
    },
    painPoints: [],
    strengths: [],
    urgencyScore: 50,
    momentumScore: 50,
    likelyBudget: "medium",
    recommendedOffer: "Conversion Upgrade",
    outreachAngles: [],
    objections: [],
    closeProbability: 50,
    findings: { technical: [], seo: [], conversion: [], trust: [] },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildOutreachPlan", () => {
  it("tags urgency at the >=70 threshold as 'high-urgency'", () => {
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 70 })).urgencyTag).toBe(
      "high-urgency",
    );
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 90 })).urgencyTag).toBe(
      "high-urgency",
    );
  });

  it("tags 45-69 as 'medium-urgency'", () => {
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 45 })).urgencyTag).toBe(
      "medium-urgency",
    );
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 69 })).urgencyTag).toBe(
      "medium-urgency",
    );
  });

  it("tags below 45 as 'low-urgency'", () => {
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 44 })).urgencyTag).toBe(
      "low-urgency",
    );
    expect(buildOutreachPlan(fakeIntel({ urgencyScore: 0 })).urgencyTag).toBe(
      "low-urgency",
    );
  });

  it("uses the first outreach angle as primaryAngle", () => {
    expect(
      buildOutreachPlan(
        fakeIntel({
          outreachAngles: ["Lead with mobile speed", "Pitch booking flow", "Trust badges"],
        }),
      ).primaryAngle,
    ).toBe("Lead with mobile speed");
  });

  it("falls back to a generic primary angle when none provided", () => {
    expect(buildOutreachPlan(fakeIntel({ outreachAngles: [] })).primaryAngle).toBe(
      "Highlight conversion opportunities with concrete evidence.",
    );
  });

  it("exposes up to 3 backup angles (slice 1..4 means indices 1,2,3)", () => {
    expect(
      buildOutreachPlan(
        fakeIntel({
          outreachAngles: ["A", "B", "C", "D", "E"],
        }),
      ).backupAngles,
    ).toEqual(["B", "C", "D"]);
  });

  it("returns fewer backup angles when fewer exist", () => {
    expect(
      buildOutreachPlan(fakeIntel({ outreachAngles: ["A", "B"] })).backupAngles,
    ).toEqual(["B"]);
  });

  it("returns no backup angles when only the primary is set", () => {
    expect(
      buildOutreachPlan(fakeIntel({ outreachAngles: ["A"] })).backupAngles,
    ).toEqual([]);
  });

  it("caps objections at 4", () => {
    expect(
      buildOutreachPlan(
        fakeIntel({ objections: ["o1", "o2", "o3", "o4", "o5", "o6"] }),
      ).objections,
    ).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("returns an empty objections array when none provided", () => {
    expect(buildOutreachPlan(fakeIntel({ objections: [] })).objections).toEqual([]);
  });
});
