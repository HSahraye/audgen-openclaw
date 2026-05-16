import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import {
  createAuditAccessToken,
  verifyAuditAccessToken,
} from "./audit-links";

beforeAll(() => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://x:x@localhost:5432/x?schema=public";
  // Stable test secret so tokens are reproducible
  process.env.AUDIT_LINK_SECRET = process.env.AUDIT_LINK_SECRET || "test-audit-secret-32-characters-long-x";
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * These tests harden the signed-link primitives against the failure modes
 * that matter for a public sharing surface: forged signatures, swapped
 * lead ids, tampered payloads, malformed tokens, and expiration.
 */
describe("audit link security", () => {
  it("rejects malformed tokens (no dot)", () => {
    expect(verifyAuditAccessToken("not-a-real-token", "lead_x")).toBe(false);
    expect(verifyAuditAccessToken("", "lead_x")).toBe(false);
  });

  it("rejects tokens with more than two segments", () => {
    expect(verifyAuditAccessToken("a.b.c", "lead_x")).toBe(false);
  });

  it("rejects a forged signature for a valid payload shape", () => {
    const real = createAuditAccessToken("lead_a", 120);
    const [payload] = real.split(".");
    const tampered = `${payload}.${"A".repeat(43)}`;
    expect(verifyAuditAccessToken(tampered, "lead_a")).toBe(false);
  });

  it("rejects a token whose payload has been swapped to a different leadId", () => {
    // Build a payload claiming lead_b but signed for lead_a's original token.
    const token = createAuditAccessToken("lead_a", 120);
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ leadId: "lead_b", exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString("base64url");
    const stitched = `${fakePayload}.${sig}`;
    expect(verifyAuditAccessToken(stitched, "lead_b")).toBe(false);
  });

  it("returns false when the leadId arg doesn't match the token", () => {
    const token = createAuditAccessToken("lead_a", 120);
    expect(verifyAuditAccessToken(token, "lead_b")).toBe(false);
    expect(verifyAuditAccessToken(token, "")).toBe(false);
  });

  it("enforces minimum TTL of 60 seconds when caller passes 0/negative", () => {
    const token0 = createAuditAccessToken("lead_a", 0);
    const tokenNeg = createAuditAccessToken("lead_a", -500);
    // Both should still verify *right now* because the minimum 60s TTL is
    // enforced via Math.max(60, ttlSeconds).
    expect(verifyAuditAccessToken(token0, "lead_a")).toBe(true);
    expect(verifyAuditAccessToken(tokenNeg, "lead_a")).toBe(true);
  });

  it("rejects expired tokens", () => {
    // Issue a token with the minimum 60s TTL.
    const baseNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    const token = createAuditAccessToken("lead_a", 60);
    expect(verifyAuditAccessToken(token, "lead_a")).toBe(true);
    // Fast-forward 61 seconds: token must be expired.
    vi.setSystemTime(baseNow + 61_000);
    expect(verifyAuditAccessToken(token, "lead_a")).toBe(false);
  });

  it("two independently generated tokens are unique even for the same lead", () => {
    // Different exp timestamps mean different payloads → different signatures.
    const baseNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    const a = createAuditAccessToken("lead_a", 120);
    vi.setSystemTime(baseNow + 2_000);
    const b = createAuditAccessToken("lead_a", 120);
    expect(a).not.toBe(b);
    expect(verifyAuditAccessToken(a, "lead_a")).toBe(true);
    expect(verifyAuditAccessToken(b, "lead_a")).toBe(true);
  });
});
