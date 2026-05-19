import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the production bug observed at 19:57 PT on
// 2026-05-18: the auth middleware intercepted server-to-server
// requests from `regenerateLeadAction` to the
// `/.netlify/functions/llm-audit-generate-background` endpoint and
// redirected them to /login (HTTP 307). The Background Function
// never received the call; the LLM never ran; the operator clicked
// Regenerate (Claude) and saw nothing happen.
//
// The fix excludes /.netlify/functions/ paths from the middleware's
// auth gate. These functions have their own HMAC-based auth (see
// src/lib/audit/audit-async.ts) so bypassing the middleware here
// does NOT weaken protection — it just lets internal server-to-
// server fetches reach their target.
//
// Tests pinned by static source analysis since the middleware is a
// pure function over the request URL.

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = readFileSync(path.resolve(REPO_ROOT, "middleware.ts"), "utf8");

describe("middleware — Netlify Functions bypass", () => {
  it("isInternalPath returns false for /.netlify/functions/ paths (early bypass)", () => {
    // Without this, the auth middleware's isAuthEnabled() branch
    // redirects the unauthenticated server-to-server fetch from
    // regenerateLeadAction to /login.
    expect(SOURCE).toMatch(/pathname\.startsWith\("\/\.netlify\/functions\/"\)\s*\)\s*return false/);
  });

  it("matcher config excludes /.netlify/functions/ from middleware invocation", () => {
    // Defense-in-depth: even before the function body runs, the
    // matcher skips these paths entirely. The source escapes the
    // backslash for the JS string literal: `\\.netlify` in source
    // becomes `\.netlify` in the compiled regex.
    expect(SOURCE).toMatch(/\\\\\.netlify\/functions\//);
  });

  it("does NOT widen the bypass to drop hard-gated /settings, /approvals, /automation/approvals", () => {
    // Sanity: the existing critical hard-gates (settings, approvals)
    // are unchanged. A regression that accidentally widened the
    // /.netlify/functions/ exclusion to a wildcard would expose
    // those routes.
    expect(SOURCE).toMatch(/isProtectedHardGate/);
    expect(SOURCE).toMatch(/pathname\.startsWith\("\/settings\/"\)\)\s*return true/);
    expect(SOURCE).toMatch(/pathname\.startsWith\("\/approvals\/"\)\)\s*return true/);
    expect(SOURCE).toMatch(/pathname\.startsWith\("\/automation\/approvals\/"\)\)\s*return true/);
  });
});
