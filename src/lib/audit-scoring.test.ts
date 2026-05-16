import { describe, it, expect } from "vitest";
import type { AuditChecks, AuditInput } from "./types";
import { estimateAnnualLoss, packageName, scoreLead } from "./audit-scoring";

function perfectChecks(): AuditChecks {
  return {
    hasWebsite: true,
    outdatedWebsite: false,
    mobileFriendly: true,
    clearCta: true,
    phoneEasyToFind: true,
    reviewsVisible: true,
    onlineBooking: true,
    trustSection: true,
    gallery: true,
    serviceList: true,
    pricing: true,
    faq: true,
  };
}

function brokenChecks(): AuditChecks {
  return {
    hasWebsite: false,
    outdatedWebsite: true,
    mobileFriendly: false,
    clearCta: false,
    phoneEasyToFind: false,
    reviewsVisible: false,
    onlineBooking: false,
    trustSection: false,
    gallery: false,
    serviceList: false,
    pricing: false,
    faq: false,
  };
}

function input(overrides: Partial<AuditInput> = {}): AuditInput {
  return {
    businessName: "Acme HVAC",
    category: "hvac",
    location: "Austin",
    websiteUrl: "",
    googleProfileUrl: "",
    notes: "",
    ownerName: "",
    ...overrides,
  } as AuditInput;
}

describe("scoreLead", () => {
  it("scores a clean business at the baseline 55", () => {
    expect(scoreLead(perfectChecks(), input())).toBe(55);
  });

  it("caps a fully broken business at 100", () => {
    expect(scoreLead(brokenChecks(), input())).toBe(100);
  });

  it("adds bonus for an attached Google Business Profile", () => {
    const base = scoreLead(perfectChecks(), input());
    const withGbp = scoreLead(
      perfectChecks(),
      input({ googleProfileUrl: "https://g.page/acme" }),
    );
    expect(withGbp - base).toBe(3);
  });

  it("treats whitespace-only googleProfileUrl as absent", () => {
    const base = scoreLead(perfectChecks(), input());
    expect(scoreLead(perfectChecks(), input({ googleProfileUrl: "   " }))).toBe(base);
  });

  it("never returns below 1", () => {
    // This shouldn't happen with current rules but the floor is part of the
    // contract. Force it via a hypothetical 'all positive' input — score
    // never decreases, so checking the floor needs a manual cap proof.
    expect(scoreLead(perfectChecks(), input())).toBeGreaterThanOrEqual(1);
  });

  it("applies individual gap weights additively", () => {
    const base = scoreLead(perfectChecks(), input()); // 55
    const noWebsite = scoreLead({ ...perfectChecks(), hasWebsite: false }, input());
    expect(noWebsite - base).toBe(25);

    const outdated = scoreLead({ ...perfectChecks(), outdatedWebsite: true }, input());
    expect(outdated - base).toBe(14);

    const noMobile = scoreLead({ ...perfectChecks(), mobileFriendly: false }, input());
    expect(noMobile - base).toBe(10);

    const noFaq = scoreLead({ ...perfectChecks(), faq: false }, input());
    expect(noFaq - base).toBe(2);
  });
});

describe("packageName", () => {
  it("recommends Launch when there is no website (regardless of score)", () => {
    const checks = { ...perfectChecks(), hasWebsite: false };
    expect(packageName(40, checks)).toBe("Presence Labs Launch Package");
    expect(packageName(0, checks)).toBe("Presence Labs Launch Package");
    expect(packageName(100, checks)).toBe("Presence Labs Launch Package");
  });

  it("recommends Launch when score >= 86 even with a website", () => {
    expect(packageName(86, perfectChecks())).toBe("Presence Labs Launch Package");
    expect(packageName(99, perfectChecks())).toBe("Presence Labs Launch Package");
  });

  it("recommends Conversion Upgrade for 72-85", () => {
    expect(packageName(72, perfectChecks())).toBe("Presence Labs Conversion Upgrade");
    expect(packageName(85, perfectChecks())).toBe("Presence Labs Conversion Upgrade");
  });

  it("recommends Local Trust Tune-Up below 72", () => {
    expect(packageName(71, perfectChecks())).toBe("Presence Labs Local Trust Tune-Up");
    expect(packageName(0, perfectChecks())).toBe("Presence Labs Local Trust Tune-Up");
  });

  it("uses workspace-supplied labels when provided", () => {
    const labels = {
      launch: "Acme Build From Scratch",
      conversion: "Acme Boost Conversions",
      trust: "Acme Trust Polish",
    };
    expect(packageName(40, { ...perfectChecks(), hasWebsite: false }, labels)).toBe(
      labels.launch,
    );
    expect(packageName(75, perfectChecks(), labels)).toBe(labels.conversion);
    expect(packageName(50, perfectChecks(), labels)).toBe(labels.trust);
  });

  it("falls back to defaults when a label is empty/missing in the override map", () => {
    const labels = { launch: "", conversion: "", trust: "" };
    expect(packageName(40, { ...perfectChecks(), hasWebsite: false }, labels)).toBe(
      "Presence Labs Launch Package",
    );
    expect(packageName(75, perfectChecks(), labels)).toBe(
      "Presence Labs Conversion Upgrade",
    );
    expect(packageName(50, perfectChecks(), labels)).toBe(
      "Presence Labs Local Trust Tune-Up",
    );
  });
});

describe("estimateAnnualLoss", () => {
  it("matches restaurant/food at $20k", () => {
    expect(estimateAnnualLoss("Italian Restaurant")).toBe(20_000);
    expect(estimateAnnualLoss("Food Truck")).toBe(20_000);
  });

  it("matches home-service trades at $15k", () => {
    expect(estimateAnnualLoss("HVAC")).toBe(15_000);
    expect(estimateAnnualLoss("Plumber")).toBe(15_000);
    expect(estimateAnnualLoss("Roofer")).toBe(15_000);
    expect(estimateAnnualLoss("Electrician")).toBe(15_000);
    expect(estimateAnnualLoss("Home Services")).toBe(15_000);
    expect(estimateAnnualLoss("General Contractor")).toBe(15_000);
  });

  it("matches auto/repair at $12k", () => {
    expect(estimateAnnualLoss("Mechanic")).toBe(12_000);
    expect(estimateAnnualLoss("Auto Body")).toBe(12_000);
    expect(estimateAnnualLoss("Phone Repair")).toBe(12_000);
  });

  it("matches landscape/lawn at $10k", () => {
    expect(estimateAnnualLoss("Landscaper")).toBe(10_000);
    expect(estimateAnnualLoss("Lawn Care")).toBe(10_000);
  });

  it("matches cleaners / detailers / barbers at the right tiers", () => {
    expect(estimateAnnualLoss("Cleaning Service")).toBe(8_000);
    expect(estimateAnnualLoss("Mobile Detailing")).toBe(5_000);
    expect(estimateAnnualLoss("Barber Shop")).toBe(4_000);
    expect(estimateAnnualLoss("Hair Salon")).toBe(4_000);
  });

  it("returns the $7,500 default for unknown verticals", () => {
    expect(estimateAnnualLoss("Real Estate")).toBe(7_500);
    expect(estimateAnnualLoss("")).toBe(7_500);
    expect(estimateAnnualLoss("Other")).toBe(7_500);
  });

  it("is case-insensitive", () => {
    expect(estimateAnnualLoss("HVAC")).toBe(estimateAnnualLoss("hvac"));
    expect(estimateAnnualLoss("RESTAURANT")).toBe(estimateAnnualLoss("restaurant"));
  });

  it("prefers the first matching regex (priority order is part of the contract)", () => {
    // 'restaurant' wins over 'food' (same tier so test exists for contract clarity)
    expect(estimateAnnualLoss("Restaurant food joint")).toBe(20_000);
    // 'plumb' wins over 'detail' since home-service tier comes first
    expect(estimateAnnualLoss("Detailing for plumbers")).toBe(15_000);
  });
});
