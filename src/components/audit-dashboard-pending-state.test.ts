import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseLeadForDashboard } from "./audit-dashboard-utils";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DASHBOARD_SOURCE = readFileSync(
  path.resolve(REPO_ROOT, "src/components/audit-dashboard.tsx"),
  "utf8",
);

const consoleWarnSpy = vi.fn();
const originalWarn = console.warn;

beforeEach(() => {
  consoleWarnSpy.mockReset();
  console.warn = consoleWarnSpy;
});

afterEach(() => {
  console.warn = originalWarn;
});

const AUDIT_PENDING_FRESHNESS_MS = 5 * 60 * 1000;

describe("parseLeadForDashboard — async pending state", () => {
  it("surfaces audit.pending=true when the auditJson carries a fresh pending marker", () => {
    const lead = {
      id: "lead_pending_1",
      businessName: "Pending Co",
      status: "New",
      auditJson: JSON.stringify({
        pending: true,
        requestedAt: new Date().toISOString(),
        checks: { hasWebsite: true },
        source: "claude",
      }),
      assetsJson: JSON.stringify({
        coldCallScript: "stub",
        textMessageScript: "stub",
        emailScript: "stub",
        thirtySecondPitch: "stub",
        followUpMessage: "stub",
        proposalOutline: ["a", "b", "c", "d", "e", "f"],
        leadScore: 50,
        painPointSummary: "stub",
        recommendedPackage: "stub",
        likelyMoneyLost: "stub",
        presenceLabsOffer: "stub",
      }),
      intelligenceJson: null,
    };
    const parsed = parseLeadForDashboard(lead);
    expect(parsed.audit.pending).toBe(true);
    expect(parsed.audit.requestedAt).toBeTruthy();
  });

  it("treats stale pending markers (>5 min old) as not pending so the user can retry", () => {
    const staleIso = new Date(Date.now() - AUDIT_PENDING_FRESHNESS_MS - 60_000).toISOString();
    const lead = {
      id: "lead_stale_1",
      businessName: "Stale Co",
      status: "New",
      auditJson: JSON.stringify({
        pending: true,
        requestedAt: staleIso,
        checks: {},
        source: "claude",
      }),
      assetsJson: JSON.stringify({}),
      intelligenceJson: null,
    };
    const parsed = parseLeadForDashboard(lead);
    expect(parsed.audit.pending).toBe(false);
    expect(parsed.audit.requestedAt).toBeNull();
  });

  it("treats pending=true without requestedAt as not pending (defensive)", () => {
    const lead = {
      id: "lead_no_ts",
      businessName: "No-Timestamp Co",
      status: "New",
      auditJson: JSON.stringify({ pending: true, checks: {}, source: "claude" }),
      assetsJson: JSON.stringify({}),
      intelligenceJson: null,
    };
    expect(parseLeadForDashboard(lead).audit.pending).toBe(false);
  });

  it("treats pending with non-string requestedAt as not pending", () => {
    const lead = {
      id: "lead_bad_ts",
      businessName: "Bad Timestamp Co",
      status: "New",
      auditJson: JSON.stringify({ pending: true, requestedAt: 12345, checks: {}, source: "claude" }),
      assetsJson: JSON.stringify({}),
      intelligenceJson: null,
    };
    expect(parseLeadForDashboard(lead).audit.pending).toBe(false);
  });

  it("returns audit.pending=false on healthy non-pending leads", () => {
    const lead = {
      id: "lead_healthy",
      businessName: "Healthy Co",
      status: "New",
      auditJson: JSON.stringify({
        checks: {
          hasWebsite: true,
          outdatedWebsite: false,
          mobileFriendly: true,
          clearCta: true,
          phoneEasyToFind: true,
          reviewsVisible: true,
          onlineBooking: false,
          trustSection: true,
          gallery: false,
          serviceList: true,
          pricing: false,
          faq: false,
        },
        websiteSignals: [],
        warnings: [],
        source: "claude",
      }),
      assetsJson: JSON.stringify({
        leadScore: 80,
        painPointSummary: "stub",
        recommendedPackage: "stub",
        likelyMoneyLost: "stub",
        presenceLabsOffer: "stub",
        coldCallScript: "stub",
        textMessageScript: "stub",
        emailScript: "stub",
        thirtySecondPitch: "stub",
        followUpMessage: "stub",
        proposalOutline: ["a", "b", "c", "d", "e", "f"],
      }),
      intelligenceJson: null,
    };
    expect(parseLeadForDashboard(lead).audit.pending).toBe(false);
    expect(parseLeadForDashboard(lead).audit.requestedAt).toBeNull();
  });
});

describe("dashboard polling effect — pinned by static-source-code analysis", () => {
  it("audit-dashboard.tsx subscribes to a polling interval when any lead has audit.pending", () => {
    // The polling effect MUST exist and depend on a derived
    // `anyLeadAuditPending` boolean (NOT on parsedLeads itself, which
    // would re-arm on every render and cause a flicker). Pin both.
    expect(DASHBOARD_SOURCE).toMatch(/anyLeadAuditPending\s*=\s*parsedLeads\.some\(\(lead\)\s*=>\s*lead\.audit\.pending\s*===\s*true\)/);
    // useEffect with the right dependency, calling router.refresh.
    expect(DASHBOARD_SOURCE).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(!anyLeadAuditPending\)\s*return;[\s\S]*?setInterval\([\s\S]*?router\.refresh\(\)/);
  });

  it("polling interval is cleaned up on unmount / dependency change", () => {
    expect(DASHBOARD_SOURCE).toMatch(/return\s*\(\)\s*=>\s*window\.clearInterval\(intervalId\)/);
  });

  it("per-row Regenerate button is disabled when audit.pending is true (single-in-flight per row)", () => {
    // The button disable must include audit.pending so a row whose
    // background regeneration is in flight cannot be re-triggered
    // even by a fresh page load.
    const regenerateLabelIdx = DASHBOARD_SOURCE.indexOf("Regenerate (Claude)");
    expect(regenerateLabelIdx).toBeGreaterThan(0);
    const buttonChunk = DASHBOARD_SOURCE.slice(
      Math.max(0, regenerateLabelIdx - 2000),
      regenerateLabelIdx + 200,
    );
    expect(buttonChunk).toMatch(/disabled=\{[\s\S]*?lead\.audit\.pending\s*===\s*true/);
  });

  it("per-row button shows 'Generating…' label when audit.pending is true (UX confirmation that work is in flight)", () => {
    const regenerateLabelIdx = DASHBOARD_SOURCE.indexOf("Regenerate (Claude)");
    const buttonChunk = DASHBOARD_SOURCE.slice(
      Math.max(0, regenerateLabelIdx - 2000),
      regenerateLabelIdx + 600,
    );
    expect(buttonChunk).toMatch(/lead\.audit\.pending\s*===\s*true[\s\S]*?Generating…/);
  });
});

describe("regenerateLeadAction — async-routing invariants pinned by source", () => {
  const ACTION_SOURCE = readFileSync(
    path.resolve(REPO_ROOT, "src/app/actions/leads.ts"),
    "utf8",
  );

  it("uses the async path (Background Function) when ANTHROPIC_API_KEY + AUDIT_INTERNAL_SECRET are both set", () => {
    expect(ACTION_SOURCE).toMatch(/llmEnabled\s*=\s*Boolean\(process\.env\.ANTHROPIC_API_KEY/);
    expect(ACTION_SOURCE).toMatch(/internalSecret\s*=\s*process\.env\.AUDIT_INTERNAL_SECRET/);
    expect(ACTION_SOURCE).toMatch(/if\s*\(llmEnabled\s*&&\s*internalSecret\)/);
    expect(ACTION_SOURCE).toMatch(/buildPendingAuditJson/);
    expect(ACTION_SOURCE).toMatch(/signAuditBackgroundRequest/);
    expect(ACTION_SOURCE).toMatch(/AUDIT_BACKGROUND_FUNCTION_PATH/);
  });

  it("REFUSES the half-configured state (LLM key set but internal secret absent)", () => {
    // Without this guard, the operator who sets ANTHROPIC_API_KEY but
    // forgets AUDIT_INTERNAL_SECRET would silently get the timeout
    // failure mode the operator just hit.
    expect(ACTION_SOURCE).toMatch(/if\s*\(llmEnabled\s*&&\s*!internalSecret\)/);
    expect(ACTION_SOURCE).toMatch(/AUDIT_INTERNAL_SECRET is required/);
  });

  it("checks isAuditPending before enqueuing — anti-double-click protection", () => {
    expect(ACTION_SOURCE).toMatch(/if\s*\(isAuditPending\(lead\.auditJson\)\)/);
  });

  it("preserves the synchronous templated path when no LLM key is set", () => {
    // The fallback-templated path must still exist for operators
    // running without Claude. A bug in the routing logic that
    // forced everyone through the BG-function path would break
    // every workspace that hasn't set the API key.
    expect(ACTION_SOURCE).toMatch(/SYNC PATH \(no LLM key\)/);
    expect(ACTION_SOURCE).toMatch(/await generateAudit\(\{/);
  });
});
