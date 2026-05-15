import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  activityFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: mocks.leadFindMany },
    activity: { findMany: mocks.activityFindMany },
  },
}));

import { aggregateOutcomes, getOutcomeAnalytics } from "./outcomes";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("aggregateOutcomes (pure)", () => {
  it("returns empty buckets for empty inputs", () => {
    const r = aggregateOutcomes("ws_1", [], new Map());
    expect(r.byCategory).toEqual([]);
    expect(r.byLocation).toEqual([]);
  });

  it("uses stage as a fallback when no activities are present", () => {
    const leads = [
      { id: "a", category: "smoke shop", location: "Santa Clara", status: "CONTACTED" },
      { id: "b", category: "smoke shop", location: "Santa Clara", status: "REPLIED" },
      { id: "c", category: "smoke shop", location: "Santa Clara", status: "WON" },
      { id: "d", category: "smoke shop", location: "Santa Clara", status: "LOST" },
      { id: "e", category: "smoke shop", location: "Santa Clara", status: "NEW" },
    ];
    const r = aggregateOutcomes("ws_1", leads, new Map());
    const cat = r.byCategory.find((c) => c.key === "smoke shop")!;
    expect(cat.total).toBe(5);
    // Contacted bucket should include CONTACTED, REPLIED, WON, LOST (not NEW)
    expect(cat.contacted).toBe(4);
    // Replied bucket should include REPLIED + WON (LOST does not promote to replied).
    expect(cat.replied).toBe(2);
    expect(cat.won).toBe(1);
    expect(cat.lost).toBe(1);
  });

  it("activity counts strengthen the buckets (LEAD_CONTACTED + REPLY_LOGGED + DEAL_WON)", () => {
    const leads = [
      { id: "x", category: "dental", location: "San Jose", status: "PROPOSAL_SENT" },
    ];
    const acts = new Map<string, Record<string, number>>([
      ["x", { LEAD_CONTACTED: 1, REPLY_LOGGED: 1, CALL_BOOKED: 1, PROPOSAL_SENT: 1, DEAL_WON: 1 }],
    ]);
    const r = aggregateOutcomes("ws_1", leads, acts);
    const c = r.byCategory.find((x) => x.key === "dental")!;
    expect(c.contacted).toBe(1);
    expect(c.replied).toBe(1);
    expect(c.booked).toBe(1);
    expect(c.proposal).toBe(1);
    expect(c.won).toBe(1);
    // Close rate = 1/1 (won/proposal) regardless of stage being PROPOSAL_SENT
    expect(c.rates.closeRate).toBe(1);
  });

  it("flags thin buckets (total < 10)", () => {
    const leads = Array.from({ length: 3 }, (_, i) => ({
      id: `l${i}`,
      category: "tiny",
      location: "nowhere",
      status: "NEW",
    }));
    const r = aggregateOutcomes("ws_1", leads, new Map());
    expect(r.byCategory[0].thin).toBe(true);
  });

  it("sorts by total descending and lowercases bucket keys", () => {
    const leads = [
      { id: "a", category: "Smoke Shop", location: "Santa Clara", status: "NEW" },
      { id: "b", category: "smoke shop", location: "Santa Clara", status: "NEW" },
      { id: "c", category: "dental", location: "Santa Clara", status: "NEW" },
    ];
    const r = aggregateOutcomes("ws_1", leads, new Map());
    expect(r.byCategory.map((c) => c.key)).toEqual(["smoke shop", "dental"]);
    expect(r.byCategory[0].total).toBe(2);
  });

  it("rates are clamped to [0, 1] and never NaN", () => {
    const r = aggregateOutcomes(
      "ws_1",
      [{ id: "a", category: "x", location: "y", status: "NEW" }],
      new Map(),
    );
    const cat = r.byCategory[0];
    expect(cat.rates.contactRate).toBe(0);
    expect(cat.rates.replyRate).toBe(0);
    expect(cat.rates.closeRate).toBe(0);
    for (const v of Object.values(cat.rates)) expect(Number.isNaN(v)).toBe(false);
  });
});

describe("getOutcomeAnalytics", () => {
  it("rejects missing workspaceId", async () => {
    await expect(getOutcomeAnalytics("")).rejects.toThrow(/workspaceId required/);
  });

  it("workspace-scopes both queries and joins activities to leads", async () => {
    mocks.leadFindMany.mockResolvedValue([
      { id: "L1", category: "dental", location: "San Jose", status: "PROPOSAL_SENT" },
      { id: "L2", category: "dental", location: "San Jose", status: "NEW" },
    ]);
    mocks.activityFindMany.mockResolvedValue([
      { leadId: "L1", type: "PROPOSAL_SENT" },
      { leadId: "L1", type: "DEAL_WON" },
    ]);
    const r = await getOutcomeAnalytics("ws_target");
    expect(mocks.leadFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_target");
    expect(mocks.activityFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_target");
    const dental = r.byCategory.find((c) => c.key === "dental")!;
    expect(dental.total).toBe(2);
    expect(dental.won).toBe(1);
  });
});
