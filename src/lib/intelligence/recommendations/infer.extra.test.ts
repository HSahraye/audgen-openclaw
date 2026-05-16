import { describe, it, expect } from "vitest";
import {
  inferObjections,
  inferOutreachAngles,
  inferRecommendedOffer,
} from "./infer";
import type { CollectedSignals, Finding } from "@/lib/intelligence/types";

const baseSignals: CollectedSignals = {
  normalizedUrl: "https://example.com",
  html: "<html></html>",
  fetchWarnings: [],
  hasHttps: true,
  hasTitle: true,
  title: "Example",
  hasMetaDescription: true,
  metaDescription: "meta",
  hasViewportMeta: true,
  hasSchemaMarkup: true,
  hasBrokenAnchorTargets: false,
  hasSocialLinks: true,
  hasReviewSignals: true,
  hasTrustBadges: true,
  hasContactInfo: true,
  hasPhonePattern: true,
  hasEmailPattern: true,
  hasCta: true,
  hasBookingLanguage: true,
  hasServiceLanguage: true,
  hasPricingLanguage: true,
  hasFaqLanguage: true,
  hasGalleryLanguage: true,
  hasLocalSeoSignals: true,
  hasAccessibilityLangAttr: true,
  hasImageAltTextHints: true,
  bodySize: 12000,
  performanceHint: "good",
  findings: [],
};

describe("inferRecommendedOffer", () => {
  it("recommends Launch when there is no URL", () => {
    expect(
      inferRecommendedOffer(80, "medium", { ...baseSignals, normalizedUrl: "" }),
    ).toBe("Presence Labs Launch Package");
  });

  it("recommends Launch when composite score is below 45", () => {
    expect(inferRecommendedOffer(44, "medium", baseSignals)).toBe(
      "Presence Labs Launch Package",
    );
    expect(inferRecommendedOffer(0, "high", baseSignals)).toBe(
      "Presence Labs Launch Package",
    );
  });

  it("recommends Conversion Upgrade for high budget OR mid scores", () => {
    expect(inferRecommendedOffer(80, "high", baseSignals)).toBe(
      "Presence Labs Conversion Upgrade",
    );
    expect(inferRecommendedOffer(64, "medium", baseSignals)).toBe(
      "Presence Labs Conversion Upgrade",
    );
  });

  it("recommends Local Trust Tune-Up for mid+ scores with low/medium budget", () => {
    expect(inferRecommendedOffer(70, "medium", baseSignals)).toBe(
      "Presence Labs Local Trust Tune-Up",
    );
    expect(inferRecommendedOffer(95, "low", baseSignals)).toBe(
      "Presence Labs Local Trust Tune-Up",
    );
  });
});

describe("inferOutreachAngles", () => {
  const noFindings: Finding[] = [];

  it("returns an angle for every missing signal", () => {
    const angles = inferOutreachAngles(
      noFindings,
      {
        ...baseSignals,
        hasContactInfo: false,
        hasCta: false,
        hasReviewSignals: false,
        hasHttps: false,
      },
      50,
    );
    expect(angles.length).toBeGreaterThanOrEqual(4);
    expect(angles.some((a) => a.includes("contact"))).toBe(true);
    expect(angles.some((a) => a.includes("call-to-action"))).toBe(true);
    expect(angles.some((a) => a.includes("review"))).toBe(true);
    expect(angles.some((a) => a.toLowerCase().includes("security"))).toBe(true);
  });

  it("adds a high-urgency angle when urgency >= 70", () => {
    const angles = inferOutreachAngles(noFindings, baseSignals, 80);
    expect(angles.some((a) => a.includes("immediate revenue lift"))).toBe(true);
  });

  it("falls back to a finding-based angle when no signal gaps and findings exist", () => {
    const findings: Finding[] = [
      {
        id: "f1",
        category: "conversion",
        severity: "warning",
        title: "Slow LCP on mobile",
        detail: "LCP exceeds 4s on mobile devices.",
      },
    ];
    const angles = inferOutreachAngles(findings, baseSignals, 40);
    expect(angles).toHaveLength(1);
    expect(angles[0]).toContain("slow lcp on mobile");
  });

  it("returns an empty array when neither signal gaps nor findings exist", () => {
    expect(inferOutreachAngles(noFindings, baseSignals, 40)).toEqual([]);
  });

  it("caps angles at 5", () => {
    const angles = inferOutreachAngles(
      noFindings,
      {
        ...baseSignals,
        hasContactInfo: false,
        hasCta: false,
        hasReviewSignals: false,
        hasHttps: false,
      },
      80, // also triggers high-urgency angle → 5 total
    );
    expect(angles.length).toBeLessThanOrEqual(5);
  });
});

describe("inferObjections", () => {
  it("always returns the 3 baseline objections", () => {
    const baseline = [
      "We already have a website.",
      "This is not in budget right now.",
      "I need to discuss with my partner first.",
    ];
    for (const budget of ["low", "medium", "high"] as const) {
      const objections = inferObjections(
        { businessName: "Acme" },
        budget,
      );
      for (const b of baseline) expect(objections).toContain(b);
    }
  });

  it("adds a timing objection for low budget", () => {
    const objections = inferObjections({ businessName: "Acme" }, "low");
    expect(objections).toContain("Timing is not right this month.");
  });

  it("adds a payback-question objection for medium budget that includes the category", () => {
    const objections = inferObjections(
      { businessName: "Acme", category: "HVAC" },
      "medium",
    );
    expect(objections.some((o) => o.includes("HVAC business"))).toBe(true);
  });

  it("falls back to 'local business' phrasing when category is missing", () => {
    const objections = inferObjections({ businessName: "Acme" }, "medium");
    expect(objections.some((o) => o.includes("local business"))).toBe(true);
  });

  it("adds a prioritization objection for high budget", () => {
    const objections = inferObjections({ businessName: "Acme" }, "high");
    expect(objections).toContain("Can you prioritize highest-ROI fixes first?");
  });
});
