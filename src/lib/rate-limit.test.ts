import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

/**
 * Tests for the in-memory rate-limit bucket. We can't reset the bucket
 * between tests, so each test uses a unique key (timestamp + suffix) to
 * keep state isolated.
 */
function uniqueKey(suffix: string) {
  return `rl-test-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
}

describe("checkRateLimit", () => {
  it("first request always passes with the configured limit", () => {
    const out = checkRateLimit(uniqueKey("first"), 5, 60_000);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.remaining).toBe(4);
      expect(out.resetAt).toBeGreaterThan(Date.now());
    }
  });

  it("decrements remaining on each successive call", () => {
    const key = uniqueKey("dec");
    const a = checkRateLimit(key, 3, 60_000);
    const b = checkRateLimit(key, 3, 60_000);
    const c = checkRateLimit(key, 3, 60_000);
    expect(a.ok && a.remaining).toBe(2);
    expect(b.ok && b.remaining).toBe(1);
    expect(c.ok && c.remaining).toBe(0);
  });

  it("blocks the (limit+1)-th request in the window", () => {
    const key = uniqueKey("block");
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("returns the same resetAt across successive ok responses (window doesn't slide)", () => {
    const key = uniqueKey("nosliding");
    const a = checkRateLimit(key, 5, 60_000);
    const b = checkRateLimit(key, 5, 60_000);
    expect(a.resetAt).toBe(b.resetAt);
  });

  it("starts a fresh window after the resetAt passes", async () => {
    const key = uniqueKey("reset");
    const first = checkRateLimit(key, 1, 1); // 1ms window
    expect(first.ok).toBe(true);
    // Sleep past the window
    await new Promise((r) => setTimeout(r, 10));
    const reopened = checkRateLimit(key, 1, 60_000);
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      // New window means remaining starts at limit-1 again
      expect(reopened.remaining).toBe(0);
    }
  });

  it("different keys have independent buckets", () => {
    const keyA = uniqueKey("indepA");
    const keyB = uniqueKey("indepB");
    checkRateLimit(keyA, 1, 60_000);
    const aBlocked = checkRateLimit(keyA, 1, 60_000);
    const bAllowed = checkRateLimit(keyB, 1, 60_000);
    expect(aBlocked.ok).toBe(false);
    expect(bAllowed.ok).toBe(true);
  });

  it("limit of 1 means only the first call passes", () => {
    const key = uniqueKey("limit1");
    expect(checkRateLimit(key, 1, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 1, 60_000).ok).toBe(false);
  });

  it("zero or negative remaining is reported as 0, never negative", () => {
    const key = uniqueKey("clamp");
    checkRateLimit(key, 1, 60_000);
    const second = checkRateLimit(key, 1, 60_000);
    expect(second.remaining).toBe(0);
    expect(second.remaining).toBeGreaterThanOrEqual(0);
  });
});
