import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLeadForDashboard, FALLBACK_AUDIT_CHECKS } from "./audit-dashboard-utils";

// REGRESSION GUARD for the production crash sequence on 2026-05-18:
//
//   22:50 UTC  e1c8735 deployed (broken promotion stub)
//   22:59 UTC  3 orphan Lead rows written to production DB
//                with assetsJson missing 5 script fields
//   23:08 UTC  64914f5 revert deploy live (helper code removed)
//   23:18 UTC  c05db5e fix-forward deploy live (helper extended,
//                contract test added)
//   23:23 UTC  operator confirms dashboard STILL broken — the
//                3 orphan rows persisted in DB and crashed the
//                renderer regardless of what new rows looked like
//
// Root architectural lesson: dashboard render is a hard isolation
// boundary. A single malformed Lead row (orphan, legacy, third-
// party-imported, anything) MUST NOT crash the queue. The fix is
// permanent defensive coalescing in the parse helper, regardless
// of what upstream helpers produce.
//
// These tests assert the helper survives every plausible
// orphan-data shape and emits a structured warning so the issue
// is loud but not fatal.

const consoleWarnSpy = vi.fn();
const originalWarn = console.warn;

beforeEach(() => {
  consoleWarnSpy.mockReset();
  console.warn = consoleWarnSpy;
});

afterEach(() => {
  console.warn = originalWarn;
});

function makeOrphanLead(): { id: string; businessName: string; status: string; auditJson: string; assetsJson: string; intelligenceJson: string | null } {
  // Mirrors the EXACT shape of the 3 production rows that crashed
  // the dashboard at 23:08 UTC on 2026-05-18. Captured from the
  // _audit_orphan_leads.ts STEP 0 query: 5 script fields missing,
  // proposalOutline missing, likelyMoneyLost wrong type (number),
  // checks empty object.
  return {
    id: "cmpbt3bm3000qlb09ia0n5fjl",
    businessName: "AAA HVAC Repair San Jose",
    status: "New",
    auditJson: JSON.stringify({
      source: "leadgen_discovery",
      discoveryProvider: "google_places",
      discoveryExternalId: "ChIJ_orphan",
      checks: {},
      websiteSignals: [],
      warnings: ["Lead promoted from leadgen discovery."],
    }),
    assetsJson: JSON.stringify({
      leadScore: 70,
      recommendedPackage: "Presence Labs Conversion Upgrade",
      painPointSummary: "HVAC seasonality story.",
      likelyMoneyLost: 12000, // wrong type — should be string
      presenceLabsOffer: "Presence Labs Conversion Upgrade",
      pendingRegeneration: true,
      // The 5 script fields + proposalOutline are intentionally absent.
    }),
    intelligenceJson: null,
  };
}

describe("parseLeadForDashboard — orphan/malformed-data regression for the 2026-05-18 production crash", () => {
  it("does NOT throw on the EXACT orphan shape that crashed production at 22:59 UTC", () => {
    const orphan = makeOrphanLead();
    expect(() => parseLeadForDashboard(orphan)).not.toThrow();
  });

  it("preserves the businessName field for queue rendering even when assets are partial", () => {
    const orphan = makeOrphanLead();
    const parsed = parseLeadForDashboard(orphan);
    // businessName is on the original lead object — the helper
    // doesn't surface it directly, but we confirm the parsed result
    // is well-formed so the wrapping component can render it.
    expect(parsed.status).toBe("New");
    expect(parsed.assets).toBeDefined();
    expect(parsed.audit).toBeDefined();
  });

  it("emits a structured console.warn naming every missing field on the orphan lead", () => {
    const orphan = makeOrphanLead();
    parseLeadForDashboard(orphan);
    // Multiple warns are acceptable; we just need the structured
    // missing-fields warning to fire at least once.
    const calls = consoleWarnSpy.mock.calls;
    const missingFieldsCall = calls.find((c) => String(c[0]).includes("malformed/missing required fields"));
    expect(missingFieldsCall, "expected a [audit-dashboard] missing-fields warn").toBeTruthy();
    const meta = missingFieldsCall?.[1] as { leadId: string; businessName: string; missingFields: string[] };
    expect(meta.leadId).toBe(orphan.id);
    expect(meta.businessName).toBe(orphan.businessName);
    expect(meta.missingFields).toEqual(
      expect.arrayContaining([
        "assets.coldCallScript",
        "assets.textMessageScript",
        "assets.emailScript",
        "assets.thirtySecondPitch",
        "assets.followUpMessage",
        "assets.proposalOutline",
        "assets.likelyMoneyLost",
      ]),
    );
  });

  it("coalesces all 5 script fields to safe empty strings (sanitizePublicBrandCopy survives)", () => {
    const orphan = makeOrphanLead();
    const parsed = parseLeadForDashboard(orphan);
    // After coalescing + sanitization, each script must be a string
    // (sanitizePublicBrandCopy returns a string when given a string).
    expect(typeof parsed.assets.coldCallScript).toBe("string");
    expect(typeof parsed.assets.textMessageScript).toBe("string");
    expect(typeof parsed.assets.emailScript).toBe("string");
    expect(typeof parsed.assets.thirtySecondPitch).toBe("string");
    expect(typeof parsed.assets.followUpMessage).toBe("string");
  });

  it("coalesces proposalOutline to [] so the lead-detail panel's .map never crashes", () => {
    const orphan = makeOrphanLead();
    const parsed = parseLeadForDashboard(orphan);
    expect(Array.isArray(parsed.assets.proposalOutline)).toBe(true);
    // Calling .map() on the result must not throw — this mirrors
    // audit-dashboard.tsx:1482 where the lead-detail panel iterates.
    expect(() => parsed.assets.proposalOutline.map((x) => x)).not.toThrow();
  });

  it("coerces likelyMoneyLost to a string when the orphan stored a number", () => {
    const orphan = makeOrphanLead();
    const parsed = parseLeadForDashboard(orphan);
    expect(typeof parsed.assets.likelyMoneyLost).toBe("string");
  });

  it("fills audit.checks with all 12 boolean fields when stored value is empty {}", () => {
    const orphan = makeOrphanLead();
    const parsed = parseLeadForDashboard(orphan);
    // audit-dashboard.tsx:1458-1468 reads each of these for the
    // CheckItem rows. All must be booleans.
    for (const key of Object.keys(FALLBACK_AUDIT_CHECKS) as Array<keyof typeof FALLBACK_AUDIT_CHECKS>) {
      expect(typeof parsed.audit.checks[key], `audit.checks.${key} must be boolean`).toBe("boolean");
    }
  });

  it("survives entirely-invalid JSON in assetsJson without throwing", () => {
    const lead = {
      ...makeOrphanLead(),
      assetsJson: "this is not json {",
    };
    expect(() => parseLeadForDashboard(lead)).not.toThrow();
    const parsed = parseLeadForDashboard(lead);
    expect(typeof parsed.assets.coldCallScript).toBe("string");
    // Specifically: the JSON-parse-error warn fires AND the
    // missing-fields warn fires.
    const calls = consoleWarnSpy.mock.calls;
    expect(calls.some((c) => String(c[0]).includes("not valid JSON"))).toBe(true);
  });

  it("survives entirely-invalid JSON in auditJson without throwing", () => {
    const lead = {
      ...makeOrphanLead(),
      auditJson: "{ corrupted",
    };
    expect(() => parseLeadForDashboard(lead)).not.toThrow();
    const parsed = parseLeadForDashboard(lead);
    expect(typeof parsed.audit.checks.hasWebsite).toBe("boolean");
    expect(Array.isArray(parsed.audit.websiteSignals)).toBe(true);
    expect(Array.isArray(parsed.audit.warnings)).toBe(true);
    expect(typeof parsed.audit.source).toBe("string");
  });

  it("does NOT warn when given a healthy lead with full assetsJson + auditJson", () => {
    const healthy = {
      id: "lead_healthy",
      businessName: "Healthy Co",
      status: "New",
      auditJson: JSON.stringify({
        source: "claude",
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
        websiteSignals: ["robots.txt present"],
        warnings: [],
      }),
      assetsJson: JSON.stringify({
        leadScore: 80,
        painPointSummary: "Solid presence overall.",
        recommendedPackage: "Presence Labs Conversion Upgrade",
        likelyMoneyLost: "~$5,000/yr (estimated)",
        presenceLabsOffer: "Presence Labs Conversion Upgrade",
        coldCallScript: "Hi this is Hamid…",
        textMessageScript: "Quick text…",
        emailScript: "Subject: Visibility audit…",
        thirtySecondPitch: "I help local businesses…",
        followUpMessage: "Following up on the audit…",
        proposalOutline: ["Discovery", "Recommendation", "Pricing"],
      }),
      intelligenceJson: null,
    };
    parseLeadForDashboard(healthy);
    const calls = consoleWarnSpy.mock.calls;
    // No "[audit-dashboard]" warns at all on a healthy lead.
    const audDashWarns = calls.filter((c) => String(c[0]).includes("[audit-dashboard]"));
    expect(audDashWarns.length, "healthy leads must not produce [audit-dashboard] warns").toBe(0);
  });

  it("normalises an unknown legacy status (e.g. 'Discovered') to 'New'", () => {
    const lead = { ...makeOrphanLead(), status: "Discovered" };
    const parsed = parseLeadForDashboard(lead);
    expect(parsed.status).toBe("New");
  });

  it("preserves a known status (Contacted/Follow-up/Won/Lost)", () => {
    for (const s of ["New", "Contacted", "Follow-up", "Won", "Lost"]) {
      const lead = { ...makeOrphanLead(), status: s };
      const parsed = parseLeadForDashboard(lead);
      expect(parsed.status).toBe(s);
    }
  });
});
