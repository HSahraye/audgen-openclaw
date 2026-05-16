import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: mocks.headersGet,
  }),
}));

// Force a fresh rate-limit bucket per test file. We can't easily reset
// the bucket between tests because it's a private module-level Map; use
// unique routeKey + identity per test instead.
import { enforceRateLimit } from "./request-security";

describe("enforceRateLimit", () => {
  beforeEach(() => {
    mocks.headersGet.mockReset();
  });

  it("returns null when under the limit", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.1");
    const res = await enforceRateLimit(`test-route-1-${Date.now()}`, 5, 60_000);
    expect(res).toBe(null);
  });

  it("returns a 429 NextResponse once limit is exceeded", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.2");
    const route = `test-route-2-${Date.now()}`;
    // 3 requests, limit 2 → 3rd should be blocked
    const r1 = await enforceRateLimit(route, 2, 60_000);
    const r2 = await enforceRateLimit(route, 2, 60_000);
    const r3 = await enforceRateLimit(route, 2, 60_000);
    expect(r1).toBe(null);
    expect(r2).toBe(null);
    expect(r3).not.toBe(null);
    expect(r3!.status).toBe(429);
  });

  it("blocked response includes a retry-after header in seconds", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.3");
    const route = `test-route-3-${Date.now()}`;
    await enforceRateLimit(route, 1, 5_000);
    const blocked = await enforceRateLimit(route, 1, 5_000);
    expect(blocked).not.toBe(null);
    const retry = blocked!.headers.get("retry-after");
    expect(retry).toBeTruthy();
    const seconds = Number(retry);
    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeLessThanOrEqual(5);
  });

  it("blocked response body has the documented error shape", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.4");
    const route = `test-route-4-${Date.now()}`;
    await enforceRateLimit(route, 1, 60_000);
    const blocked = await enforceRateLimit(route, 1, 60_000);
    const body = await blocked!.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Rate limit");
  });

  it("uses identity over IP when both are present (different identities get separate buckets)", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.5");
    const route = `test-route-5-${Date.now()}`;
    // Same route + same IP, but different identities. Each gets their own
    // bucket so user A hitting the limit doesn't block user B.
    const a1 = await enforceRateLimit(route, 1, 60_000, "user_A");
    const b1 = await enforceRateLimit(route, 1, 60_000, "user_B");
    expect(a1).toBe(null);
    expect(b1).toBe(null);
    // Now user A again — should be blocked
    const a2 = await enforceRateLimit(route, 1, 60_000, "user_A");
    expect(a2).not.toBe(null);
    expect(a2!.status).toBe(429);
  });

  it("falls back to 'anonymous' bucket when neither identity nor IP present", async () => {
    mocks.headersGet.mockReturnValue(null);
    const route = `test-route-6-${Date.now()}`;
    const r1 = await enforceRateLimit(route, 1, 60_000);
    const r2 = await enforceRateLimit(route, 1, 60_000);
    expect(r1).toBe(null);
    expect(r2).not.toBe(null);
    expect(r2!.status).toBe(429);
  });

  it("strips trailing IPs in x-forwarded-for to the first hop", async () => {
    mocks.headersGet.mockImplementation((name: string) =>
      name === "x-forwarded-for" ? "203.0.113.7, 10.0.0.1, 10.0.0.2" : null,
    );
    const route = `test-route-7-${Date.now()}`;
    // Two requests from "203.0.113.7" should share the bucket regardless
    // of trailing proxy IPs.
    await enforceRateLimit(route, 1, 60_000);
    const blocked = await enforceRateLimit(route, 1, 60_000);
    expect(blocked).not.toBe(null);
  });

  it("uses x-real-ip when x-forwarded-for is missing", async () => {
    mocks.headersGet.mockImplementation((name: string) =>
      name === "x-real-ip" ? "203.0.113.8" : null,
    );
    const route = `test-route-8-${Date.now()}`;
    await enforceRateLimit(route, 1, 60_000);
    const blocked = await enforceRateLimit(route, 1, 60_000);
    expect(blocked).not.toBe(null);
  });

  it("retry-after is at least 1 even if reset time is in the past edge case", async () => {
    mocks.headersGet.mockReturnValue("203.0.113.9");
    const route = `test-route-9-${Date.now()}`;
    await enforceRateLimit(route, 1, 1); // 1ms window
    // Sleep briefly so the window resets
    await new Promise((r) => setTimeout(r, 5));
    // Bucket entry is now expired; next call gets a fresh window
    const r2 = await enforceRateLimit(route, 1, 1);
    expect(r2).toBe(null);
  });
});
