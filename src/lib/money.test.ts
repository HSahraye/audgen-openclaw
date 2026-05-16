import { describe, it, expect } from "vitest";
import { estimatedDealValue, formatMoney, packageValues, weightedDealValue } from "./money";

describe("estimatedDealValue", () => {
  it("prefers an explicit positive customPrice", () => {
    expect(estimatedDealValue("Presence Labs Launch Package", 4200)).toBe(4200);
    expect(estimatedDealValue(null, 999)).toBe(999);
  });

  it("ignores non-positive customPrice and falls back to package mapping", () => {
    expect(estimatedDealValue("Presence Labs Launch Package", 0)).toBe(packageValues["Presence Labs Launch Package"]);
    expect(estimatedDealValue("Presence Labs Launch Package", -50)).toBe(packageValues["Presence Labs Launch Package"]);
  });

  it("returns 0 when both inputs are absent/empty", () => {
    expect(estimatedDealValue()).toBe(0);
    expect(estimatedDealValue(null)).toBe(0);
    expect(estimatedDealValue("")).toBe(0);
    expect(estimatedDealValue(undefined, null)).toBe(0);
  });

  it("matches package names via case-insensitive contains", () => {
    expect(estimatedDealValue("Conversion Upgrade")).toBe(packageValues["Presence Labs Conversion Upgrade"]);
    expect(estimatedDealValue("presence labs LAUNCH package")).toBe(packageValues["Presence Labs Launch Package"]);
    expect(estimatedDealValue("Local Trust Tune-Up")).toBe(packageValues["Presence Labs Local Trust Tune-Up"]);
    // "tune" alone should still hit the trust package
    expect(estimatedDealValue("Tune-up Package")).toBe(packageValues["Presence Labs Local Trust Tune-Up"]);
  });

  it("checks 'conversion' before 'launch' (priority order)", () => {
    // a name containing both words should resolve to the conversion package
    // (current behavior — locks in priority)
    expect(estimatedDealValue("Conversion Launch Bundle")).toBe(packageValues["Presence Labs Conversion Upgrade"]);
  });

  it("falls back to $1500 default for unknown package names", () => {
    expect(estimatedDealValue("Mystery Package")).toBe(1500);
    expect(estimatedDealValue("custom retainer plan")).toBe(1500);
  });
});

describe("formatMoney", () => {
  it("formats whole dollars in USD without fractional cents", () => {
    expect(formatMoney(1500)).toBe("$1,500");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1000000)).toBe("$1,000,000");
  });

  it("rounds toward whole dollars (Intl default)", () => {
    expect(formatMoney(99.4)).toBe("$99");
    expect(formatMoney(99.6)).toBe("$100");
  });

  it("handles negative values", () => {
    expect(formatMoney(-250)).toBe("-$250");
  });
});

describe("weightedDealValue", () => {
  it("returns full value for Won", () => {
    expect(weightedDealValue("Won", 1000)).toBe(1000);
  });

  it("applies stage weights for pipeline statuses", () => {
    expect(weightedDealValue("Follow-up", 1000)).toBe(700);
    expect(weightedDealValue("Contacted", 1000)).toBe(400);
    expect(weightedDealValue("New", 1000)).toBe(200);
  });

  it("returns 0 for unknown/terminal statuses", () => {
    expect(weightedDealValue("Lost", 1000)).toBe(0);
    expect(weightedDealValue("Unknown", 1000)).toBe(0);
    expect(weightedDealValue("", 1000)).toBe(0);
  });

  it("respects a 0 base value", () => {
    expect(weightedDealValue("Won", 0)).toBe(0);
    expect(weightedDealValue("Follow-up", 0)).toBe(0);
  });
});
