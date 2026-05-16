import { describe, it, expect } from "vitest";

/**
 * Edge-case coverage for the scrubTokens mirror in scrub.test.ts. Keep this
 * file in lockstep with the implementation referenced by
 * src/app/api/auth/[...all]/route.ts — any change to the route's scrubTokens
 * must be reflected here AND in scrub.test.ts.
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

describe("scrubTokens edge cases", () => {
  it("passes through primitives untouched", () => {
    expect(scrubTokens("hello")).toBe("hello");
    expect(scrubTokens(42)).toBe(42);
    expect(scrubTokens(true)).toBe(true);
    expect(scrubTokens(false)).toBe(false);
    expect(scrubTokens(null)).toBe(null);
    expect(scrubTokens(undefined)).toBe(undefined);
  });

  it("recurses through deeply nested token fields", () => {
    const out = scrubTokens({
      a: {
        b: {
          c: { token: "deep-secret", id: "deep-id" },
          token: "mid-secret",
        },
      },
    });
    expect(out).toEqual({ a: { b: { c: { id: "deep-id" } } } });
  });

  it("scrubs token fields inside arrays-of-arrays", () => {
    const out = scrubTokens([
      [{ token: "a", id: "1" }],
      [{ token: "b", id: "2" }, { id: "3" }],
    ]);
    expect(out).toEqual([[{ id: "1" }], [{ id: "2" }, { id: "3" }]]);
  });

  it("preserves an empty object as-is", () => {
    expect(scrubTokens({})).toEqual({});
  });

  it("preserves an empty array as-is", () => {
    expect(scrubTokens([])).toEqual([]);
  });

  it("only strips the literal key 'token', not lookalikes", () => {
    // Important contract: the scrubber is intentionally narrow. Broader
    // patterns live in src/lib/logger.ts. This API path scrubs ONLY 'token'
    // because better-auth's list-sessions response uses that exact key.
    const out = scrubTokens({
      token: "secret",
      tokens: ["a", "b"],
      tokenHash: "h",
      accessToken: "AT",
      refreshToken: "RT",
    });
    expect(out).toEqual({
      tokens: ["a", "b"],
      tokenHash: "h",
      accessToken: "AT",
      refreshToken: "RT",
    });
  });

  it("preserves nested non-token fields' values and types", () => {
    const ts = new Date("2026-05-16T00:00:00Z").toISOString();
    const out = scrubTokens({
      session: {
        token: "secret",
        id: "s1",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
        revoked: false,
        expiresAt: ts,
        scopes: ["read", "write"],
      },
    });
    expect(out).toEqual({
      session: {
        id: "s1",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
        revoked: false,
        expiresAt: ts,
        scopes: ["read", "write"],
      },
    });
  });
});
