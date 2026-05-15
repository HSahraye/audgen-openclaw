import { describe, it, expect } from "vitest";
import type { DailyBrief, DailyBriefItem } from "./daily-brief";
import { buildActionQueue } from "./action-queue";

function item(over: Partial<DailyBriefItem>): DailyBriefItem {
  return {
    leadId: over.leadId ?? `lead_${Math.random()}`,
    businessName: over.businessName ?? "X Inc",
    stage: over.stage ?? "NEW",
    score: over.score ?? 50,
    reason: over.reason ?? "",
    lastActivityAgeMs: over.lastActivityAgeMs ?? null,
  };
}

function brief(items: DailyBriefItem[]): DailyBrief {
  return {
    workspaceId: "ws_1",
    asOf: new Date(),
    items,
    totals: {
      repliedAwaiting: 0,
      qualifiedAwaiting: 0,
      proposalsStale: 0,
      contactedStale: 0,
      callBookedUpcoming: 0,
    },
  };
}

const FOUR_DAYS_MS = 4 * 86_400_000;

describe("buildActionQueue", () => {
  it("empty brief -> empty queue", () => {
    const q = buildActionQueue(brief([]));
    expect(q.totals).toEqual({ callToday: 0, followUp: 0, stuckHot: 0 });
  });

  it("REPLIED, QUALIFIED, CALL_BOOKED -> callToday (sorted by score desc)", () => {
    const q = buildActionQueue(
      brief([
        item({ leadId: "a", stage: "REPLIED", score: 50 }),
        item({ leadId: "b", stage: "QUALIFIED", score: 80 }),
        item({ leadId: "c", stage: "CALL_BOOKED", score: 65 }),
      ]),
    );
    expect(q.callToday.map((x) => x.leadId)).toEqual(["b", "c", "a"]);
    expect(q.totals.callToday).toBe(3);
    expect(q.totals.followUp).toBe(0);
    expect(q.totals.stuckHot).toBe(0);
  });

  it("stale CONTACTED / PROPOSAL_SENT -> followUp", () => {
    const q = buildActionQueue(
      brief([
        item({ leadId: "c1", stage: "CONTACTED", lastActivityAgeMs: FOUR_DAYS_MS, score: 60 }),
        item({ leadId: "p1", stage: "PROPOSAL_SENT", lastActivityAgeMs: FOUR_DAYS_MS, score: 80 }),
        // Recent CONTACTED should NOT show up.
        item({ leadId: "fresh", stage: "CONTACTED", lastActivityAgeMs: 60_000, score: 60 }),
      ]),
    );
    expect(q.followUp.map((x) => x.leadId).sort()).toEqual(["c1", "p1"]);
    expect(q.followUp.length).toBe(2);
  });

  it("high-score early stage stuck >= 3 days -> stuckHot", () => {
    const q = buildActionQueue(
      brief([
        item({ leadId: "h1", stage: "PREPARED", score: 90, lastActivityAgeMs: FOUR_DAYS_MS }),
        item({ leadId: "h2", stage: "NEW", score: 75, lastActivityAgeMs: FOUR_DAYS_MS }),
        // Low score: not hot enough.
        item({ leadId: "low", stage: "NEW", score: 40, lastActivityAgeMs: FOUR_DAYS_MS }),
        // Hot but fresh: not stuck.
        item({ leadId: "fresh", stage: "NEW", score: 90, lastActivityAgeMs: 60_000 }),
      ]),
    );
    expect(q.stuckHot.map((x) => x.leadId).sort()).toEqual(["h1", "h2"]);
    expect(q.stuckHot[0].score).toBeGreaterThanOrEqual(q.stuckHot[1].score);
  });

  it("ignores items that don't classify (e.g. WON, LOST, fresh CONTACTED)", () => {
    const q = buildActionQueue(
      brief([
        item({ leadId: "w1", stage: "WON", score: 99 }),
        item({ leadId: "l1", stage: "LOST", score: 50 }),
        item({ leadId: "fresh", stage: "CONTACTED", lastActivityAgeMs: 60_000 }),
      ]),
    );
    expect(q.totals).toEqual({ callToday: 0, followUp: 0, stuckHot: 0 });
  });

  it("each queued item carries a bucket tag matching its array", () => {
    const q = buildActionQueue(
      brief([
        item({ leadId: "r", stage: "REPLIED" }),
        item({ leadId: "c", stage: "CONTACTED", lastActivityAgeMs: FOUR_DAYS_MS }),
        item({ leadId: "h", stage: "NEW", score: 90, lastActivityAgeMs: FOUR_DAYS_MS }),
      ]),
    );
    expect(q.callToday[0].bucket).toBe("callToday");
    expect(q.followUp[0].bucket).toBe("followUp");
    expect(q.stuckHot[0].bucket).toBe("stuckHot");
  });
});
