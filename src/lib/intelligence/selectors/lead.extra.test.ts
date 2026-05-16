import { describe, it, expect } from "vitest";
import {
  getCloseProbability,
  getLeadHealthState,
  getLeadIntelligence,
  getLeadPriorityState,
  getLeadScores,
  getLeadStrengths,
  getMomentumLevel,
  getOutreachAngles,
  getPrimaryPainPoints,
  getRecommendedOffer,
  getUrgencyLevel,
} from "./lead";

function intelLead(overrides: Record<string, unknown> = {}) {
  return {
    intelligenceJson: JSON.stringify({
      scores: {
        seo: 60,
        performance: 60,
        trust: 60,
        conversion: 60,
        accessibility: 60,
        branding: 60,
      },
      painPoints: ["p1", "p2", "p3", "p4", "p5", "p6"],
      strengths: ["s1", "s2", "s3", "s4", "s5"],
      urgencyScore: 50,
      momentumScore: 50,
      likelyBudget: "medium",
      recommendedOffer: "Test Offer",
      outreachAngles: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"],
      objections: [],
      closeProbability: 50,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: new Date().toISOString(),
    }),
    viewCount: 0,
    paymentClickCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("intelligence selector caps", () => {
  it("getPrimaryPainPoints caps at 4", () => {
    expect(getPrimaryPainPoints(intelLead())).toHaveLength(4);
  });

  it("getOutreachAngles caps at 5", () => {
    expect(getOutreachAngles(intelLead())).toHaveLength(5);
  });

  it("getLeadStrengths caps at 4", () => {
    expect(getLeadStrengths(intelLead())).toHaveLength(4);
  });

  it("getCloseProbability returns the raw number from intelligence", () => {
    expect(getCloseProbability(intelLead())).toBe(50);
  });

  it("getRecommendedOffer returns the raw string from intelligence", () => {
    expect(getRecommendedOffer(intelLead())).toBe("Test Offer");
  });
});

describe("getUrgencyLevel thresholds", () => {
  it("returns 'high' for urgencyScore >= 70", () => {
    expect(getUrgencyLevel(intelLead({ intelligenceJson: JSON.stringify({
      scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
      painPoints: [], strengths: [], urgencyScore: 70, likelyBudget: "medium",
      recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: "2026-05-16T00:00:00Z",
    }) }))).toBe("high");
  });

  it("returns 'medium' for 40..69", () => {
    const make = (u: number) => intelLead({ intelligenceJson: JSON.stringify({
      scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
      painPoints: [], strengths: [], urgencyScore: u, likelyBudget: "medium",
      recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: "2026-05-16T00:00:00Z",
    }) });
    expect(getUrgencyLevel(make(40))).toBe("medium");
    expect(getUrgencyLevel(make(69))).toBe("medium");
  });

  it("returns 'low' below 40", () => {
    const lead = intelLead({ intelligenceJson: JSON.stringify({
      scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
      painPoints: [], strengths: [], urgencyScore: 39, likelyBudget: "medium",
      recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: "2026-05-16T00:00:00Z",
    }) });
    expect(getUrgencyLevel(lead)).toBe("low");
  });
});

describe("getLeadHealthState thresholds", () => {
  function make(conversion: number, trust: number, seo: number) {
    return intelLead({ intelligenceJson: JSON.stringify({
      scores: { seo, performance: 50, trust, conversion, accessibility: 50, branding: 50 },
      painPoints: [], strengths: [], urgencyScore: 50, likelyBudget: "medium",
      recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: "2026-05-16T00:00:00Z",
    }) });
  }

  it("returns 'critical' when avg(conversion, trust, seo) < 45", () => {
    // (30 + 30 + 30)/3 = 30 → critical
    expect(getLeadHealthState(make(30, 30, 30))).toBe("critical");
  });

  it("returns 'at-risk' between 45 and 67", () => {
    // (50 + 50 + 50)/3 = 50 → at-risk
    expect(getLeadHealthState(make(50, 50, 50))).toBe("at-risk");
    // (45 + 45 + 45)/3 = 45 → at-risk (45 not < 45)
    expect(getLeadHealthState(make(45, 45, 45))).toBe("at-risk");
  });

  it("returns 'healthy' at 68 or above", () => {
    // (68 + 68 + 68)/3 = 68 → healthy
    expect(getLeadHealthState(make(68, 68, 68))).toBe("healthy");
    expect(getLeadHealthState(make(90, 90, 90))).toBe("healthy");
  });
});

describe("getLeadPriorityState branches", () => {
  function withUrgency(u: number, extras: Record<string, unknown> = {}) {
    return {
      ...intelLead({
        intelligenceJson: JSON.stringify({
          scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
          painPoints: [], strengths: [], urgencyScore: u, momentumScore: 80, likelyBudget: "medium",
          recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
          findings: { technical: [], seo: [], conversion: [], trust: [] },
          generatedAt: "2026-05-16T00:00:00Z",
        }),
        ...extras,
      }),
    };
  }

  it("PAYMENT_READY wins as soon as paymentClickCount > 0", () => {
    const lead = withUrgency(20, { paymentClickCount: 1 });
    expect(getLeadPriorityState(lead)).toBe("PAYMENT_READY");
  });

  it("HIGH_INTENT for viewCount >= 2 AND urgency >= 60", () => {
    const lead = withUrgency(65, { viewCount: 2, paymentClickCount: 0 });
    expect(getLeadPriorityState(lead)).toBe("HIGH_INTENT");
  });

  it("HOT for momentum='rising' AND urgency >= 60 (with viewCount < 2)", () => {
    // momentumScore=80 → rising; urgency 65; viewCount 1 (so HIGH_INTENT doesn't fire)
    const lead = withUrgency(65, { viewCount: 1, paymentClickCount: 0 });
    expect(getLeadPriorityState(lead)).toBe("HOT");
  });

  it("RISING when rising but urgency < 60", () => {
    const lead = withUrgency(40, { viewCount: 0, paymentClickCount: 0 });
    expect(getLeadPriorityState(lead)).toBe("RISING");
  });
});

describe("getLeadIntelligence fallback behavior", () => {
  it("returns intelligence values when intelligenceJson is present", () => {
    const intel = getLeadIntelligence(intelLead());
    expect(intel.recommendedOffer).toBe("Test Offer");
  });

  it("returns a usable fallback when intelligenceJson is missing", () => {
    const intel = getLeadIntelligence({});
    expect(intel.scores.seo).toBeGreaterThanOrEqual(0);
    expect(intel.scores.seo).toBeLessThanOrEqual(100);
    expect(typeof intel.recommendedOffer).toBe("string");
    expect(intel.findings).toBeDefined();
  });

  it("returns a fallback when intelligenceJson is malformed", () => {
    const intel = getLeadIntelligence({ intelligenceJson: "{not-json" });
    expect(typeof intel.recommendedOffer).toBe("string");
    expect(intel.scores).toBeDefined();
  });
});

describe("getMomentumLevel", () => {
  it("uses momentumScore-based label when intelligence supplies it", () => {
    const high = intelLead({
      intelligenceJson: JSON.stringify({
        scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
        painPoints: [], strengths: [], urgencyScore: 50, momentumScore: 80, likelyBudget: "medium",
        recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
        findings: { technical: [], seo: [], conversion: [], trust: [] },
        generatedAt: "2026-05-16T00:00:00Z",
      }),
    });
    expect(getMomentumLevel(high)).toBe("rising");
  });

  it("falls back to computeLeadMomentum trend when no momentumScore", () => {
    const lead = intelLead({
      intelligenceJson: JSON.stringify({
        scores: { seo: 50, performance: 50, trust: 50, conversion: 50, accessibility: 50, branding: 50 },
        painPoints: [], strengths: [], urgencyScore: 50, likelyBudget: "medium",
        recommendedOffer: "x", outreachAngles: [], objections: [], closeProbability: 50,
        findings: { technical: [], seo: [], conversion: [], trust: [] },
        generatedAt: "2026-05-16T00:00:00Z",
      }),
    });
    const out = getMomentumLevel(lead);
    expect(["rising", "stable", "cooling"]).toContain(out);
  });
});

describe("getLeadScores", () => {
  it("returns the scores object from intelligence", () => {
    expect(getLeadScores(intelLead()).seo).toBe(60);
  });
});
