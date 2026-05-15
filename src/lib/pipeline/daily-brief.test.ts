import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: mocks.leadFindMany } },
}));

import { buildPipelineDailyBrief } from "./daily-brief";

beforeEach(() => {
  mocks.leadFindMany.mockReset();
});

describe("buildPipelineDailyBrief", () => {
  it("rejects when workspaceId is missing", async () => {
    await expect(buildPipelineDailyBrief("")).rejects.toThrow(/workspaceId required/);
  });

  it("scopes the lead query strictly to the workspaceId and excludes terminal stages", async () => {
    mocks.leadFindMany.mockResolvedValue([]);
    await buildPipelineDailyBrief("ws_target");
    const arg = mocks.leadFindMany.mock.calls[0][0];
    expect(arg.where.workspaceId).toBe("ws_target");
    expect(arg.where.status.notIn).toEqual(
      expect.arrayContaining(["WON", "LOST", "DISQUALIFIED"]),
    );
  });

  it("returns empty items and zero totals for an empty workspace", async () => {
    mocks.leadFindMany.mockResolvedValue([]);
    const brief = await buildPipelineDailyBrief("ws_empty");
    expect(brief.items).toEqual([]);
    expect(brief.totals.repliedAwaiting).toBe(0);
    expect(brief.totals.qualifiedAwaiting).toBe(0);
  });

  it("ranks REPLIED above CONTACTED above NEW", async () => {
    const now = new Date();
    const long_ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    mocks.leadFindMany.mockResolvedValue([
      { id: "n", businessName: "New Inc", status: "NEW", score: 100, lastContactedAt: null, updatedAt: now },
      {
        id: "c", businessName: "Contacted Co", status: "CONTACTED", score: 70,
        lastContactedAt: long_ago, updatedAt: long_ago,
      },
      { id: "r", businessName: "Replied LLC", status: "REPLIED", score: 50, lastContactedAt: now, updatedAt: now },
    ]);
    const brief = await buildPipelineDailyBrief("ws_1");
    expect(brief.items.map((i) => i.leadId)).toEqual(["r", "c", "n"]);
  });

  it("flags stale CONTACTED via the totals.contactedStale count", async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    mocks.leadFindMany.mockResolvedValue([
      { id: "c1", businessName: "Co1", status: "CONTACTED", score: 50, lastContactedAt: old, updatedAt: old },
      { id: "c2", businessName: "Co2", status: "CONTACTED", score: 50, lastContactedAt: new Date(), updatedAt: new Date() },
    ]);
    const brief = await buildPipelineDailyBrief("ws_1");
    expect(brief.totals.contactedStale).toBe(1);
    expect(brief.items.find((i) => i.leadId === "c1")?.reason).toMatch(/no reply/i);
  });

  it("flags stale PROPOSAL_SENT via the totals.proposalsStale count", async () => {
    const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    mocks.leadFindMany.mockResolvedValue([
      { id: "p1", businessName: "P1", status: "PROPOSAL_SENT", score: 80, lastContactedAt: null, updatedAt: old },
      { id: "p2", businessName: "P2", status: "PROPOSAL_SENT", score: 80, lastContactedAt: null, updatedAt: new Date() },
    ]);
    const brief = await buildPipelineDailyBrief("ws_1");
    expect(brief.totals.proposalsStale).toBe(1);
  });

  it("normalises legacy free-text status into canonical stages", async () => {
    mocks.leadFindMany.mockResolvedValue([
      { id: "x", businessName: "Legacy Co", status: "Contacted", score: 0, lastContactedAt: null, updatedAt: new Date() },
    ]);
    const brief = await buildPipelineDailyBrief("ws_1");
    expect(brief.items[0].stage).toBe("CONTACTED");
  });

  it("trims to TOTAL_BUDGET (25) leads max", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `lead_${i}`,
      businessName: `Biz ${i}`,
      status: "CONTACTED",
      score: 50,
      lastContactedAt: new Date(),
      updatedAt: new Date(),
    }));
    mocks.leadFindMany.mockResolvedValue(rows);
    const brief = await buildPipelineDailyBrief("ws_1");
    expect(brief.items).toHaveLength(25);
  });
});
