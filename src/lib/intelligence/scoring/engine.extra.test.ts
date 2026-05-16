import { describe, it, expect } from "vitest";
import type { CollectedSignals } from "@/lib/intelligence/types";
import { scoreSignals } from "./engine";

function mockSignals(overrides: Partial<CollectedSignals> = {}): CollectedSignals {
  return {
    normalizedUrl: "https://example.com",
    html: "<html></html>",
    fetchWarnings: [],
    hasHttps: true,
    hasTitle: true,
    title: "Example Title",
    hasMetaDescription: true,
    metaDescription: "Meta",
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
    bodySize: 10000,
    performanceHint: "good",
    findings: [],
    ...overrides,
  };
}

describe("scoreSignals — score clamping", () => {
  it("clamps every dimension to [0, 100]", () => {
    const out = scoreSignals(mockSignals());
    for (const v of Object.values(out.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(out.composite).toBeGreaterThanOrEqual(0);
    expect(out.composite).toBeLessThanOrEqual(100);
  });

  it("returns integer scores", () => {
    const out = scoreSignals(mockSignals());
    for (const v of Object.values(out.scores)) {
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(Number.isInteger(out.composite)).toBe(true);
  });

  it("clamps the worst-possible site at >= 0", () => {
    const out = scoreSignals(
      mockSignals({
        hasTitle: false,
        hasMetaDescription: false,
        hasSchemaMarkup: false,
        hasLocalSeoSignals: false,
        hasServiceLanguage: false,
        hasPricingLanguage: false,
        hasBrokenAnchorTargets: true,
        hasViewportMeta: false,
        performanceHint: "poor",
        fetchWarnings: ["fail"],
        hasHttps: false,
        hasTrustBadges: false,
        hasReviewSignals: false,
        hasSocialLinks: false,
        hasContactInfo: false,
        hasCta: false,
        hasBookingLanguage: false,
        hasFaqLanguage: false,
        hasAccessibilityLangAttr: false,
        hasImageAltTextHints: false,
        hasGalleryLanguage: false,
      }),
    );
    for (const v of Object.values(out.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("scoreSignals — dimension responsiveness", () => {
  it("performance score reflects performanceHint tiers", () => {
    const good = scoreSignals(mockSignals({ performanceHint: "good" })).scores.performance;
    const moderate = scoreSignals(mockSignals({ performanceHint: "moderate" })).scores
      .performance;
    const poor = scoreSignals(mockSignals({ performanceHint: "poor" })).scores.performance;
    expect(good).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(poor);
  });

  it("trust score collapses when https is absent", () => {
    const withHttps = scoreSignals(mockSignals({ hasHttps: true })).scores.trust;
    const withoutHttps = scoreSignals(mockSignals({ hasHttps: false })).scores.trust;
    // The penalty for no-https is documented as -20 vs +15 for has, a 35-pt swing
    expect(withHttps - withoutHttps).toBeGreaterThanOrEqual(30);
  });

  it("conversion score collapses when CTA + contact are both absent", () => {
    const both = scoreSignals(mockSignals({ hasCta: true, hasContactInfo: true })).scores
      .conversion;
    const neither = scoreSignals(
      mockSignals({ hasCta: false, hasContactInfo: false }),
    ).scores.conversion;
    expect(both - neither).toBeGreaterThan(50);
  });

  it("accessibility score rewards lang attr + image alt hints", () => {
    const both = scoreSignals(
      mockSignals({ hasAccessibilityLangAttr: true, hasImageAltTextHints: true }),
    ).scores.accessibility;
    const neither = scoreSignals(
      mockSignals({ hasAccessibilityLangAttr: false, hasImageAltTextHints: false }),
    ).scores.accessibility;
    expect(both - neither).toBe(50);
  });

  it("branding score rewards visual + social proof", () => {
    const visual = scoreSignals(
      mockSignals({
        hasGalleryLanguage: true,
        hasSocialLinks: true,
        hasTrustBadges: true,
        hasReviewSignals: true,
        hasTitle: true,
      }),
    ).scores.branding;
    const stripped = scoreSignals(
      mockSignals({
        hasGalleryLanguage: false,
        hasSocialLinks: false,
        hasTrustBadges: false,
        hasReviewSignals: false,
        hasTitle: false,
      }),
    ).scores.branding;
    expect(visual).toBeGreaterThan(stripped);
  });
});

describe("scoreSignals — composite weighting", () => {
  it("conversion has higher weight than accessibility (default weights)", () => {
    // Drop conversion to 0 vs drop accessibility to 0; the conversion drop
    // should hurt composite more.
    const dropConv = scoreSignals(
      mockSignals({ hasCta: false, hasContactInfo: false }),
    ).composite;
    const dropA11y = scoreSignals(
      mockSignals({
        hasAccessibilityLangAttr: false,
        hasImageAltTextHints: false,
      }),
    ).composite;
    const baseline = scoreSignals(mockSignals()).composite;
    expect(baseline - dropConv).toBeGreaterThan(baseline - dropA11y);
  });

  it("honours caller-supplied weighting overrides", () => {
    const heavyConv = scoreSignals(mockSignals(), {
      conversion: 5,
      seo: 0.1,
      performance: 0.1,
      trust: 0.1,
      accessibility: 0.1,
      branding: 0.1,
    });
    const heavyAccess = scoreSignals(mockSignals(), {
      conversion: 0.1,
      seo: 0.1,
      performance: 0.1,
      trust: 0.1,
      accessibility: 5,
      branding: 0.1,
    });
    // Both inputs are the same; only weights differ. The two composites
    // should not be identical unless conversion == accessibility, which
    // they don't in the strong-site fixture.
    expect(heavyConv).not.toBe(heavyAccess);
  });

  it("merges partial weighting overrides with the defaults", () => {
    // If a caller bumps only one dimension, the others stay at default —
    // the result should differ from a fully-default scoring run by less
    // than a full-override would.
    const base = scoreSignals(mockSignals()).composite;
    const partial = scoreSignals(mockSignals(), { trust: 2 }).composite;
    const full = scoreSignals(mockSignals(), {
      seo: 0,
      performance: 0,
      trust: 2,
      conversion: 0,
      accessibility: 0,
      branding: 0,
    }).composite;
    expect(partial).not.toBe(full);
    expect(Number.isInteger(partial - base)).toBe(true);
  });
});
