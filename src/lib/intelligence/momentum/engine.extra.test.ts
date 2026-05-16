import { describe, it, expect } from "vitest";
import { computeLeadMomentum } from "./engine";

describe("computeLeadMomentum — score caps", () => {
  it("clamps momentum to [0, 100]", () => {
    const maxed = computeLeadMomentum({
      viewCount: 1000,
      revisitCount: 1000,
      paymentClickCount: 1000,
      responseCount: 1000,
      proposalOpenCount: 1000,
      outreachRecencyHours: 1,
    });
    expect(maxed.momentumScore).toBeLessThanOrEqual(100);
    expect(maxed.momentumScore).toBeGreaterThanOrEqual(0);

    const zeroed = computeLeadMomentum({});
    expect(zeroed.momentumScore).toBeLessThanOrEqual(100);
    expect(zeroed.momentumScore).toBeGreaterThanOrEqual(0);
  });

  it("rounds momentum to integer", () => {
    const out = computeLeadMomentum({ viewCount: 1 });
    expect(Number.isInteger(out.momentumScore)).toBe(true);
  });

  it("caps individual signal contributions", () => {
    // Per the source: views capped at 28, revisits at 22, payments at 25,
    // responses at 16, proposalOpens at 12. A truly saturated signal set
    // can hit the ceiling of 100 (base 12 + 28+22+25+16+12 + 8 fresh = 123,
    // clamped to 100).
    const saturated = computeLeadMomentum({
      viewCount: 100,
      revisitCount: 100,
      paymentClickCount: 100,
      responseCount: 100,
      proposalOpenCount: 100,
      outreachRecencyHours: 1,
    });
    expect(saturated.momentumScore).toBe(100);
  });
});

describe("computeLeadMomentum — trend thresholds", () => {
  it("returns 'cooling' when no signals at all (default outreachRecencyHours=999 triggers stale penalty)", () => {
    // This pins the documented default behaviour: an empty input is
    // treated as 'we haven't heard from them in forever' which scores
    // 12 - 6 = 6, well below the 38 cooling threshold.
    const out = computeLeadMomentum({});
    expect(out.engagementTrend).toBe("cooling");
    expect(out.urgencyDelta).toBe(-10);
  });

  it("returns 'rising' only at momentumScore >= 68", () => {
    const rising = computeLeadMomentum({
      viewCount: 4,
      revisitCount: 4,
      paymentClickCount: 2,
      responseCount: 2,
      outreachRecencyHours: 10,
    });
    expect(rising.momentumScore).toBeGreaterThanOrEqual(68);
    expect(rising.engagementTrend).toBe("rising");
  });

  it("returns 'cooling' below momentumScore 38", () => {
    const cooling = computeLeadMomentum({
      viewCount: 0,
      revisitCount: 0,
      outreachRecencyHours: 200,
      followUpOverdueHours: 80,
      statusAgeDays: 30,
    });
    expect(cooling.momentumScore).toBeLessThan(38);
    expect(cooling.engagementTrend).toBe("cooling");
  });

  it("assigns urgencyDelta +12/0/-10 for rising/stable/cooling", () => {
    const rising = computeLeadMomentum({
      viewCount: 5,
      revisitCount: 4,
      paymentClickCount: 2,
      responseCount: 2,
      outreachRecencyHours: 6,
    });
    const cooling = computeLeadMomentum({
      outreachRecencyHours: 300,
      followUpOverdueHours: 100,
      statusAgeDays: 40,
    });
    expect(rising.urgencyDelta).toBe(12);
    expect(cooling.urgencyDelta).toBe(-10);
  });
});

describe("computeLeadMomentum — recommended action copy", () => {
  it("rising + paymentClicks → 'Call now and move toward close ...'", () => {
    const out = computeLeadMomentum({
      viewCount: 4,
      revisitCount: 4,
      paymentClickCount: 3,
      outreachRecencyHours: 6,
    });
    expect(out.engagementTrend).toBe("rising");
    expect(out.recommendedAction).toContain("Call now");
  });

  it("rising + no paymentClicks → 'Send direct CTA follow-up ...'", () => {
    const out = computeLeadMomentum({
      viewCount: 4,
      revisitCount: 4,
      responseCount: 3,
      outreachRecencyHours: 6,
    });
    expect(out.engagementTrend).toBe("rising");
    expect(out.recommendedAction).toContain("Send direct CTA");
  });

  it("cooling + heavily-overdue → 'Re-engage with a short value recap ...'", () => {
    const out = computeLeadMomentum({
      outreachRecencyHours: 200,
      followUpOverdueHours: 100,
      statusAgeDays: 30,
    });
    expect(out.engagementTrend).toBe("cooling");
    expect(out.recommendedAction).toContain("Re-engage");
  });

  it("cooling + mildly-overdue → 'Rotate channel ...'", () => {
    const out = computeLeadMomentum({
      outreachRecencyHours: 200,
      followUpOverdueHours: 10,
      statusAgeDays: 30,
    });
    expect(out.engagementTrend).toBe("cooling");
    expect(out.recommendedAction).toContain("Rotate channel");
  });

  it("stable → 'Maintain weekly follow-up cadence.'", () => {
    // baseline 12 + 5 views (=20) + 2 revisits (=10) + 1 response (=8) +
    // outreachRecency=50 (no bonus, no penalty) → 50, lands in [38, 67].
    const out = computeLeadMomentum({
      viewCount: 5,
      revisitCount: 2,
      responseCount: 1,
      outreachRecencyHours: 50,
    });
    expect(out.engagementTrend).toBe("stable");
    expect(out.recommendedAction).toBe("Maintain weekly follow-up cadence.");
  });
});
