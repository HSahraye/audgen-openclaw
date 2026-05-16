import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  proposalDeliveryFindMany: vi.fn(),
  sequenceFindMany: vi.fn(),
  outreachLogGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: mocks.leadFindMany },
    proposalDelivery: { findMany: mocks.proposalDeliveryFindMany },
    sequence: { findMany: mocks.sequenceFindMany },
    outreachLog: { groupBy: mocks.outreachLogGroupBy },
  },
}));

import { getOperationalInsights } from "./insights";

beforeEach(() => {
  for (const m of [
    mocks.leadFindMany,
    mocks.proposalDeliveryFindMany,
    mocks.sequenceFindMany,
    mocks.outreachLogGroupBy,
  ]) {
    m.mockReset();
    m.mockResolvedValue([]);
  }
});

describe("getOperationalInsights", () => {
  it("returns empty arrays for every key when there is no data", async () => {
    const out = await getOperationalInsights("ws_1");
    expect(out).toEqual({
      hotLeads: [],
      proposalLikelyClose: [],
      weakSequences: [],
      outreachMix: [],
    });
  });

  it("scopes every prisma call to workspaceId", async () => {
    await getOperationalInsights("ws_42");
    expect(mocks.leadFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_42");
    expect(mocks.proposalDeliveryFindMany.mock.calls[0][0].where.workspaceId).toBe(
      "ws_42",
    );
    expect(mocks.sequenceFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_42");
    expect(mocks.outreachLogGroupBy.mock.calls[0][0].where.workspaceId).toBe("ws_42");
  });

  it("excludes Won and Lost leads from the hot-leads query", async () => {
    await getOperationalInsights("ws_1");
    const where = mocks.leadFindMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ["Won", "Lost"] });
  });

  it("formats hot-lead names with the documented prefix", async () => {
    mocks.leadFindMany.mockResolvedValue([
      { id: "l1", businessName: "Acme HVAC" },
      { id: "l2", businessName: "Bee Plumbing" },
    ]);
    const out = await getOperationalInsights("ws_1");
    expect(out.hotLeads).toEqual([
      "Lead heating up: Acme HVAC",
      "Lead heating up: Bee Plumbing",
    ]);
  });

  it("formats proposal-likely-close strings using the lead's businessName", async () => {
    mocks.proposalDeliveryFindMany.mockResolvedValue([
      { id: "pd1", lead: { businessName: "Bright Local" } },
    ]);
    const out = await getOperationalInsights("ws_1");
    expect(out.proposalLikelyClose).toEqual([
      "Proposal likely to close: Bright Local",
    ]);
  });

  it("flags sequences with completion rate below 20% as weak (capped at 3)", async () => {
    mocks.sequenceFindMany.mockResolvedValue([
      {
        name: "Cold Outreach A",
        leadStates: [
          { status: "active" },
          { status: "active" },
          { status: "completed" },
        ], // 1/3 = 33% — NOT weak
      },
      {
        name: "Cold Outreach B",
        leadStates: [
          { status: "active" },
          { status: "active" },
          { status: "active" },
          { status: "active" },
          { status: "active" },
          { status: "completed" }, // 1/6 = 16% — WEAK
        ],
      },
      {
        name: "Cold Outreach C",
        leadStates: [{ status: "active" }, { status: "active" }], // 0/2 = 0% — WEAK
      },
      {
        name: "Cold Outreach D",
        leadStates: [], // 0/0 → 0 — WEAK
      },
      {
        name: "Cold Outreach E",
        leadStates: [{ status: "active" }, { status: "active" }], // also weak
      },
    ]);
    const out = await getOperationalInsights("ws_1");
    expect(out.weakSequences).toHaveLength(3);
    expect(out.weakSequences.every((s) => s.startsWith("Sequence underperforming:"))).toBe(
      true,
    );
    // Cold Outreach A should NOT be in the list (33% > 20%)
    expect(out.weakSequences.every((s) => !s.includes("Cold Outreach A"))).toBe(true);
  });

  it("formats outreach mix as 'Type: count' strings", async () => {
    mocks.outreachLogGroupBy.mockResolvedValue([
      { type: "Email", _count: { type: 5 } },
      { type: "Call", _count: { type: 12 } },
    ]);
    const out = await getOperationalInsights("ws_1");
    expect(out.outreachMix).toEqual(["Email: 5", "Call: 12"]);
  });

  it("filters payment-recent leads using a 7-day window in the prisma query", async () => {
    await getOperationalInsights("ws_1");
    const where = mocks.leadFindMany.mock.calls[0][0].where;
    expect(where.paymentLogs?.some?.createdAt?.gte).toBeInstanceOf(Date);
    const days = (Date.now() - where.paymentLogs.some.createdAt.gte.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(7);
  });
});
