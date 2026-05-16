import { describe, it, expect } from "vitest";
import type { GeneratedAssets } from "@/lib/types";
import { generateObjectionResponses } from "./objections";

function fakeAssets(overrides: Partial<GeneratedAssets> = {}): GeneratedAssets {
  return {
    leadScore: 80,
    painPointSummary: "Pain",
    recommendedPackage: "Pkg",
    likelyMoneyLost: "$5k/mo in missed calls",
    presenceLabsOffer: "the Conversion Upgrade",
    estimatedAnnualLoss: 60_000,
    coldCallScript: "",
    textMessageScript: "",
    emailScript: "",
    thirtySecondPitch: "helping Acme HVAC capture more booking calls",
    followUpMessage: "",
    proposalOutline: [],
    ...overrides,
  };
}

describe("generateObjectionResponses", () => {
  it("returns exactly five objection/response pairs", () => {
    const out = generateObjectionResponses("Acme HVAC", fakeAssets(), "Conversion Upgrade");
    expect(out).toHaveLength(5);
    for (const r of out) {
      expect(r.objection).toBeTruthy();
      expect(r.response).toBeTruthy();
      expect(r.followUp).toBeTruthy();
    }
  });

  it("includes the business name and asset fields in the relevant objection bodies", () => {
    const out = generateObjectionResponses("Acme HVAC", fakeAssets(), "Conversion Upgrade");
    const budgetResponse = out[0].response;
    expect(budgetResponse).toContain("Acme HVAC");
    expect(budgetResponse).toContain("$5k/mo in missed calls");
    expect(budgetResponse).toContain("the Conversion Upgrade");
  });

  it("falls back to pitch / loss / offer defaults when the asset fields are empty", () => {
    const out = generateObjectionResponses(
      "Bee Plumbing",
      fakeAssets({ thirtySecondPitch: "", likelyMoneyLost: "", presenceLabsOffer: "" }),
      "Launch Package",
    );
    const budget = out[0].response;
    expect(budget).toContain("Bee Plumbing");
    // default loss fallback copy
    expect(budget).toContain("missed calls and lost revenue");
    // default offer fallback uses the package name
    expect(budget).toContain("the Launch Package");

    const competitor = out[1].response;
    // default pitch fallback uses 'helping <business> get more calls...'
    expect(competitor).toContain("helping Bee Plumbing get more calls from local search");
  });

  it("each objection is unique (no duplicate categories)", () => {
    const out = generateObjectionResponses("Acme", fakeAssets(), "Pkg");
    const keys = out.map((o) => o.objection);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every follow-up contains a question (helps sales reps re-engage)", () => {
    const out = generateObjectionResponses("Acme", fakeAssets(), "Pkg");
    for (const r of out) {
      expect(r.followUp).toContain("?");
    }
  });
});
