import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  activityFindMany: vi.fn(),
  leadFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: { findMany: mocks.activityFindMany },
    lead: { findMany: mocks.leadFindMany },
  },
}));

import { aggregateFeedback, getScoringFeedback } from "./feedback";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("aggregateFeedback (pure)", () => {
  it("returns zero totals for an empty input and a thin-data note", () => {
    const r = aggregateFeedback([], "ws_1");
    expect(r.totals).toEqual({
      decided: 0,
      won: 0,
      lost: 0,
      baselineCloseRate: 0,
    });
    expect(r.thinDataNotes.length).toBe(1);
    expect(r.byScoreBand).toEqual([]);
  });

  it("groups by score band and computes lift relative to baseline", () => {
    // 10 deals; baseline close rate = 3/10 = 0.3
    const decided = [
      { score: 90, category: "smoke shop", location: "Santa Clara", outcome: "won" as const },
      { score: 85, category: "smoke shop", location: "Santa Clara", outcome: "won" as const },
      { score: 75, category: "dental", location: "San Jose", outcome: "won" as const },
      { score: 60, category: "dental", location: "San Jose", outcome: "lost" as const },
      { score: 55, category: "dental", location: "Oakland", outcome: "lost" as const },
      { score: 50, category: "smoke shop", location: "Santa Clara", outcome: "lost" as const },
      { score: 30, category: "smoke shop", location: "Santa Clara", outcome: "lost" as const },
      { score: 25, category: "smoke shop", location: "Santa Clara", outcome: "lost" as const },
      { score: 20, category: "dental", location: "San Jose", outcome: "lost" as const },
      { score: 10, category: "dental", location: "San Jose", outcome: "lost" as const },
    ];
    const r = aggregateFeedback(decided, "ws_1");
    expect(r.totals.decided).toBe(10);
    expect(r.totals.won).toBe(3);
    expect(r.totals.lost).toBe(7);
    expect(r.totals.baselineCloseRate).toBeCloseTo(0.3, 5);

    // 81-100 band: 2 won / 2 decided = 1.0 close rate, lift = 1/0.3 ~ 3.33
    const top = r.byScoreBand.find((b) => b.band === "81-100");
    expect(top).toBeTruthy();
    expect(top?.closeRate).toBe(1);
    expect(top?.lift).toBeCloseTo(1 / 0.3, 3);

    // 0-20 band: 0/2 -> 0 close rate, lift 0
    const low = r.byScoreBand.find((b) => b.band === "0-20");
    expect(low?.closeRate).toBe(0);
    expect(low?.lift).toBe(0);
  });

  it("groups by category lowercased", () => {
    const r = aggregateFeedback(
      [
        { score: 80, category: "Smoke Shop", location: null, outcome: "won" },
        { score: 70, category: "smoke shop", location: null, outcome: "lost" },
        { score: 60, category: "Dental", location: null, outcome: "won" },
      ],
      "ws_1",
    );
    const cats = r.byCategory.map((c) => c.category).sort();
    expect(cats).toEqual(["dental", "smoke shop"]);
  });

  it("warns about thin data below threshold", () => {
    const r = aggregateFeedback(
      [{ score: 80, category: "a", location: "b", outcome: "won" }],
      "ws_1",
    );
    expect(r.thinDataNotes[0]).toMatch(/Only 1 decided/);
  });

  it("baseline 0 yields lift 0 (no NaN)", () => {
    const r = aggregateFeedback(
      [
        { score: 80, category: "a", location: "b", outcome: "lost" },
        { score: 60, category: "a", location: "b", outcome: "lost" },
      ],
      "ws_1",
    );
    expect(r.totals.baselineCloseRate).toBe(0);
    for (const b of r.byScoreBand) expect(b.lift).toBe(0);
  });
});

describe("getScoringFeedback (DB)", () => {
  it("rejects missing workspaceId", async () => {
    await expect(getScoringFeedback("")).rejects.toThrow(/workspaceId required/);
  });

  it("returns empty totals when there are no decision activities", async () => {
    mocks.activityFindMany.mockResolvedValue([]);
    const r = await getScoringFeedback("ws_1");
    expect(r.totals.decided).toBe(0);
    expect(mocks.leadFindMany).not.toHaveBeenCalled();
  });

  it("joins activities to leads and computes the report", async () => {
    mocks.activityFindMany.mockResolvedValue([
      { leadId: "l1", type: "DEAL_WON", createdAt: new Date("2026-05-01") },
      { leadId: "l2", type: "DEAL_LOST", createdAt: new Date("2026-05-01") },
      // Duplicate decision; the latest (above) wins. The older one is skipped.
      { leadId: "l1", type: "DEAL_LOST", createdAt: new Date("2026-04-01") },
    ]);
    mocks.leadFindMany.mockResolvedValue([
      { id: "l1", score: 90, category: "smoke shop", location: "Santa Clara" },
      { id: "l2", score: 30, category: "dental", location: "San Jose" },
    ]);
    const r = await getScoringFeedback("ws_1");
    expect(r.totals.decided).toBe(2);
    expect(r.totals.won).toBe(1);
    expect(r.totals.baselineCloseRate).toBe(0.5);
    // Activity findMany must be scoped to the workspaceId.
    const aArg = mocks.activityFindMany.mock.calls[0][0];
    expect(aArg.where.workspaceId).toBe("ws_1");
    // Lead findMany must also be scoped.
    const lArg = mocks.leadFindMany.mock.calls[0][0];
    expect(lArg.where.workspaceId).toBe("ws_1");
  });
});
