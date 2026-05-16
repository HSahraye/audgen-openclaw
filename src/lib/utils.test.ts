import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cn, formatRelativeTime } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("skips falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "", "c")).toBe("a c");
  });

  it("handles conditional shapes from clsx", () => {
    expect(cn("a", { b: true, c: false }, ["d", "e"])).toBe("a b d e");
  });

  it("dedupes conflicting Tailwind classes via twMerge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    // twMerge knows p-* supersedes px-*, so the final p-3 wins outright.
    expect(cn("p-2 px-4", "p-3")).toBe("p-3");
  });
});

describe("formatRelativeTime", () => {
  const FIXED_NOW = new Date("2026-05-16T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for the current moment", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW))).toBe("just now");
    // <30s ago rounds to 0 minutes
    expect(formatRelativeTime(new Date(FIXED_NOW - 15_000))).toBe("just now");
  });

  it("rounds up: 30s ago lands at 1m (Math.round, not floor)", () => {
    // Locks in the documented rounding behavior — change with care because
    // dashboards display this everywhere; a switch to floor would visibly
    // shift every relative timestamp by ~30s.
    expect(formatRelativeTime(new Date(FIXED_NOW - 30_000))).toBe("1m ago");
  });

  it("returns minutes for the first hour", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 60_000))).toBe("1m ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 59 * 60_000))).toBe("59m ago");
  });

  it("returns hours for the first day", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 60 * 60_000))).toBe("1h ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 5 * 60 * 60_000))).toBe("5h ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 23 * 60 * 60_000))).toBe("23h ago");
  });

  it("returns days for 1-6 days old", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 24 * 60 * 60_000))).toBe("1d ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 6 * 24 * 60 * 60_000))).toBe("6d ago");
  });

  it("returns weeks for 1-4 weeks old", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 7 * 24 * 60 * 60_000))).toBe("1w ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 14 * 24 * 60 * 60_000))).toBe("2w ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 21 * 24 * 60 * 60_000))).toBe("3w ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 28 * 24 * 60 * 60_000))).toBe("4w ago");
  });

  it("returns months for 1-11 months old", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 35 * 24 * 60 * 60_000))).toBe("1mo ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 90 * 24 * 60 * 60_000))).toBe("3mo ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 180 * 24 * 60 * 60_000))).toBe("6mo ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 330 * 24 * 60 * 60_000))).toBe("11mo ago");
  });

  it("returns years for 1+ year old", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 365 * 24 * 60 * 60_000))).toBe("1y ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 2 * 365 * 24 * 60 * 60_000))).toBe("2y ago");
    expect(formatRelativeTime(new Date(FIXED_NOW - 10 * 365 * 24 * 60 * 60_000))).toBe("10y ago");
  });

  it("accepts string inputs (ISO format)", () => {
    expect(formatRelativeTime(new Date(FIXED_NOW - 60 * 60_000).toISOString())).toBe(
      "1h ago",
    );
  });

  it("clamps future timestamps to 'just now' instead of negative time", () => {
    const future = new Date(FIXED_NOW + 60 * 60_000);
    expect(formatRelativeTime(future)).toBe("just now");
  });
});
