import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadOpportunity } from "@/lib/leadgen/types";
import { sanitizePublicBrandCopy } from "@/lib/branding";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";

// REGRESSION GUARD for the production crash on 2026-05-18 ~16:06 PT
// (commit e1c8735 / deploy 6a0b97589aae530008387013):
//
//   TypeError: Cannot read properties of undefined (reading 'replace')
//     at sanitizePublicBrandCopy (src/lib/branding.ts:35)
//     at <anonymous> (src/components/audit-dashboard.tsx:434)
//                                                          ^
//                                                  inside parsedLeads useMemo
//     at Array.map (...)
//     at parsedLeads useMemo body
//     at React.useMemo
//
// Root cause: promoteOpportunityToLead's stub `assetsJson` was missing
// the 5 script fields (coldCallScript, textMessageScript, emailScript,
// thirtySecondPitch, followUpMessage) and the proposalOutline array
// from the GeneratedAssets type contract. The home dashboard's
// parsedLeads useMemo iterates every Lead and calls
// `sanitizePublicBrandCopy(parsedAssets.<scriptField>)` directly,
// which does `.replace()` on its argument. With those fields absent,
// `undefined.replace(...)` threw and the global error boundary
// rendered for ANY workspace that had at least one promoted Lead.
//
// The render-path infrastructure (jsdom + @testing-library/react) is
// NOT installed in this repo, so we don't spin up React. Instead, we
// reproduce the dashboard's data accesses literally — same fields,
// same helpers, same call shape — to lock the contract.
//
// This test must FAIL on the e1c8735 helper code and PASS on the
// fix-forward helper code.

const mocks = vi.hoisted(() => ({
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdateMany: vi.fn(),
  generateUniqueAuditSlug: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: mocks.leadFindFirst,
      create: mocks.leadCreate,
      updateMany: mocks.leadUpdateMany,
    },
  },
}));

vi.mock("@/lib/audit-slugs", () => ({
  generateUniqueAuditSlug: mocks.generateUniqueAuditSlug,
}));

import { promoteOpportunityToLead } from "./promote-to-lead";

const SESSION_WORKSPACE = "ws_dashboard_contract";

function makeOpportunity(overrides: Partial<LeadOpportunity> = {}): LeadOpportunity {
  return {
    id: "ChIJ_kEnMd9-j4ARO5OePnaHZ_M",
    businessName: "TRIO Heating & Cooling",
    category: "HVAC",
    city: "San Jose",
    state: "CA",
    phone: "+14085551212",
    email: "info@trio.example",
    website: "https://trioheating.example",
    googleProfileUrl: "https://maps.google.com/?cid=999",
    address: "100 Main St, San Jose, CA",
    rating: 4.4,
    reviewCount: 88,
    hasWebsite: true,
    hasGoogleBusinessProfile: true,
    hasBookingLink: false,
    hasContactForm: true,
    hasSocialLinks: false,
    websiteQuality: "average",
    responseSpeedSignal: "average",
    source: "google_places",
    sourceUrl: null,
    status: "discovered",
    estimatedNeedScore: 78,
    estimatedRevenuePotential: 12000,
    opportunityLevel: "High",
    presenceGaps: [],
    recommendedOffer: "Presence Labs Conversion Upgrade",
    suggestedPitch: "Stronger booking + reviews story for HVAC seasonality.",
    lastActionAt: null,
    createdAt: new Date("2026-05-18T22:00:00Z").toISOString(),
    updatedAt: new Date("2026-05-18T22:00:00Z").toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  mocks.generateUniqueAuditSlug.mockResolvedValue("trio-heating-abc123");
  mocks.leadCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: "lead_cuid_new",
    status: "New",
    ...args.data,
  }));
  mocks.leadFindFirst.mockResolvedValue(null);
  mocks.leadUpdateMany.mockResolvedValue({ count: 1 });
});

describe("promoteOpportunityToLead — dashboard render-path contract (regression for e1c8735 production crash)", () => {
  it("the stub assetsJson contains every field the home dashboard's parsedLeads useMemo touches", async () => {
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const created = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
    const parsedAssets = JSON.parse(String(created.assetsJson)) as GeneratedAssets;

    // These five fields are dereferenced directly by audit-dashboard.tsx
    // line 434-438 inside `parsedLeads.useMemo`. Each is passed straight
    // to sanitizePublicBrandCopy, which does .replace() on its argument
    // and crashes the entire dashboard render if the value is undefined.
    expect(typeof parsedAssets.coldCallScript).toBe("string");
    expect(typeof parsedAssets.textMessageScript).toBe("string");
    expect(typeof parsedAssets.emailScript).toBe("string");
    expect(typeof parsedAssets.thirtySecondPitch).toBe("string");
    expect(typeof parsedAssets.followUpMessage).toBe("string");

    // `proposalOutline` is iterated at audit-dashboard.tsx:1482
    // (selected.assets.proposalOutline.map). Type contract says
    // `string[]`. Must be a non-undefined array.
    expect(Array.isArray(parsedAssets.proposalOutline)).toBe(true);

    // Narrative fields used in the lead-detail panel.
    expect(typeof parsedAssets.leadScore).toBe("number");
    expect(typeof parsedAssets.painPointSummary).toBe("string");
    expect(typeof parsedAssets.recommendedPackage).toBe("string");
    expect(typeof parsedAssets.likelyMoneyLost).toBe("string");
    expect(typeof parsedAssets.presenceLabsOffer).toBe("string");
  });

  it("calling sanitizePublicBrandCopy on each script field does NOT throw (the production reproducer)", async () => {
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const created = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
    const parsedAssets = JSON.parse(String(created.assetsJson)) as GeneratedAssets;

    // This is the EXACT call shape from audit-dashboard.tsx:434-438.
    // If any field is undefined, sanitizePublicBrandCopy throws
    // "Cannot read properties of undefined (reading 'replace')" — the
    // verbatim crash from production at 2026-05-18 23:06 UTC.
    expect(() => sanitizePublicBrandCopy(parsedAssets.coldCallScript)).not.toThrow();
    expect(() => sanitizePublicBrandCopy(parsedAssets.textMessageScript)).not.toThrow();
    expect(() => sanitizePublicBrandCopy(parsedAssets.emailScript)).not.toThrow();
    expect(() => sanitizePublicBrandCopy(parsedAssets.thirtySecondPitch)).not.toThrow();
    expect(() => sanitizePublicBrandCopy(parsedAssets.followUpMessage)).not.toThrow();
  });

  it("the stub auditJson contains the AuditChecks shape the lead-detail panel reads (12 boolean fields)", async () => {
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const created = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
    const parsedAudit = JSON.parse(String(created.auditJson)) as { checks: AuditChecks };

    // audit-dashboard.tsx:1458-1468 dereferences selected.audit.checks
    // for 11 of the 12 booleans. The full type contract is 12 — pin all
    // of them so a future addition fails fast.
    const expectedKeys: Array<keyof AuditChecks> = [
      "hasWebsite",
      "outdatedWebsite",
      "mobileFriendly",
      "clearCta",
      "phoneEasyToFind",
      "reviewsVisible",
      "onlineBooking",
      "trustSection",
      "gallery",
      "serviceList",
      "pricing",
      "faq",
    ];
    for (const key of expectedKeys) {
      expect(typeof parsedAudit.checks?.[key], `audit.checks.${key} must be boolean`).toBe("boolean");
    }
  });

  it("the stub auditJson contains arrays for websiteSignals + warnings and a source string", async () => {
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const created = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
    const parsedAudit = JSON.parse(String(created.auditJson)) as {
      websiteSignals: unknown;
      warnings: unknown;
      source: unknown;
    };

    // audit-dashboard.tsx:1519 calls .map() on websiteSignals.
    // audit-dashboard.tsx:1525 reads .warnings.length, .warnings.map(),
    // and interpolates .source into the fallback message.
    expect(Array.isArray(parsedAudit.websiteSignals)).toBe(true);
    expect(Array.isArray(parsedAudit.warnings)).toBe(true);
    expect(typeof parsedAudit.source).toBe("string");
  });

  it("required Lead row columns required by Prisma schema are all populated as the correct type", async () => {
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const data = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};

    // Lead schema (prisma/schema.prisma:271-319) has these as
    // non-nullable, no-default columns. Missing any of them would
    // cause prisma.lead.create to throw.
    expect(typeof data.businessName).toBe("string");
    expect(data.businessName.length).toBeGreaterThan(0);
    expect(typeof data.score).toBe("number");
    expect(typeof data.packageName).toBe("string");
    expect(data.packageName.length).toBeGreaterThan(0);
    expect(typeof data.painSummary).toBe("string");
    expect(data.painSummary.length).toBeGreaterThan(0);
    expect(typeof data.auditJson).toBe("string");
    expect(typeof data.assetsJson).toBe("string");

    // shortSlug is unique-indexed; present helps the dashboard build
    // the prep + audit links.
    expect(typeof data.shortSlug).toBe("string");
    expect(data.shortSlug.length).toBeGreaterThan(0);
  });

  it("the stub assetsJson can be re-serialized through the EXACT parsedLeads.useMemo logic without throwing", async () => {
    // This test mirrors src/components/audit-dashboard.tsx:424-444
    // step-by-step. If anything in there assumes a string and our stub
    // gives undefined, this test catches it at the same level the
    // production renderer does.
    await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
    const created = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
    const lead = {
      id: "lead_cuid_new",
      auditJson: String(created.auditJson),
      assetsJson: String(created.assetsJson),
      intelligenceJson: null,
      status: "New",
    };

    const reproduceParsedLeadsLogic = () => {
      const parsedAssets = JSON.parse(lead.assetsJson) as GeneratedAssets;
      const reproduced = {
        ...lead,
        audit: JSON.parse(lead.auditJson),
        assets: {
          ...parsedAssets,
          coldCallScript: sanitizePublicBrandCopy(parsedAssets.coldCallScript),
          textMessageScript: sanitizePublicBrandCopy(parsedAssets.textMessageScript),
          emailScript: sanitizePublicBrandCopy(parsedAssets.emailScript),
          thirtySecondPitch: sanitizePublicBrandCopy(parsedAssets.thirtySecondPitch),
          followUpMessage: sanitizePublicBrandCopy(parsedAssets.followUpMessage),
        },
        intelligence: lead.intelligenceJson ? JSON.parse(lead.intelligenceJson) : null,
      };
      return reproduced;
    };

    expect(reproduceParsedLeadsLogic).not.toThrow();
    const reproduced = reproduceParsedLeadsLogic();
    // Sanity: the returned shape is well-formed and includes the
    // sanitized scripts as strings.
    expect(typeof reproduced.assets.coldCallScript).toBe("string");
    expect(typeof reproduced.assets.thirtySecondPitch).toBe("string");
    expect(typeof reproduced.assets.followUpMessage).toBe("string");
  });
});
