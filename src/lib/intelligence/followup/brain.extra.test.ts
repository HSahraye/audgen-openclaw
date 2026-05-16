import { describe, it, expect } from "vitest";
import type { LeadIntelligence } from "@/lib/intelligence/types";
import { generateFollowupRecommendation } from "./brain";

function intel(overrides: Partial<LeadIntelligence> = {}): LeadIntelligence {
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
    likelyBudget: "medium",
    recommendedOffer: "Conversion Upgrade",
    outreachAngles: ["Pitch conversion fixes"],
    objections: ["Budget timing"],
    closeProbability: 50,
    findings: { technical: [], seo: [], conversion: [], trust: [] },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("generateFollowupRecommendation — branch coverage", () => {
  it("paymentClickCount > 0 (without higher-priority cooling) ⇒ call + 'immediately'", () => {
    // To reach the paymentClickCount branch, we need momentum to be
    // 'stable' or 'rising' (not cooling-with-engagement) so the
    // highEngagementCooling branch doesn't intercept. Pump engagement
    // signals to lift momentumScore comfortably above 38.
    const rec = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 60 }),
      engagement: {
        viewCount: 3,
        revisitCount: 1,
        paymentClickCount: 1,
        responseCount: 1,
        outreachRecencyHours: 4,
      },
    });
    expect(rec.recommendedChannel).toBe("call");
    expect(rec.recommendedNextStep).toContain("payment intent");
    expect(rec.suggestedTiming).toBe("immediately");
  });

  it("reopened-after-gap (viewCount>=3 && outreach>96h) ⇒ call + 'within 6 hours'", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 50 }),
      // 3 views, no revisits beyond view#1 (revisitCount=0), no payments,
      // last outreach 120h ago. revisitCount=0 so viewedPricingTwice false;
      // outreach 120h, not viewed twice → reopenedAfterGap fires.
      engagement: {
        viewCount: 3,
        revisitCount: 0,
        paymentClickCount: 0,
        outreachRecencyHours: 120,
      },
    });
    expect(rec.recommendedChannel).toBe("call");
    expect(rec.recommendedNextStep).toContain("reactivation");
    expect(rec.suggestedTiming).toBe("within 6 hours");
  });

  it("default path ⇒ email + 'within 24 hours'", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 50 }),
      engagement: {
        viewCount: 1,
        revisitCount: 0,
        paymentClickCount: 0,
        outreachRecencyHours: 24,
      },
    });
    expect(rec.recommendedChannel).toBe("email");
    expect(rec.recommendedNextStep).toContain("concise follow-up");
    expect(rec.suggestedTiming).toBe("within 24 hours");
  });

  it("urgencyLevel maps urgencyScore + momentum delta", () => {
    // urgency 35 + momentum (default empty signals → cooling, -10) = 25 → 'low'
    const low = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 35 }),
      engagement: {},
    });
    expect(low.urgencyLevel).toBe("low");

    // urgency 50 + momentum (stable, 0) = 50 → 'medium'
    const med = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 50 }),
      engagement: {
        viewCount: 5,
        revisitCount: 2,
        responseCount: 1,
        outreachRecencyHours: 50,
      },
    });
    expect(med.urgencyLevel).toBe("medium");

    // urgency 75 + momentum rising +12 → 87 → 'high'
    const high = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 75 }),
      engagement: {
        viewCount: 5,
        revisitCount: 4,
        paymentClickCount: 2,
        outreachRecencyHours: 6,
      },
    });
    expect(high.urgencyLevel).toBe("high");
  });

  it("outreachFraming uses first outreach angle", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({
        outreachAngles: ["Lead with mobile speed", "Pitch booking flow"],
      }),
      engagement: { viewCount: 1, outreachRecencyHours: 20 },
    });
    expect(rec.outreachFraming).toBe("Lead with mobile speed");
  });

  it("outreachFraming falls back when no angles supplied", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({ outreachAngles: [] }),
      engagement: { viewCount: 1, outreachRecencyHours: 20 },
    });
    expect(rec.outreachFraming).toContain("highest-impact conversion gap");
  });

  it("objectionHandling uses first objection", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({ objections: ["Stakeholder approval needed"] }),
      engagement: { viewCount: 1, outreachRecencyHours: 20 },
    });
    expect(rec.objectionHandling).toBe("Stakeholder approval needed");
  });

  it("objectionHandling falls back when no objections supplied", () => {
    const rec = generateFollowupRecommendation({
      intelligence: intel({ objections: [] }),
      engagement: { viewCount: 1, outreachRecencyHours: 20 },
    });
    expect(rec.objectionHandling).toContain("budget/timing");
  });

  it("urgency is clamped to [0, 100] after combining with momentum delta", () => {
    // urgency 95 + rising +12 would be 107; should clamp at 100 → still 'high'
    const rec = generateFollowupRecommendation({
      intelligence: intel({ urgencyScore: 95 }),
      engagement: {
        viewCount: 5,
        revisitCount: 4,
        paymentClickCount: 2,
        outreachRecencyHours: 4,
      },
    });
    expect(rec.urgencyLevel).toBe("high");
  });
});
