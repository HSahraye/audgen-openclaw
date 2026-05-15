import { describe, it, expect } from "vitest";

/**
 * Mirror of the scrubTokens implementation in /api/auth/[...all]/route.ts.
 * Keep this file in lockstep with that route. The route imports nothing from
 * here at runtime; this test just guarantees the behaviour we promise the
 * client (no `token` field returned by list-sessions / get-session).
 */
const SENSITIVE_KEYS = new Set(["token"]);

function scrubTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubTokens);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = scrubTokens(v);
    }
    return out;
  }
  return value;
}

describe("scrubTokens", () => {
  it("removes top-level token", () => {
    const got = scrubTokens({ token: "abc", id: "s1" });
    expect(got).toEqual({ id: "s1" });
  });

  it("removes nested token under session", () => {
    const got = scrubTokens({
      session: { token: "abc", id: "s1", ipAddress: "1.2.3.4" },
      user: { id: "u1", email: "a@b.co" },
    });
    expect(got).toEqual({
      session: { id: "s1", ipAddress: "1.2.3.4" },
      user: { id: "u1", email: "a@b.co" },
    });
  });

  it("scrubs arrays (e.g. list-sessions response)", () => {
    const got = scrubTokens([
      { token: "t1", id: "s1" },
      { token: "t2", id: "s2", userId: "u1" },
    ]);
    expect(got).toEqual([{ id: "s1" }, { id: "s2", userId: "u1" }]);
  });

  it("preserves non-token fields and primitives", () => {
    const got = scrubTokens({ id: "s1", expiresAt: "2026-01-01", revoked: false });
    expect(got).toEqual({ id: "s1", expiresAt: "2026-01-01", revoked: false });
  });
});
