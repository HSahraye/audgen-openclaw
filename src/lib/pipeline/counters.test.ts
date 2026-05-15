import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadGroupBy: vi.fn(),
  leadAggregate: vi.fn(),
  activityCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      groupBy: mocks.leadGroupBy,
      aggregate: mocks.leadAggregate,
    },
    activity: {
      count: mocks.activityCount,
    },
  },
}));

import { composeMetrics, getPipelineMetrics } from "./counters";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("composeMetrics (pure)", () => {
  it("returns zeros for an empty workspace and never NaN", () => {
    const m = composeMetrics({
      workspaceId: "ws_empty",
      stageCounts: {},
      activityCounts: {},
    });
    expect(m.workspaceId).toBe("ws_empty");
    expect(m.derived.leadsImported).toBe(0);
    expect(m.derived.won).toBe(0);
    expect(m.rates.closeRate).toBe(0);
    expect(m.rates.replyRate).toBe(0);
    expect(m.rates.proposalRate).toBe(0);
    expect(Number.isNaN(m.rates.closeRate)).toBe(false);
  });

  it("sums stage counts into leadsImported (total leads) and derives won/lost", () => {
    const m = composeMetrics({
      workspaceId: "ws_1",
      stageCounts: {
        NEW: 10,
        CONTACTED: 5,
        REPLIED: 3,
        CALL_BOOKED: 2,
        PROPOSAL_SENT: 2,
        WON: 1,
        LOST: 1,
      },
      activityCounts: {
        LEAD_CONTACTED: 5,
        REPLY_LOGGED: 3,
        CALL_BOOKED: 2,
        PROPOSAL_SENT: 2,
      },
    });
    expect(m.derived.leadsImported).toBe(24);
    expect(m.derived.leadsContacted).toBe(5);
    expect(m.derived.repliesLogged).toBe(3);
    expect(m.derived.callsBooked).toBe(2);
    expect(m.derived.proposalsSent).toBe(2);
    expect(m.derived.won).toBe(1);
    expect(m.derived.lost).toBe(1);
    expect(m.rates.connectionRate).toBeCloseTo(5 / 24, 5);
    expect(m.rates.replyRate).toBeCloseTo(3 / 5, 5);
    expect(m.rates.bookedCallRate).toBeCloseTo(2 / 3, 5);
    expect(m.rates.proposalRate).toBe(1);
    expect(m.rates.closeRate).toBeCloseTo(1 / 2, 5);
  });

  it("clamps rates to [0, 1] and avoids divide-by-zero", () => {
    const m = composeMetrics({
      workspaceId: "ws_1",
      stageCounts: { WON: 5 },
      activityCounts: {},
    });
    // proposalsSent activity = 0, but counts.PROPOSAL_SENT also = 0 -> closeRate denominator 0 -> 0.
    expect(m.rates.closeRate).toBe(0);
    expect(m.derived.won).toBe(5);
  });

  it("falls back to the stage bucket when activity counts are absent (legacy data)", () => {
    const m = composeMetrics({
      workspaceId: "ws_1",
      stageCounts: { CONTACTED: 7, CALL_BOOKED: 3, PROPOSAL_SENT: 2 },
      activityCounts: {},
    });
    expect(m.derived.leadsContacted).toBe(7);
    expect(m.derived.callsBooked).toBe(3);
    expect(m.derived.proposalsSent).toBe(2);
  });
});

describe("getPipelineMetrics (DB-backed)", () => {
  it("throws when workspaceId is missing (fail closed)", async () => {
    await expect(getPipelineMetrics("")).rejects.toThrow(/workspaceId required/);
  });

  it("scopes every query strictly to the workspaceId", async () => {
    mocks.leadGroupBy.mockResolvedValue([
      { status: "Contacted", _count: { _all: 4 } },
      { status: "WON", _count: { _all: 1 } },
      { status: "weirdLegacy", _count: { _all: 2 } }, // -> normalizes to NEW
    ]);
    mocks.activityCount.mockResolvedValue(0);
    mocks.leadAggregate.mockResolvedValue({ _count: { _all: 3 } });

    const m = await getPipelineMetrics("ws_target");
    expect(m.workspaceId).toBe("ws_target");
    // Verify the groupBy was scoped:
    expect(mocks.leadGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_target" },
      }),
    );
    // Every activity.count call was workspace-scoped:
    for (const call of mocks.activityCount.mock.calls) {
      expect(call[0]).toHaveProperty("where.workspaceId", "ws_target");
    }
    // Aggregate too:
    expect(mocks.leadAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws_target" }),
      }),
    );
    // Counts add up: 4 + 1 + 2 = 7 total leads imported.
    expect(m.derived.leadsImported).toBe(7);
    expect(m.counts.CONTACTED).toBe(4);
    expect(m.counts.WON).toBe(1);
    expect(m.counts.NEW).toBe(2);
  });

  it("returns zero counts (not NaN, not undefined) for an empty workspace", async () => {
    mocks.leadGroupBy.mockResolvedValue([]);
    mocks.activityCount.mockResolvedValue(0);
    mocks.leadAggregate.mockResolvedValue({ _count: { _all: 0 } });
    const m = await getPipelineMetrics("ws_empty");
    expect(m.derived.leadsImported).toBe(0);
    expect(m.derived.won).toBe(0);
    expect(m.rates.closeRate).toBe(0);
    expect(m.rates.replyRate).toBe(0);
    expect(m.counts.NEW).toBe(0);
  });

  it("uses activity counts for replies/audits/preps", async () => {
    mocks.leadGroupBy.mockResolvedValue([]);
    mocks.leadAggregate.mockResolvedValue({ _count: { _all: 0 } });
    // 6 activity.count calls in order: REPLY_LOGGED, AUDIT_GENERATED,
    // OUTREACH_PREPARED, LEAD_CONTACTED, CALL_BOOKED, PROPOSAL_SENT.
    mocks.activityCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const m = await getPipelineMetrics("ws_a");
    expect(m.derived.repliesLogged).toBe(5);
    expect(m.derived.auditsGenerated).toBe(11);
    expect(m.derived.outreachPrepared).toBe(7);
  });
});
