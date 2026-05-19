import { describe, expect, it } from "vitest";
import {
  AUDIT_BACKGROUND_FRESHNESS_MS,
  AUDIT_BACKGROUND_HEADERS,
  buildPendingAuditJson,
  buildSignaturePayload,
  isAuditPending,
  signAuditBackgroundRequest,
  stripPendingMarker,
  verifyAuditBackgroundRequest,
} from "./audit-async";

const SECRET = "test-secret-of-sufficient-length-for-hmac";

describe("audit-async — HMAC signing & verification", () => {
  it("buildSignaturePayload produces the canonical bytes both signer and verifier hash", () => {
    const payload = buildSignaturePayload({ leadId: "lead_123", workspaceId: "ws_alpha", timestamp: 1700000000000 });
    expect(payload).toBe("lead_123:ws_alpha:1700000000000");
  });

  it("signAuditBackgroundRequest is deterministic for the same inputs + secret", () => {
    const a = signAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: 1 }, SECRET);
    const b = signAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: 1 }, SECRET);
    expect(a).toBe(b);
    // Different secret yields different signature.
    const c = signAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: 1 }, "other-secret");
    expect(a).not.toBe(c);
  });

  it("verifyAuditBackgroundRequest accepts a fresh signature signed with the same secret", () => {
    const now = Date.now();
    const sig = signAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: now }, SECRET);
    expect(verifyAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: now }, sig, SECRET, now)).toBe(true);
  });

  it("verifyAuditBackgroundRequest REJECTS a signature with the wrong secret", () => {
    const now = Date.now();
    const sig = signAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: now }, SECRET);
    expect(verifyAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: now }, sig, "other-secret", now)).toBe(false);
  });

  it("verifyAuditBackgroundRequest REJECTS a signature with a tampered payload (different leadId)", () => {
    const now = Date.now();
    const sig = signAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: now }, SECRET);
    expect(verifyAuditBackgroundRequest({ leadId: "lead_DIFFERENT", workspaceId: "ws_1", timestamp: now }, sig, SECRET, now)).toBe(false);
  });

  it("verifyAuditBackgroundRequest REJECTS a stale signature (>5 min old)", () => {
    const past = Date.now() - AUDIT_BACKGROUND_FRESHNESS_MS - 1_000;
    const sig = signAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: past }, SECRET);
    expect(verifyAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: past }, sig, SECRET)).toBe(false);
  });

  it("verifyAuditBackgroundRequest REJECTS a future-dated signature (clock skew abuse)", () => {
    const future = Date.now() + AUDIT_BACKGROUND_FRESHNESS_MS + 1_000;
    const sig = signAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: future }, SECRET);
    expect(verifyAuditBackgroundRequest({ leadId: "lead_1", workspaceId: "ws_1", timestamp: future }, sig, SECRET)).toBe(false);
  });

  it("verifyAuditBackgroundRequest REJECTS a signature with malformed (NaN) timestamp", () => {
    expect(verifyAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: NaN }, "deadbeef", SECRET)).toBe(false);
  });

  it("verifyAuditBackgroundRequest REJECTS a signature of wrong length (timing-safe-equal guard)", () => {
    const now = Date.now();
    const fullSig = signAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: now }, SECRET);
    const truncated = fullSig.slice(0, fullSig.length - 4);
    expect(verifyAuditBackgroundRequest({ leadId: "L", workspaceId: "W", timestamp: now }, truncated, SECRET, now)).toBe(false);
  });
});

describe("audit-async — header name constants pinned for cross-process integrity", () => {
  it("header names use the audgen-audit prefix and are stable", () => {
    // The Background Function reads these exact headers; the action
    // sends them. A typo in either side without the other would
    // silently break auth. Pinning them here forces a synchronized
    // edit if anyone renames.
    expect(AUDIT_BACKGROUND_HEADERS.signature).toBe("x-audgen-audit-signature");
    expect(AUDIT_BACKGROUND_HEADERS.timestamp).toBe("x-audgen-audit-timestamp");
    expect(AUDIT_BACKGROUND_HEADERS.leadId).toBe("x-audgen-audit-lead-id");
    expect(AUDIT_BACKGROUND_HEADERS.workspaceId).toBe("x-audgen-audit-workspace-id");
  });
});

describe("audit-async — pending-marker helpers", () => {
  it("isAuditPending returns true for a freshly-marked pending audit", () => {
    const json = buildPendingAuditJson(JSON.stringify({ checks: {}, source: "claude" }));
    expect(isAuditPending(json)).toBe(true);
  });

  it("isAuditPending returns false for a stale pending marker (>5 min old)", () => {
    const stalePastIso = new Date(Date.now() - AUDIT_BACKGROUND_FRESHNESS_MS - 60_000).toISOString();
    const stale = JSON.stringify({ pending: true, requestedAt: stalePastIso, checks: {} });
    expect(isAuditPending(stale)).toBe(false);
  });

  it("isAuditPending returns false for a non-pending audit", () => {
    const json = JSON.stringify({ checks: {}, source: "claude" });
    expect(isAuditPending(json)).toBe(false);
  });

  it("isAuditPending returns false for malformed JSON (defensive)", () => {
    expect(isAuditPending("{ broken")).toBe(false);
    expect(isAuditPending("")).toBe(false);
    expect(isAuditPending("null")).toBe(false);
    expect(isAuditPending("42")).toBe(false);
  });

  it("buildPendingAuditJson preserves the previous audit content (so the user can keep reading it)", () => {
    const prev = JSON.stringify({
      checks: { hasWebsite: true },
      source: "claude",
      aiGenerated: true,
      vertical: "hvac",
      warnings: ["existing warning"],
    });
    const next = JSON.parse(buildPendingAuditJson(prev));
    expect(next.checks).toEqual({ hasWebsite: true });
    expect(next.source).toBe("claude");
    expect(next.aiGenerated).toBe(true);
    expect(next.vertical).toBe("hvac");
    expect(next.warnings).toEqual(["existing warning"]);
    expect(next.pending).toBe(true);
    expect(typeof next.requestedAt).toBe("string");
  });

  it("buildPendingAuditJson produces a valid pending JSON when previous content is null/empty", () => {
    expect(JSON.parse(buildPendingAuditJson(null)).pending).toBe(true);
    expect(JSON.parse(buildPendingAuditJson(undefined)).pending).toBe(true);
    expect(JSON.parse(buildPendingAuditJson("")).pending).toBe(true);
  });

  it("buildPendingAuditJson tolerates malformed previous JSON without throwing", () => {
    const next = JSON.parse(buildPendingAuditJson("{ corrupt"));
    expect(next.pending).toBe(true);
    expect(typeof next.requestedAt).toBe("string");
  });

  it("stripPendingMarker removes pending fields but preserves everything else", () => {
    const input = JSON.stringify({
      pending: true,
      requestedAt: new Date().toISOString(),
      checks: { hasWebsite: true },
      source: "claude",
      aiGenerated: true,
    });
    const out = JSON.parse(stripPendingMarker(input));
    expect(out.pending).toBeUndefined();
    expect(out.requestedAt).toBeUndefined();
    expect(out.checks).toEqual({ hasWebsite: true });
    expect(out.source).toBe("claude");
    expect(out.aiGenerated).toBe(true);
  });

  it("stripPendingMarker returns valid JSON even on malformed input", () => {
    const out = stripPendingMarker("{ corrupted");
    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out)).toEqual({});
  });
});
