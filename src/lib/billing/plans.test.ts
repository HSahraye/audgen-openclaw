import { describe, it, expect } from "vitest";
import { PLAN_DISPLAY, PLAN_LIMITS } from "./plans";

const TIERS = ["free_trial", "starter", "growth", "agency", "enterprise"] as const;

describe("PLAN_LIMITS", () => {
  it("defines limits for every tier", () => {
    for (const tier of TIERS) {
      expect(PLAN_LIMITS[tier]).toBeDefined();
    }
  });

  it("every tier declares all 7 quota fields with positive numbers", () => {
    const required = [
      "auditsPerMonth",
      "importsPerMonth",
      "activeLeads",
      "templates",
      "seats",
      "outreachGenerations",
      "proposalGenerations",
    ] as const;
    for (const tier of TIERS) {
      const limits = PLAN_LIMITS[tier];
      for (const field of required) {
        const value = limits[field];
        expect(typeof value, `${tier}.${field}`).toBe("number");
        expect(value, `${tier}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it("limits never decrease as we move up the tier ladder (free_trial < starter < growth < agency <= enterprise)", () => {
    const ladder = ["free_trial", "starter", "growth", "agency", "enterprise"] as const;
    const fields = Object.keys(PLAN_LIMITS.free_trial) as Array<keyof typeof PLAN_LIMITS.free_trial>;
    for (const field of fields) {
      for (let i = 0; i < ladder.length - 1; i += 1) {
        const lower = PLAN_LIMITS[ladder[i]][field];
        const higher = PLAN_LIMITS[ladder[i + 1]][field];
        expect(
          higher,
          `${field} should not decrease from ${ladder[i]} to ${ladder[i + 1]}`,
        ).toBeGreaterThanOrEqual(lower);
      }
    }
  });

  it("enterprise has effectively-unlimited (>=10000) audits / imports / leads / outreach / proposals", () => {
    const e = PLAN_LIMITS.enterprise;
    expect(e.auditsPerMonth).toBeGreaterThanOrEqual(10_000);
    expect(e.importsPerMonth).toBeGreaterThanOrEqual(10_000);
    expect(e.activeLeads).toBeGreaterThanOrEqual(10_000);
    expect(e.outreachGenerations).toBeGreaterThanOrEqual(10_000);
    expect(e.proposalGenerations).toBeGreaterThanOrEqual(10_000);
  });
});

describe("PLAN_DISPLAY", () => {
  it("defines display info for every tier", () => {
    for (const tier of TIERS) {
      expect(PLAN_DISPLAY[tier]).toBeDefined();
      expect(typeof PLAN_DISPLAY[tier].label).toBe("string");
      expect(PLAN_DISPLAY[tier].label.length).toBeGreaterThan(0);
    }
  });

  it("free_trial and enterprise are $0 (free or sales-led)", () => {
    expect(PLAN_DISPLAY.free_trial.monthlyPriceCents).toBe(0);
    expect(PLAN_DISPLAY.enterprise.monthlyPriceCents).toBe(0);
  });

  it("paid tiers (starter/growth/agency) are priced and strictly increasing", () => {
    expect(PLAN_DISPLAY.starter.monthlyPriceCents).toBeGreaterThan(0);
    expect(PLAN_DISPLAY.growth.monthlyPriceCents).toBeGreaterThan(
      PLAN_DISPLAY.starter.monthlyPriceCents,
    );
    expect(PLAN_DISPLAY.agency.monthlyPriceCents).toBeGreaterThan(
      PLAN_DISPLAY.growth.monthlyPriceCents,
    );
  });

  it("monthly prices are whole cents (no fractional)", () => {
    for (const tier of TIERS) {
      expect(Number.isInteger(PLAN_DISPLAY[tier].monthlyPriceCents)).toBe(true);
    }
  });

  it("labels are human-readable (no enum keys leaked)", () => {
    expect(PLAN_DISPLAY.free_trial.label).toBe("Free Trial");
    expect(PLAN_DISPLAY.starter.label).toBe("Starter");
    expect(PLAN_DISPLAY.growth.label).toBe("Growth");
    expect(PLAN_DISPLAY.agency.label).toBe("Agency");
    expect(PLAN_DISPLAY.enterprise.label).toBe("Enterprise");
  });
});
