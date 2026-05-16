import { describe, it, expect } from "vitest";
import type { CollectedSignals, Finding } from "@/lib/intelligence/types";
import { deriveStrengths, derivePainPoints, splitFindings } from "./findings";

function finding(
  category: Finding["category"],
  title: string,
  severity: Finding["severity"] = "warning",
): Finding {
  return { id: `${category}-${title}`, category, severity, title, detail: title };
}

const blankSignals: CollectedSignals = {
  normalizedUrl: "",
  html: "",
  fetchWarnings: [],
  hasHttps: false,
  hasTitle: false,
  title: "",
  hasMetaDescription: false,
  metaDescription: "",
  hasViewportMeta: false,
  hasSchemaMarkup: false,
  hasBrokenAnchorTargets: false,
  hasSocialLinks: false,
  hasReviewSignals: false,
  hasTrustBadges: false,
  hasContactInfo: false,
  hasPhonePattern: false,
  hasEmailPattern: false,
  hasCta: false,
  hasBookingLanguage: false,
  hasServiceLanguage: false,
  hasPricingLanguage: false,
  hasFaqLanguage: false,
  hasGalleryLanguage: false,
  hasLocalSeoSignals: false,
  hasAccessibilityLangAttr: false,
  hasImageAltTextHints: false,
  bodySize: 0,
  performanceHint: "unknown",
  findings: [],
};

describe("splitFindings", () => {
  it("routes findings to the documented buckets", () => {
    const findings: Finding[] = [
      finding("technical", "broken anchor"),
      finding("accessibility", "missing lang attr"),
      finding("seo", "missing meta description"),
      finding("conversion", "no CTA"),
      finding("branding", "weak logo"),
      finding("trust", "no reviews"),
    ];
    const out = splitFindings(findings);
    expect(out.technical.map((f) => f.title)).toEqual([
      "broken anchor",
      "missing lang attr",
    ]);
    expect(out.seo.map((f) => f.title)).toEqual(["missing meta description"]);
    expect(out.conversion.map((f) => f.title)).toEqual(["no CTA", "weak logo"]);
    expect(out.trust.map((f) => f.title)).toEqual(["no reviews"]);
  });

  it("returns empty arrays for every bucket on empty input", () => {
    expect(splitFindings([])).toEqual({
      technical: [],
      seo: [],
      conversion: [],
      trust: [],
    });
  });
});

describe("deriveStrengths", () => {
  it("returns no strengths for a totally blank site", () => {
    expect(deriveStrengths(blankSignals)).toEqual([]);
  });

  it("turns each positive signal into a labelled strength", () => {
    const strengths = deriveStrengths({
      ...blankSignals,
      hasHttps: true,
      hasCta: true,
      hasContactInfo: true,
      hasReviewSignals: true,
      hasSchemaMarkup: true,
      hasViewportMeta: true,
    });
    expect(strengths).toEqual([
      "Website uses HTTPS",
      "Clear conversion CTA language exists",
      "Contact details are visible",
      "Review/testimonial signals detected",
      "Structured data markup detected",
      "Mobile viewport metadata exists",
    ]);
  });

  it("caps the list at 6", () => {
    // Currently there are only 6 possible strengths; cap still tested
    // explicitly so a future strength-addition past 6 keeps the contract.
    const strengths = deriveStrengths({
      ...blankSignals,
      hasHttps: true,
      hasCta: true,
      hasContactInfo: true,
      hasReviewSignals: true,
      hasSchemaMarkup: true,
      hasViewportMeta: true,
    });
    expect(strengths.length).toBeLessThanOrEqual(6);
  });
});

describe("derivePainPoints", () => {
  it("excludes info-severity findings", () => {
    const out = derivePainPoints([
      finding("seo", "passing seo check", "info"),
      finding("conversion", "missing CTA", "warning"),
    ]);
    expect(out).toEqual(["missing CTA"]);
  });

  it("includes both warning and critical severities", () => {
    const out = derivePainPoints([
      finding("trust", "no reviews", "warning"),
      finding("technical", "no https", "critical"),
    ]);
    expect(out).toEqual(["no reviews", "no https"]);
  });

  it("caps at 8 even when many findings are present", () => {
    const lots: Finding[] = Array.from({ length: 15 }, (_, i) =>
      finding("conversion", `pain ${i}`, "warning"),
    );
    const out = derivePainPoints(lots);
    expect(out).toHaveLength(8);
    expect(out[0]).toBe("pain 0");
    expect(out[7]).toBe("pain 7");
  });

  it("returns empty array for empty input", () => {
    expect(derivePainPoints([])).toEqual([]);
  });
});
