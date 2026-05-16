import { describe, it, expect } from "vitest";
import type { LeadIntelligence } from "@/lib/intelligence/types";
import { buildProposalIntelligence } from "./engine";

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
    painPoints: ["Slow LCP", "Missing CTA"],
    strengths: [],
    urgencyScore: 50,
    likelyBudget: "medium",
    recommendedOffer: "Presence Labs Conversion Upgrade",
    outreachAngles: [],
    objections: [],
    closeProbability: 50,
    findings: { technical: [], seo: [], conversion: [], trust: [] },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildProposalIntelligence", () => {
  it("uses customPrice when provided", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 4200,
      intelligence: intel({ urgencyScore: 50 }),
    });
    // baseline urgency (45-69) keeps the multiplier at 1.0
    expect(out.pricingRecommendation).toBe(4200);
  });

  it("scales price up by 10% when urgency >= 70", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 2000,
      intelligence: intel({ urgencyScore: 85 }),
    });
    expect(out.pricingRecommendation).toBe(2200);
  });

  it("scales price down by ~8% when urgency < 45", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 2000,
      intelligence: intel({ urgencyScore: 30 }),
    });
    expect(out.pricingRecommendation).toBe(1840);
  });

  it("rounds price to the nearest integer", () => {
    // 1500 * 1.1 = 1650 exactly, but let's pick a value that needs rounding
    const out = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 1234,
      intelligence: intel({ urgencyScore: 80 }),
    });
    // 1234 * 1.1 = 1357.4 → 1357
    expect(out.pricingRecommendation).toBe(1357);
  });

  it("falls back to intelligence.recommendedOffer when no packageName/customPrice supplied", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel({
        urgencyScore: 50,
        recommendedOffer: "Presence Labs Launch Package",
      }),
    });
    // Launch package is $1500; urgency 50 keeps multiplier at 1
    expect(out.pricingRecommendation).toBe(1500);
  });

  it("suggests a 3-4 week timeline for prices >= $3000", () => {
    const longTimeline = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 3000,
      intelligence: intel(),
    });
    expect(longTimeline.timelineSuggestion).toBe(
      "3-4 weeks implementation window",
    );
  });

  it("suggests a 2-3 week timeline for prices below $3000", () => {
    const shortTimeline = buildProposalIntelligence({
      businessName: "Acme",
      customPrice: 1500,
      intelligence: intel(),
    });
    expect(shortTimeline.timelineSuggestion).toBe(
      "2-3 weeks implementation window",
    );
  });

  it("composes scopeRecommendations from intelligence pain points", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel({ painPoints: ["Pain A", "Pain B", "Pain C"] }),
    });
    expect(out.scopeRecommendations[0]).toContain("Pain A");
    expect(out.scopeRecommendations[0]).toContain("Pain B");
    // Only the first 2 pain points appear
    expect(out.scopeRecommendations[0]).not.toContain("Pain C");
  });

  it("uses fallback scope copy when no pain points provided", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel({ painPoints: [] }),
    });
    expect(out.scopeRecommendations[0]).toContain("CTA and contact clarity");
  });

  it("uses 'local business' as default category in roiFraming", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel(),
    });
    expect(out.roiFraming).toContain("local business");
  });

  it("includes the category in roiFraming when supplied", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      category: "HVAC",
      intelligence: intel(),
    });
    expect(out.roiFraming).toContain("HVAC");
  });

  it("emits high-urgency framing when urgencyScore >= 70", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel({ urgencyScore: 75 }),
    });
    expect(out.urgencyFraming).toContain("Act immediately");
  });

  it("emits standard framing when urgencyScore < 70", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel({ urgencyScore: 50 }),
    });
    expect(out.urgencyFraming).toContain("Prioritize this sprint");
  });

  it("respects template.sectionOrder when provided", () => {
    const order = ["timeline", "roi", "deliverables"];
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel(),
      template: { sectionOrder: order },
    });
    expect(out.sectionOrder).toEqual(order);
  });

  it("falls back to canonical section order without template override", () => {
    const out = buildProposalIntelligence({
      businessName: "Acme",
      intelligence: intel(),
    });
    expect(out.sectionOrder).toEqual([
      "roi",
      "timeline",
      "deliverables",
      "guarantees",
      "onboarding",
      "socialProof",
    ]);
  });
});
