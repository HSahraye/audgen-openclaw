import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocking strategy: replace the @anthropic-ai/sdk module's default
// export with a constructor that produces a `messages.create` function
// we can program per-test. The engine never calls the network.

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mocks.messagesCreate },
  })),
}));

import { generateLlmAudit, __test__ } from "./llm-audit-engine";

const VALID_RESPONSE = {
  executiveSummary: "TRIO Heating has 1224 reviews and a strong rating but the homepage hides the 24/7 emergency phone behind a hamburger menu, leaking after-hours bookings to competitors that lead with the banner.",
  findings: [
    "No 24/7 emergency phone surfaced above the fold — competitors with this banner capture 30%+ more after-hours calls during the heating season.",
    "Financing options not visible — replacement systems running $8-12K convert better with 0% APR or monthly-payment language pinned to the hero.",
    "Service-area map missing — buyers searching from neighbouring zip codes can't tell if you cover them and bounce to the next listing.",
    "NATE certification not surfaced — this is the #1 HVAC trust shortcut and absence reduces booked tune-ups vs. shops that lead with the badge.",
    "Recent review stream looks healthy at 1224, but only 3 photos in the GBP — buyers verifying a real shop want before/after photos.",
  ],
  checks: {
    hasWebsite: true,
    outdatedWebsite: false,
    mobileFriendly: true,
    clearCta: true,
    phoneEasyToFind: true,
    reviewsVisible: true,
    onlineBooking: false,
    trustSection: false,
    gallery: false,
    serviceList: true,
    pricing: false,
    faq: false,
  },
  openingPitch: "Hey, I noticed TRIO Heating has 1200+ reviews but no 24/7 emergency banner — that mismatch costs you the after-hours calls competitors are quietly catching.",
  painSummary: "TRIO Heating earns the search traffic but leaks high-intent after-hours calls because the emergency phone isn't visible. Adding the banner + financing options + service-area map should recover most of that within 4-6 weeks of the redesign.",
  likelyMoneyLost: "$2,400-$4,200 per month in missed after-hours emergency calls during peak season.",
  presenceLabsOffer: "Presence Labs Conversion Upgrade: a focused redesign that puts the emergency phone, financing language, and service-area map above the fold so the 1200+ reviews actually convert into booked jobs.",
  recommendedPackage: "Presence Labs Conversion Upgrade",
  packagePrice: 2200,
  coldCallScript: "Hey is this the owner of TRIO Heating? This is Hamid with Presence Labs — quick note for HVAC contractors in San Jose. I was reviewing TRIO's site and the thing that jumped out is your 24/7 emergency line isn't visible above the fold; competitors with that banner are quietly catching the after-hours calls. I put together a 1-page audit — okay if I text it over?",
  textMessageScript: "Hey — Hamid from Presence Labs. Spotted that TRIO's 24/7 emergency phone isn't above the fold even though you've got 1200+ reviews backing you. Mind if I send a free 1-pager?",
  emailScript: "Subject: A few quick wins for TRIO Heating\n\nHi,\n\nI was researching HVAC contractors in San Jose and looked at TRIO Heating's site. A few things stood out: emergency phone hidden, financing not visible, no service-area map.\n\nThese are fixable in a 2-3 week sprint and the upside is typically $2k-$4k/month in recovered after-hours calls during peak season.\n\nWant me to send the audit over?\n\nBest, Hamid / Presence Labs",
  thirtySecondPitch: "TRIO Heating already gets the search traffic — 1200+ reviews proves it. But the 24/7 emergency line isn't visible above the fold, financing isn't pinned, and there's no service-area map. Presence Labs fixes those exact gaps in a 2-3 week sprint so the traffic TRIO already gets actually books jobs.",
  followUpMessage: "Hey — quick follow-up. Finished the audit for TRIO Heating and found 5 specific gaps including the emergency phone visibility issue. Want me to send the 1-pager?",
  proposalOutline: [
    "Current online presence snapshot for TRIO Heating",
    "Top 5 conversion gaps and revenue impact",
    "Recommended solution: Presence Labs Conversion Upgrade",
    "Deliverables: emergency-phone hero, financing block, service-area map, NATE badges, gallery",
    "Timeline: 2-3 weeks to launch",
    "Investment & next steps",
  ],
};

const WORKSPACE_CONTEXT = {
  brandName: "Presence Labs",
  senderIdentity: "Hamid",
  packageOptions: [
    "Presence Labs Local Trust Tune-Up",
    "Presence Labs Conversion Upgrade",
    "Presence Labs Launch Package",
  ],
  toneHint: "consultative, founder-to-founder",
};

const STANDARD_INPUT = {
  businessName: "TRIO Heating",
  category: "HVAC contractors",
  location: "San Jose, CA",
  websiteUrl: "https://trioheatingandair.com",
  phone: null,
  email: null,
  rating: 4.9,
  reviewCount: 1224,
  workspaceId: "ws_test",
};

beforeEach(() => {
  // Clear in-flight semaphore between tests so the cap doesn't leak.
  __test__.inFlightByWorkspace.clear();
  mocks.messagesCreate.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateLlmAudit", () => {
  it("returns source=llm-fallback immediately when ANTHROPIC_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm-fallback");
    expect(result.fallbackReason).toBe("missing-anthropic-api-key");
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });

  it("returns source=llm and the parsed payload when Claude responds with valid JSON", async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
      usage: { input_tokens: 1500, output_tokens: 800 },
    });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm");
    expect(result.verticalKey).toBe("hvac");
    expect(result.findings).toHaveLength(VALID_RESPONSE.findings.length);
    expect(result.assets.coldCallScript).toMatch(/TRIO/);
    expect(result.assets.proposalOutline).toHaveLength(6);
    expect(result.checks.hasWebsite).toBe(true);
    expect(result.diagnostics?.inputTokens).toBe(1500);
    expect(result.diagnostics?.outputTokens).toBe(800);
    // Cost = 1500 * (3/1e6) + 800 * (15/1e6) = 0.0045 + 0.012 = 0.0165
    expect(result.diagnostics?.estimatedCostUsd).toBeCloseTo(0.0165, 4);
  });

  it("strips markdown fences and parses fenced JSON responses", async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(VALID_RESPONSE) + "\n```" }],
      usage: { input_tokens: 500, output_tokens: 500 },
    });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm");
  });

  it("retries once on schema-validation failure, falls back if both attempts fail", async () => {
    // Both attempts return malformed (missing required fields) — engine
    // must do exactly 2 attempts then return llm-fallback.
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"executiveSummary":"too short"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm-fallback");
    expect(result.fallbackReason).toBe("schema-validation-failed");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("recovers if the first attempt is malformed and the second is valid", async () => {
    mocks.messagesCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "not json at all" }],
        usage: { input_tokens: 100, output_tokens: 10 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
        usage: { input_tokens: 1500, output_tokens: 800 },
      });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("falls back when SDK throws (e.g. rate limited / network error)", async () => {
    mocks.messagesCreate.mockRejectedValue(new Error("429 rate-limited"));
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm-fallback");
    expect(result.fallbackReason).toMatch(/429|rate/i);
  });

  it("respects the per-workspace concurrency cap", async () => {
    // Saturate the workspace's in-flight slots so the next call hits
    // the cap and bypasses the SDK entirely.
    for (let i = 0; i < 10; i++) __test__.trackInFlight("ws_capped");
    const result = await generateLlmAudit(
      { ...STANDARD_INPUT, workspaceId: "ws_capped" },
      WORKSPACE_CONTEXT,
    );
    expect(result.source).toBe("llm-fallback");
    expect(result.fallbackReason).toBe("workspace-concurrency-cap");
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
    // Cleanup so subsequent tests don't carry the saturation forward.
    for (let i = 0; i < 10; i++) __test__.releaseInFlight("ws_capped");
  });

  it("uses the explicit vertical override and skips the classifier", async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
      usage: { input_tokens: 1000, output_tokens: 800 },
    });
    const result = await generateLlmAudit(
      { ...STANDARD_INPUT, vertical: "dental", category: null },
      WORKSPACE_CONTEXT,
    );
    expect(result.source).toBe("llm");
    expect(result.verticalKey).toBe("dental");
    // Classifier was NOT consulted — only the audit call ran.
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("uses the deterministic alias matcher when category is provided (no LLM classifier needed)", async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
      usage: { input_tokens: 1000, output_tokens: 800 },
    });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.verticalKey).toBe("hvac");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1); // no separate classifier call
  });

  it("falls back to generic_local_services when no category and no LLM classifier match", async () => {
    // Classifier (haiku) returns garbage, so the engine defaults to generic.
    mocks.messagesCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "not_a_real_vertical" }],
        usage: { input_tokens: 50, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
        usage: { input_tokens: 1000, output_tokens: 800 },
      });
    const result = await generateLlmAudit(
      { ...STANDARD_INPUT, category: null },
      WORKSPACE_CONTEXT,
    );
    expect(result.verticalKey).toBe("generic_local_services");
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("guarantees the assets payload satisfies the c05db5e/189e605 dashboard contract", async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_RESPONSE) }],
      usage: { input_tokens: 1500, output_tokens: 800 },
    });
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    // Re-pin the contract that the c05db5e and 189e605 tests already
    // pin for the templated path: every required GeneratedAssets field
    // must be a non-empty string of the right type.
    expect(typeof result.assets.coldCallScript).toBe("string");
    expect(typeof result.assets.textMessageScript).toBe("string");
    expect(typeof result.assets.emailScript).toBe("string");
    expect(typeof result.assets.thirtySecondPitch).toBe("string");
    expect(typeof result.assets.followUpMessage).toBe("string");
    expect(Array.isArray(result.assets.proposalOutline)).toBe(true);
    expect(typeof result.assets.likelyMoneyLost).toBe("string");
    expect(typeof result.assets.painPointSummary).toBe("string");
    expect(typeof result.assets.recommendedPackage).toBe("string");
    expect(typeof result.assets.presenceLabsOffer).toBe("string");
  });

  it("fallback payload also satisfies the dashboard contract (defensive against the e1c8735 class of bug)", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await generateLlmAudit(STANDARD_INPUT, WORKSPACE_CONTEXT);
    expect(result.source).toBe("llm-fallback");
    // The fallback payload is what the integration layer USES if the
    // caller chooses NOT to invoke the legacy templated engine. It
    // must satisfy the dashboard contract on its own.
    expect(typeof result.assets.coldCallScript).toBe("string");
    expect(result.assets.coldCallScript.length).toBeGreaterThan(0);
    expect(Array.isArray(result.assets.proposalOutline)).toBe(true);
    expect(result.assets.proposalOutline.length).toBe(6);
    expect(typeof result.assets.likelyMoneyLost).toBe("string");
  });
});
