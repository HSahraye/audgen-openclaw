// Async-audit-generation utilities.
//
// Why this exists:
//
// `generateLlmAudit` (Claude Sonnet 4.6, max_tokens=4000) takes 30-90
// seconds to produce the full audit schema. That's longer than ANY
// Netlify synchronous function timeout (10s on Free, 26s on Pro,
// 30s on Enterprise). The previous architecture wired the LLM call
// straight into the `regenerateLeadAction` server action, which got
// killed by the function timeout and returned an "An unexpected
// response was received from the server" error in the UI.
//
// The fix is a Netlify Background Function (15-minute timeout):
//
//   1. `regenerateLeadAction` writes a `pending: true` marker into
//      `Lead.auditJson` and fires off a POST to the Background
//      Function endpoint (fire-and-forget — the action doesn't wait
//      for the LLM to finish).
//   2. `regenerateLeadAction` returns `{ ok: true, status: 'pending' }`
//      to the UI in <500ms.
//   3. Dashboard sees `audit.pending === true` and starts polling
//      `router.refresh()` every 8 seconds.
//   4. Background function runs `generateAudit()` (which calls the
//      LLM) and writes the final audit to `Lead.auditJson` + clears
//      the pending marker.
//   5. Next dashboard poll picks up the new content and the polling
//      loop stops automatically.
//
// HMAC + timestamp validation prevents random callers from hitting
// the public Background Function endpoint and triggering arbitrary
// audit regenerations. The shared secret is `AUDIT_INTERNAL_SECRET`,
// set on Netlify production by the operator.

import { createHmac, timingSafeEqual } from "node:crypto";

export const AUDIT_BACKGROUND_FUNCTION_PATH = "/.netlify/functions/llm-audit-generate-background";

export const AUDIT_BACKGROUND_HEADERS = {
  signature: "x-audgen-audit-signature",
  timestamp: "x-audgen-audit-timestamp",
  leadId: "x-audgen-audit-lead-id",
  workspaceId: "x-audgen-audit-workspace-id",
} as const;

/**
 * Maximum acceptable clock skew between sender (server action) and
 * receiver (background function). 5 minutes is generous enough to
 * absorb any reasonable Lambda cold-start delay; tighter would risk
 * spurious 403s on slow days, looser would let a leaked HMAC be
 * replayed for too long.
 */
export const AUDIT_BACKGROUND_FRESHNESS_MS = 5 * 60 * 1000;

export type AuditBackgroundPayload = {
  leadId: string;
  workspaceId: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
};

/** The exact byte sequence both signer and verifier hash. */
export function buildSignaturePayload(p: AuditBackgroundPayload): string {
  return `${p.leadId}:${p.workspaceId}:${p.timestamp}`;
}

export function signAuditBackgroundRequest(p: AuditBackgroundPayload, secret: string): string {
  return createHmac("sha256", secret).update(buildSignaturePayload(p)).digest("hex");
}

export function verifyAuditBackgroundRequest(
  p: AuditBackgroundPayload,
  signature: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(p.timestamp)) return false;
  if (Math.abs(now - p.timestamp) > AUDIT_BACKGROUND_FRESHNESS_MS) return false;
  const expected = signAuditBackgroundRequest(p, secret);
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Marker stored on `Lead.auditJson` while a background regeneration
 * is in-flight. The dashboard's parsedLeads useMemo surfaces this as
 * `audit.pending === true` and shows the row's Regenerate button as
 * disabled with a "Generating audit..." indicator until the
 * background function clears the marker.
 *
 * Defensive: if `requestedAt` is older than
 * `AUDIT_BACKGROUND_FRESHNESS_MS` we treat the marker as stale (the
 * background function must have crashed; the user can click
 * Regenerate again).
 */
export type PendingAuditMarker = {
  pending: true;
  requestedAt: string;
};

export function isAuditPending(auditJson: string, now = Date.now()): boolean {
  if (!auditJson || typeof auditJson !== "string") return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(auditJson);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const obj = parsed as Record<string, unknown>;
  if (obj.pending !== true) return false;
  if (typeof obj.requestedAt !== "string") return false;
  const requestedTime = Date.parse(obj.requestedAt);
  if (!Number.isFinite(requestedTime)) return false;
  return now - requestedTime < AUDIT_BACKGROUND_FRESHNESS_MS;
}

/**
 * Build the JSON payload that goes into Lead.auditJson when a
 * regeneration is enqueued. We PRESERVE the previous audit content
 * (so the user can keep reading it while the new one generates) and
 * just layer the pending marker on top.
 */
export function buildPendingAuditJson(previousAuditJson: string | null | undefined, now: Date = new Date()): string {
  let base: Record<string, unknown> = {};
  if (previousAuditJson) {
    try {
      const parsed = JSON.parse(previousAuditJson);
      if (parsed && typeof parsed === "object") {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      base = {};
    }
  }
  return JSON.stringify({
    ...base,
    pending: true,
    requestedAt: now.toISOString(),
  });
}

/**
 * Strip the pending marker from a previously-pending auditJson. Used
 * by the background function when LLM generation fails so the lead
 * doesn't stay stuck in pending state forever.
 */
export function stripPendingMarker(auditJson: string): string {
  let parsed: Record<string, unknown> = {};
  try {
    const candidate = JSON.parse(auditJson);
    if (candidate && typeof candidate === "object") {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }
  delete parsed.pending;
  delete parsed.requestedAt;
  return JSON.stringify(parsed);
}
