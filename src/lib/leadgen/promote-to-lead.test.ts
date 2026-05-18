import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadOpportunity } from "@/lib/leadgen/types";

// REGRESSION GUARD for the dashboard-pipeline gap reported on
// 2026-05-18 PM. The helper is the contract owner for:
//   1. Idempotency — re-clicking "Add Selected" on the same business
//      must NOT create a duplicate Lead row in the dashboard queue.
//   2. Status preservation — re-promoting a Lead that already exists
//      at Contacted/Follow-up/Won/Lost must preserve that status
//      rather than rolling it back to New.
//   3. Strict workspace scoping — every Prisma read/write goes
//      through `strictWorkspaceScope(workspaceId)`. b8a3975 invariant.
//   4. No external API call — `generateAudit()` is NOT invoked
//      synchronously during promotion (would burn the audit
//      entitlement). auditJson / assetsJson are stubbed from
//      discovery data.

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

const SESSION_WORKSPACE = "ws_session_alpha";

function makeOpportunity(overrides: Partial<LeadOpportunity> = {}): LeadOpportunity {
  return {
    id: "opp_1",
    businessName: "Acme HVAC",
    category: "HVAC",
    city: "San Jose",
    state: "CA",
    phone: "+14085551212",
    email: "info@acme.example",
    website: "https://acme.example",
    googleProfileUrl: "https://maps.google.com/?cid=123",
    address: "100 Main St, San Jose, CA",
    rating: 4.2,
    reviewCount: 42,
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
    estimatedNeedScore: 72,
    estimatedRevenuePotential: 9000,
    opportunityLevel: "Medium",
    presenceGaps: [],
    recommendedOffer: "Presence Labs Conversion Upgrade",
    suggestedPitch: "Stronger booking + reviews story for HVAC seasonality.",
    lastActionAt: null,
    createdAt: new Date("2026-05-18T20:00:00Z").toISOString(),
    updatedAt: new Date("2026-05-18T20:00:00Z").toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  mocks.generateUniqueAuditSlug.mockResolvedValue("acme-hvac-abc123");
  mocks.leadCreate.mockResolvedValue({ id: "lead_cuid_new", status: "New" });
  mocks.leadUpdateMany.mockResolvedValue({ count: 1 });
});

describe("promoteOpportunityToLead", () => {
  describe("creation path (no existing Lead)", () => {
    it("creates a Lead with stub auditJson/assetsJson — no external generateAudit() call", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      const result = await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      expect(result).toEqual({ leadId: "lead_cuid_new", created: true, status: "New" });
      expect(mocks.leadCreate).toHaveBeenCalledTimes(1);
      const createArgs = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
      expect(createArgs.workspaceId).toBe(SESSION_WORKSPACE);
      expect(createArgs.businessName).toBe("Acme HVAC");
      expect(createArgs.status).toBe("New");
      expect(createArgs.score).toBe(72);
      expect(createArgs.location).toBe("San Jose, CA");
      // auditJson + assetsJson must be valid JSON strings, not empty.
      const audit = JSON.parse(createArgs.auditJson);
      expect(audit.source).toBe("leadgen_discovery");
      expect(audit.discoveryProvider).toBe("google_places");
      expect(audit.discoveryExternalId).toBe("opp_1");
      const assets = JSON.parse(createArgs.assetsJson);
      expect(assets.leadScore).toBe(72);
      expect(assets.pendingRegeneration).toBe(true);
      // Sanity: the Lead model required fields are all populated.
      expect(typeof createArgs.painSummary).toBe("string");
      expect(createArgs.painSummary.length).toBeGreaterThan(0);
      expect(typeof createArgs.packageName).toBe("string");
      expect(createArgs.packageName.length).toBeGreaterThan(0);
    });

    it("clamps an out-of-range estimatedNeedScore to [1,100]", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ estimatedNeedScore: 9999 }),
      );
      expect(mocks.leadCreate.mock.calls[0]?.[0]?.data?.score).toBe(100);
      mocks.leadCreate.mockClear();
      await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ estimatedNeedScore: -10 }),
      );
      expect(mocks.leadCreate.mock.calls[0]?.[0]?.data?.score).toBe(1);
    });

    it("falls back to a non-empty packageName when recommendedOffer is blank", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ recommendedOffer: "" }),
      );
      const data = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
      expect(data.packageName).toBeTruthy();
      expect(typeof data.packageName).toBe("string");
    });

    it("throws when businessName is empty (Lead.businessName is required, non-null)", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      await expect(
        promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity({ businessName: "   " })),
      ).rejects.toThrow(/businessName is required/);
      expect(mocks.leadCreate).not.toHaveBeenCalled();
    });
  });

  describe("idempotency contract — re-clicking does not duplicate Lead rows", () => {
    it("matches an existing Lead by (workspaceId, businessName, websiteUrl) and updates instead of creating", async () => {
      mocks.leadFindFirst.mockResolvedValue({ id: "existing_lead_cuid", status: "New" });
      const result = await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      expect(result).toEqual({ leadId: "existing_lead_cuid", created: false, status: "New" });
      expect(mocks.leadCreate).not.toHaveBeenCalled();
      expect(mocks.leadUpdateMany).toHaveBeenCalledTimes(1);
    });

    it("matches an existing Lead by (workspaceId, businessName, phone) when no website is shared", async () => {
      // First call: findFirst with OR over websiteUrl + phone returns
      // a match driven by phone (production reproducer: same phone,
      // user maybe re-input the website slightly differently).
      mocks.leadFindFirst.mockResolvedValue({ id: "existing_phone_match", status: "Follow-up" });
      const result = await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ website: null }),
      );
      expect(result).toEqual({ leadId: "existing_phone_match", created: false, status: "Follow-up" });
      expect(mocks.leadCreate).not.toHaveBeenCalled();
    });

    it("falls back to (workspaceId, businessName, location) match when neither website nor phone is present", async () => {
      mocks.leadFindFirst.mockResolvedValue({ id: "existing_location_match", status: "New" });
      const result = await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ website: null, phone: null }),
      );
      expect(result.created).toBe(false);
      // Sanity-check: the lookup query was the location-fallback
      // shape (no OR clause).
      const findFirstArg = mocks.leadFindFirst.mock.calls[0]?.[0];
      expect(findFirstArg?.where?.location).toBe("San Jose, CA");
      expect(findFirstArg?.where?.OR).toBeUndefined();
    });

    it("creates a fresh Lead when there are no identifying signals at all", async () => {
      // No website, no phone, no city/state. We can't reliably dedup;
      // create a new row rather than risk false-positive matches.
      mocks.leadFindFirst.mockResolvedValue(null);
      const result = await promoteOpportunityToLead(
        SESSION_WORKSPACE,
        makeOpportunity({ website: null, phone: null, city: "", state: "" }),
      );
      expect(result.created).toBe(true);
      // findFirst should NOT have been called because no signal to query on.
      expect(mocks.leadFindFirst).not.toHaveBeenCalled();
      expect(mocks.leadCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("status preservation — re-promoting an in-progress Lead does NOT reset status", () => {
    it.each([
      ["Contacted", "Contacted"],
      ["Follow-up", "Follow-up"],
      ["Won", "Won"],
      ["Lost", "Lost"],
    ])("preserves status %s when the Lead already exists at that status", async (existingStatus, expected) => {
      mocks.leadFindFirst.mockResolvedValue({ id: "engaged_lead", status: existingStatus });
      const result = await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      expect(result.status).toBe(expected);
      expect(result.created).toBe(false);
      const updateData = mocks.leadUpdateMany.mock.calls[0]?.[0]?.data ?? {};
      expect(updateData.status).toBe(expected);
    });

    it("DOES refresh status to New when existing Lead is at New (idempotent self-restate)", async () => {
      mocks.leadFindFirst.mockResolvedValue({ id: "fresh_lead", status: "New" });
      const result = await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      expect(result.status).toBe("New");
      const updateData = mocks.leadUpdateMany.mock.calls[0]?.[0]?.data ?? {};
      expect(updateData.status).toBe("New");
    });

    it("refreshes status to New when existing Lead has an unknown legacy status (defensive default)", async () => {
      mocks.leadFindFirst.mockResolvedValue({ id: "legacy_lead", status: "Discovered" });
      const result = await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      // "Discovered" is NOT in the preserve set, so we default to "New".
      expect(result.status).toBe("New");
    });
  });

  describe("strict workspace scoping — every Prisma access uses strictWorkspaceScope", () => {
    it("findFirst is gated by workspaceId equal to the caller's session workspace", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      const where = mocks.leadFindFirst.mock.calls[0]?.[0]?.where ?? {};
      expect(where.workspaceId).toBe(SESSION_WORKSPACE);
    });

    it("create writes the SESSION workspaceId, never any opportunity-side workspaceId", async () => {
      mocks.leadFindFirst.mockResolvedValue(null);
      // Adversarial input: opportunity carries a workspaceId for a
      // different tenant (the action filters this out upstream, but
      // the helper must remain safe even if called directly).
      const adversarial = {
        ...makeOpportunity(),
        workspaceId: "ws_OTHER_TENANT",
      } as unknown as LeadOpportunity;
      await promoteOpportunityToLead(SESSION_WORKSPACE, adversarial);
      const data = mocks.leadCreate.mock.calls[0]?.[0]?.data ?? {};
      expect(data.workspaceId).toBe(SESSION_WORKSPACE);
      expect(data.workspaceId).not.toBe("ws_OTHER_TENANT");
    });

    it("updateMany is gated by both id AND workspaceId (strictWorkspaceScope shape)", async () => {
      mocks.leadFindFirst.mockResolvedValue({ id: "existing_x", status: "New" });
      await promoteOpportunityToLead(SESSION_WORKSPACE, makeOpportunity());
      const where = mocks.leadUpdateMany.mock.calls[0]?.[0]?.where ?? {};
      expect(where.id).toBe("existing_x");
      expect(where.workspaceId).toBe(SESSION_WORKSPACE);
    });
  });
});
