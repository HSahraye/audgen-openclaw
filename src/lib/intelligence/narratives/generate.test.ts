import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  LeadIntelligence,
  LeadIntelligenceInput,
} from "@/lib/intelligence/types";

const mocks = vi.hoisted(() => ({
  generateNarrative: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  generateNarrative: mocks.generateNarrative,
}));

import { generateIntelligenceNarrative } from "./generate";

function fakeIntel(overrides: Partial<LeadIntelligence> = {}): LeadIntelligence {
  return {
    scores: {
      seo: 50,
      performance: 50,
      trust: 50,
      conversion: 50,
      accessibility: 50,
      branding: 50,
    },
    painPoints: ["Missing CTA", "Slow LCP", "No reviews"],
    strengths: ["HTTPS", "Has contact info"],
    urgencyScore: 60,
    likelyBudget: "medium",
    recommendedOffer: "Conversion Upgrade",
    outreachAngles: ["Pitch conversion fixes"],
    objections: ["Budget timing"],
    closeProbability: 55,
    findings: { technical: [], seo: [], conversion: [], trust: [] },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeLead(overrides: Partial<LeadIntelligenceInput> = {}): LeadIntelligenceInput {
  return {
    businessName: "Acme HVAC",
    category: "hvac",
    location: "Austin",
    workspaceId: "ws_1",
    ...overrides,
  };
}

describe("generateIntelligenceNarrative", () => {
  beforeEach(() => {
    mocks.generateNarrative.mockReset();
  });

  it("returns the AI response with source='gemini' when provider succeeds", async () => {
    mocks.generateNarrative.mockResolvedValue({
      painPointSummary: "AI summary",
      likelyMoneyLost: "AI loss copy",
      presenceLabsOffer: "AI offer",
      outreachAngles: ["AI angle 1", "AI angle 2"],
      objections: ["AI obj 1"],
      executiveSummary: "AI exec summary",
    });
    const result = await generateIntelligenceNarrative({
      lead: fakeLead(),
      intelligence: fakeIntel(),
    });
    expect(result.source).toBe("gemini");
    expect(result.painPointSummary).toBe("AI summary");
    expect(result.outreachAngles).toEqual(["AI angle 1", "AI angle 2"]);
  });

  it("falls back to local copy with source='local-fallback' when AI returns null", async () => {
    mocks.generateNarrative.mockResolvedValue(null);
    const result = await generateIntelligenceNarrative({
      lead: fakeLead({ businessName: "Bee Plumbing", category: "plumber", location: "Oakland" }),
      intelligence: fakeIntel({
        painPoints: ["a", "b", "c", "d"],
        recommendedOffer: "Local Trust Tune-Up",
      }),
    });
    expect(result.source).toBe("local-fallback");
    expect(result.painPointSummary).toContain("Bee Plumbing");
    expect(result.painPointSummary).toContain("a, b, c");
    expect(result.painPointSummary).toContain("plumber");
    expect(result.painPointSummary).toContain("Oakland");
    expect(result.presenceLabsOffer).toContain("Local Trust Tune-Up");
  });

  it("fallback uses 'local business' + 'your area' + 'your agency' when context is missing", async () => {
    mocks.generateNarrative.mockResolvedValue(null);
    const result = await generateIntelligenceNarrative({
      lead: fakeLead({ category: undefined, location: undefined }),
      intelligence: fakeIntel(),
    });
    expect(result.painPointSummary).toContain("local business");
    expect(result.painPointSummary).toContain("your area");
    expect(result.presenceLabsOffer).toContain("your agency");
  });

  it("fallback returns the intelligence outreachAngles + objections verbatim", async () => {
    mocks.generateNarrative.mockResolvedValue(null);
    const intel = fakeIntel({
      outreachAngles: ["angle X", "angle Y"],
      objections: ["obj P", "obj Q"],
    });
    const result = await generateIntelligenceNarrative({
      lead: fakeLead(),
      intelligence: intel,
    });
    expect(result.outreachAngles).toEqual(["angle X", "angle Y"]);
    expect(result.objections).toEqual(["obj P", "obj Q"]);
  });

  it("coerces non-array AI outreachAngles back to intelligence values", async () => {
    mocks.generateNarrative.mockResolvedValue({
      painPointSummary: "s",
      likelyMoneyLost: "l",
      presenceLabsOffer: "o",
      outreachAngles: "not an array" as unknown as string[],
      objections: ["ok"],
      executiveSummary: "x",
    });
    const intel = fakeIntel({ outreachAngles: ["intel angle"] });
    const result = await generateIntelligenceNarrative({
      lead: fakeLead(),
      intelligence: intel,
    });
    expect(result.outreachAngles).toEqual(["intel angle"]);
  });

  it("passes brand name + workspaceId in the AI metadata", async () => {
    mocks.generateNarrative.mockResolvedValue(null);
    await generateIntelligenceNarrative({
      lead: fakeLead({
        workspaceId: "ws_special",
        narrativeContext: { brandName: "Bright Local" },
      }),
      intelligence: fakeIntel(),
    });
    const call = mocks.generateNarrative.mock.calls[0][0];
    expect(call.metadata.workspaceId).toBe("ws_special");
    expect(call.metadata.generationType).toBe("intelligence_narrative");
    expect(call.input.brandName).toBe("Bright Local");
  });

  it("caps strengths/painPoints/outreachAngles/objections on the AI payload", async () => {
    mocks.generateNarrative.mockResolvedValue(null);
    const intel = fakeIntel({
      strengths: ["s1", "s2", "s3", "s4", "s5", "s6"],
      painPoints: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
      outreachAngles: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"],
      objections: ["o1", "o2", "o3", "o4", "o5", "o6", "o7"],
    });
    await generateIntelligenceNarrative({
      lead: fakeLead(),
      intelligence: intel,
    });
    const payload = mocks.generateNarrative.mock.calls[0][0].input;
    expect(payload.strengths).toHaveLength(4);
    expect(payload.painPoints).toHaveLength(6);
    expect(payload.outreachAngles).toHaveLength(5);
    expect(payload.objections).toHaveLength(5);
  });
});
