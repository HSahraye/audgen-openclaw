import { describe, it, expect } from "vitest";
import {
  effectivePricing,
  getVerticalPack,
  listVerticalSlugs,
  resolveVerticalPack,
  VERTICAL_PACKS,
} from "./index";

describe("vertical packs", () => {
  it("registers at least dental, smoke-shop, hvac", () => {
    const slugs = listVerticalSlugs();
    expect(slugs).toEqual(expect.arrayContaining(["dental", "smoke-shop", "hvac"]));
  });

  it("getVerticalPack returns null for unknown slug, hit for known", () => {
    expect(getVerticalPack(null)).toBeNull();
    expect(getVerticalPack("unknown")).toBeNull();
    expect(getVerticalPack("dental")?.name).toMatch(/Dental/);
  });

  it("every pack has at least one critical audit check and non-zero pricing", () => {
    for (const p of VERTICAL_PACKS) {
      expect(p.criticalAuditChecks.length).toBeGreaterThan(0);
      expect(p.pricing.starterPackageUsd).toBeGreaterThan(0);
      expect(p.pricing.standardPackageUsd).toBeGreaterThanOrEqual(p.pricing.starterPackageUsd);
      expect(p.pricing.premiumPackageUsd).toBeGreaterThanOrEqual(p.pricing.standardPackageUsd);
      expect(p.outreachHints.openingAngles.length).toBeGreaterThan(0);
      expect(p.outreachHints.painPoints.length).toBeGreaterThan(0);
      expect(p.outreachHints.objectionResponses.length).toBeGreaterThan(0);
    }
  });

  it("resolveVerticalPack: exact category match", () => {
    expect(resolveVerticalPack("Dental")?.slug).toBe("dental");
    expect(resolveVerticalPack("HVAC")?.slug).toBe("hvac");
    expect(resolveVerticalPack("Smoke Shop")?.slug).toBe("smoke-shop");
  });

  it("resolveVerticalPack: whole-word containment", () => {
    expect(resolveVerticalPack("pediatric dentist near me")?.slug).toBe("dental");
    expect(resolveVerticalPack("local HVAC contractor")?.slug).toBe("hvac");
    expect(resolveVerticalPack("vape shop and accessories")?.slug).toBe("smoke-shop");
  });

  it("resolveVerticalPack: returns null when no match", () => {
    expect(resolveVerticalPack(null)).toBeNull();
    expect(resolveVerticalPack("")).toBeNull();
    expect(resolveVerticalPack("plumbing")).toBeNull();
    expect(resolveVerticalPack("restaurant")).toBeNull();
  });

  it("effectivePricing falls back to a sensible default when pack is null", () => {
    const p = effectivePricing(null);
    expect(p.starterPackageUsd).toBeGreaterThan(0);
    expect(p.typicalCycleDays).toBeGreaterThan(0);
  });

  it("effectivePricing matches the pack when one is supplied", () => {
    const pack = getVerticalPack("dental")!;
    expect(effectivePricing(pack)).toEqual(pack.pricing);
  });
});
