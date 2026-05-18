import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LeadOpportunity } from "@/lib/leadgen/types";

// REGRESSION GUARD for the silent-failure UX bug observed on /leadgen on
// 2026-05-17 (~10:41 PT): user selected 14 sandbox leads, clicked "Add
// Selected to AudGen", banner reported "Added 0 lead(s) to AudGen queue."
//
// Root cause: in the production legacy persistence fallback
// (researchQueueItem path), saveLeadgenOpportunitiesLegacy creates rows
// with auto-generated cuids while sandbox leads carry discovery-side
// string ids. The follow-up bulkUpdateLeadgenStatus then queried by id
// and never matched. The action returned that 0-count as the user-facing
// "added" number even though saveLeadgenOpportunities had genuinely
// persisted the rows.
//
// The fix:
//   1. Use opportunities.length as the canonical "added" count once
//      saveLeadgenOpportunities has succeeded.
//   2. Drop bulkUpdateLeadgenStatus from the count path — it's kept for
//      its activity-log side effect only, wrapped in try/catch so a
//      legacy failure cannot zero out the user-facing number.
//   3. Add a typed cross-workspace skip path so workspace-mismatched
//      leads are reported, not silently merged into the caller's
//      tenant.
//   4. Action returns { ok, added, skipped, total, reason, message }
//      and the UI selects banner color from those fields.

const mocks = vi.hoisted(() => ({
  requireSessionRole: vi.fn(),
  saveLeadgenOpportunities: vi.fn(),
  createLeadgenActivity: vi.fn(),
  bulkUpdateLeadgenStatus: vi.fn(),
  resolveLeadgenOpportunityDbIds: vi.fn(),
  promoteOpportunityToLead: vi.fn(),
  revalidatePath: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  requireSessionRole: mocks.requireSessionRole,
}));

vi.mock("@/lib/leadgen/persistence", () => ({
  saveLeadgenOpportunities: mocks.saveLeadgenOpportunities,
  createLeadgenActivity: mocks.createLeadgenActivity,
  bulkUpdateLeadgenStatus: mocks.bulkUpdateLeadgenStatus,
  resolveLeadgenOpportunityDbIds: mocks.resolveLeadgenOpportunityDbIds,
  createLeadgenSavedView: vi.fn(),
  deleteLeadgenSavedView: vi.fn(),
}));

vi.mock("@/lib/leadgen/promote-to-lead", () => ({
  promoteOpportunityToLead: mocks.promoteOpportunityToLead,
}));

vi.mock("@/lib/leadgen/sources", () => ({
  discoverLeadgenOpportunities: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  enforceAuditGeneration: vi.fn(),
}));

vi.mock("@/lib/leadgen/audit-preflight", () => ({
  buildLeadgenAuditPreflight: vi.fn(),
  getWorkspaceMonthlyCreditAllocation: vi.fn(),
  LEADGEN_AUDIT_BATCH_LIMIT: 25,
  LEADGEN_PREFLIGHT_LIMIT_ERROR: "preflight_limit",
}));

vi.mock("@/lib/demo-mode", () => ({
  shouldShowDemoBanner: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    researchQueueItem: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
  },
}));

import { addSelectedLeadgenToAudgenAction } from "./leadgen";
import {
  selectAddSelectedBanner,
  type AddSelectedLeadgenResult,
} from "./leadgen-result";

const SESSION_WORKSPACE = "ws_session_alpha";

function makeLead(overrides: Partial<LeadOpportunity> = {}): LeadOpportunity {
  return {
    id: "lead_1",
    businessName: "Acme Auto",
    category: "Auto",
    city: "San Jose",
    state: "CA",
    phone: null,
    email: null,
    website: null,
    googleProfileUrl: null,
    address: null,
    rating: null,
    reviewCount: null,
    hasWebsite: false,
    hasGoogleBusinessProfile: false,
    hasBookingLink: false,
    hasContactForm: false,
    hasSocialLinks: false,
    websiteQuality: "none",
    responseSpeedSignal: "unknown",
    source: "mock_local",
    sourceUrl: null,
    status: "discovered",
    estimatedNeedScore: 70,
    estimatedRevenuePotential: 1800,
    opportunityLevel: "Medium",
    presenceGaps: [],
    recommendedOffer: "Starter package",
    suggestedPitch: "pitch",
    lastActionAt: null,
    createdAt: new Date("2026-05-17T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-05-17T10:00:00Z").toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  mocks.requireSessionRole.mockResolvedValue({
    workspaceId: SESSION_WORKSPACE,
    workspaceSlug: "alpha",
    role: "owner",
    userId: "u_alpha_1",
    email: "owner@alpha.example",
    name: "Alpha Owner",
    authProvider: "better-auth",
  });
  mocks.saveLeadgenOpportunities.mockResolvedValue(undefined);
  mocks.createLeadgenActivity.mockResolvedValue(undefined);
  // Match the production legacy-fallback bug exactly: bulkUpdateLeadgenStatus
  // returns 0 because it queries by cuid while inputs are discovery-side ids.
  // This was the silent zero that landed in the production banner.
  mocks.bulkUpdateLeadgenStatus.mockResolvedValue(0);
  // Default: identity map. Specific tests that exercise the synthetic-id
  // → dbId translation (the production FK-violation reproducer) override
  // this with a translated map.
  mocks.resolveLeadgenOpportunityDbIds.mockImplementation(async (_workspaceId: string, ids: string[]) => {
    return new Map(ids.map((id) => [id, id]));
  });
  // Default: every promotion succeeds with a synthesized cuid. Specific
  // tests for the dashboard-promotion gap (production reproducer
  // "TRIO Heating / IRBIS HVAC / San Jose Heating" — leads marked
  // QUEUED on /leadgen but never appearing on /) override this with
  // a rejection.
  mocks.promoteOpportunityToLead.mockImplementation(async (workspaceId: string, opportunity: LeadOpportunity) => ({
    leadId: `lead_cuid_${opportunity.id}`,
    created: true,
    status: "New",
    workspaceId,
  }));
});

describe("addSelectedLeadgenToAudgenAction", () => {
  it("regression: returns total count even when bulkUpdateLeadgenStatus returns 0", async () => {
    // The exact production reproducer — 14 sandbox leads, legacy fallback
    // returns 0 from the redundant status pass, but the canonical
    // saveLeadgenOpportunities upstream already persisted them.
    const fourteen = Array.from({ length: 14 }, (_, i) => makeLead({ id: `google-place-${i}` }));
    const result = await addSelectedLeadgenToAudgenAction(fourteen);
    expect(result.ok).toBe(true);
    expect(result.added).toBe(14);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(14);
    expect(result.reason).toBe("none");
    expect(result.message).toContain("Added 14 leads");
    expect(mocks.saveLeadgenOpportunities).toHaveBeenCalledTimes(1);
    // saveLeadgenOpportunities must be called scoped to the SESSION
    // workspace, not whatever workspaceId the inbound leads might carry.
    expect(mocks.saveLeadgenOpportunities).toHaveBeenCalledWith(
      SESSION_WORKSPACE,
      expect.arrayContaining([expect.objectContaining({ status: "queued" })]),
    );
  });

  it("returns invalid_input with a clear message on empty selection", async () => {
    const result = await addSelectedLeadgenToAudgenAction([]);
    expect(result.ok).toBe(false);
    expect(result.added).toBe(0);
    expect(result.total).toBe(0);
    expect(result.reason).toBe("invalid_input");
    expect(result.message).toMatch(/Select at least one lead/);
    expect(mocks.saveLeadgenOpportunities).not.toHaveBeenCalled();
  });

  it("DOES NOT silently merge cross-workspace leads — flags them as skipped with cross_workspace reason", async () => {
    // Each lead carries an explicit workspaceId for a tenant OTHER than
    // the caller's session. b8a3975 protects the read path; this test
    // protects the write path against accidentally re-tagging cross-
    // tenant leads under the caller's workspaceId.
    const cross = Array.from({ length: 3 }, (_, i) => ({
      ...makeLead({ id: `place-${i}` }),
      workspaceId: "ws_OTHER_TENANT",
    })) as unknown as LeadOpportunity[];
    const result = await addSelectedLeadgenToAudgenAction(cross);
    expect(result.ok).toBe(false);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(3);
    expect(result.total).toBe(3);
    expect(result.reason).toBe("cross_workspace");
    expect(result.message).toMatch(/another workspace/);
    // saveLeadgenOpportunities must NEVER be called for cross-workspace
    // leads — silently writing them under the caller's tenant would
    // re-introduce the leak from the b8a3975 fix.
    expect(mocks.saveLeadgenOpportunities).not.toHaveBeenCalled();
  });

  it("partial: writes the in-workspace leads and reports the skipped count", async () => {
    const mine = makeLead({ id: "mine_1" });
    const someone_else = {
      ...makeLead({ id: "theirs_1" }),
      workspaceId: "ws_OTHER_TENANT",
    } as unknown as LeadOpportunity;
    const result = await addSelectedLeadgenToAudgenAction([mine, someone_else]);
    expect(result.ok).toBe(true);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(2);
    expect(result.reason).toBe("cross_workspace");
    expect(result.message).toMatch(/Added 1 of 2 leads.*another workspace/);
    expect(mocks.saveLeadgenOpportunities).toHaveBeenCalledTimes(1);
    expect(mocks.saveLeadgenOpportunities).toHaveBeenCalledWith(
      SESSION_WORKSPACE,
      [expect.objectContaining({ id: "mine_1", status: "queued" })],
    );
  });

  it("does not zero out the count when bulkUpdateLeadgenStatus throws", async () => {
    mocks.bulkUpdateLeadgenStatus.mockRejectedValue(new Error("legacy mode broken"));
    const five = Array.from({ length: 5 }, (_, i) => makeLead({ id: `lead_${i}` }));
    const result = await addSelectedLeadgenToAudgenAction(five);
    // saveLeadgenOpportunities succeeded → user-facing count must stand.
    expect(result.ok).toBe(true);
    expect(result.added).toBe(5);
    expect(mocks.saveLeadgenOpportunities).toHaveBeenCalledTimes(1);
  });

  it("requires authentication via requireSessionRole", async () => {
    mocks.requireSessionRole.mockReset();
    mocks.requireSessionRole.mockRejectedValue(new Error("REDIRECT"));
    await expect(addSelectedLeadgenToAudgenAction([makeLead()])).rejects.toThrow();
    expect(mocks.saveLeadgenOpportunities).not.toHaveBeenCalled();
  });

  it("filters out malformed (id-less) entries and reports them as invalid_input", async () => {
    const valid = makeLead({ id: "ok_1" });
    const malformed = { ...makeLead(), id: "" } as LeadOpportunity;
    const result = await addSelectedLeadgenToAudgenAction([valid, malformed]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(2);
    expect(result.reason).toBe("invalid_input");
  });

  // Banner-channel selection — single source of truth shared with the
  // production component (LeadGenCommandCenter), so the UI banner color
  // and the action's typed result can never disagree.
  it.each<{ name: string; result: Partial<AddSelectedLeadgenResult>; expected: "info" | "warning" | "error" }>([
    {
      name: "full success → info (sky banner)",
      result: { added: 14, skipped: 0, total: 14, reason: "none", ok: true, message: "Added 14 leads." },
      expected: "info",
    },
    {
      name: "partial success cross_workspace → warning (amber banner)",
      result: { added: 9, skipped: 5, total: 14, reason: "cross_workspace", ok: true, message: "Added 9 of 14 leads. 5 belong to another workspace and were skipped." },
      expected: "warning",
    },
    {
      name: "partial success invalid_input → warning (amber banner)",
      result: { added: 12, skipped: 2, total: 14, reason: "invalid_input", ok: true, message: "Added 12 of 14 leads." },
      expected: "warning",
    },
    {
      name: "zero added cross_workspace → error (rose banner)",
      result: { added: 0, skipped: 14, total: 14, reason: "cross_workspace", ok: false, message: "14 leads could not be added — they belong to another workspace." },
      expected: "error",
    },
    {
      name: "empty selection → error (rose banner)",
      result: { added: 0, skipped: 0, total: 0, reason: "invalid_input", ok: false, message: "Select at least one lead before adding to the queue." },
      expected: "error",
    },
  ])("$name", ({ result, expected }) => {
    expect(selectAddSelectedBanner(result as AddSelectedLeadgenResult)).toBe(expected);
  });

  it("logs a warning when zero leads are added so silent failures show up in Netlify logs", async () => {
    // Use the all-cross-workspace path (real silent-zero scenario)
    // rather than empty-input (which is a synchronous UX guard, not a
    // silent failure worth surfacing in the platform logs).
    const cross = [
      { ...makeLead({ id: "x_1" }), workspaceId: "ws_OTHER_TENANT" },
    ] as unknown as LeadOpportunity[];
    await addSelectedLeadgenToAudgenAction(cross);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "leadgen_add_selected_zero_added",
      expect.objectContaining({
        workspaceId: SESSION_WORKSPACE,
        total: 1,
        crossWorkspace: 1,
        reason: "cross_workspace",
      }),
    );
  });

  // REGRESSION GUARD for the production FK violation observed at
  // 2026-05-18T11:26:01Z when the operator clicked "Add Selected to
  // AudGen" on live Google Places leads (cafe in alameda ca):
  //
  //   prisma.leadgenActivityLog.create()
  //   Foreign key constraint violated on
  //   `LeadgenActivityLog_opportunityId_fkey`
  //
  // Root cause: live-discovery leads carry SYNTHETIC ids (e.g.
  // "ChIJ_kEnMd9-j4ARO5OePnaHZ_M" from Google Places, "yelp-3" from
  // Yelp). saveLeadgenOpportunities upserts those into
  // LeadgenOpportunity.externalId while the row's actual id is a fresh
  // cuid. The activity write then tried to use the synthetic id for
  // LeadgenActivityLog.opportunityId, which has a strict FK on
  // LeadgenOpportunity.id — crash.
  //
  // The fix: resolveLeadgenOpportunityDbIds translates synthetic
  // externalId → cuid, and the activity loop uses the cuid. This test
  // pins that contract.
  describe("FK regression — live discovery synthetic id translation", () => {
    it("calls createLeadgenActivity with the persisted cuid, NOT the synthetic id, for live-discovery leads", async () => {
      // Two live Google Places leads with synthetic ids (matches the
      // production reproducer shape exactly).
      const live = [
        makeLead({ id: "ChIJ_kEnMd9-j4ARO5OePnaHZ_M", source: "google_places" }),
        makeLead({ id: "ChIJ8YZxQONfj4ARYxhLpV2bAxk", source: "google_places" }),
      ];
      // Mock the resolver to return the synthetic-id → dbId map that
      // saveLeadgenOpportunities would produce in production.
      mocks.resolveLeadgenOpportunityDbIds.mockResolvedValueOnce(
        new Map([
          ["ChIJ_kEnMd9-j4ARO5OePnaHZ_M", "cuid_db_lead_1"],
          ["ChIJ8YZxQONfj4ARYxhLpV2bAxk", "cuid_db_lead_2"],
        ]),
      );

      const result = await addSelectedLeadgenToAudgenAction(live);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(2);

      // The resolver must be invoked with the SESSION workspaceId (not
      // any inbound lead.workspaceId) and with the inbound synthetic ids.
      expect(mocks.resolveLeadgenOpportunityDbIds).toHaveBeenCalledWith(
        SESSION_WORKSPACE,
        ["ChIJ_kEnMd9-j4ARO5OePnaHZ_M", "ChIJ8YZxQONfj4ARYxhLpV2bAxk"],
      );

      // Activity writes must use the resolved dbIds, not the synthetics.
      expect(mocks.createLeadgenActivity).toHaveBeenCalledTimes(2);
      expect(mocks.createLeadgenActivity).toHaveBeenNthCalledWith(
        1,
        SESSION_WORKSPACE,
        "cuid_db_lead_1",
        "added_to_audgen_queue",
        expect.any(String),
      );
      expect(mocks.createLeadgenActivity).toHaveBeenNthCalledWith(
        2,
        SESSION_WORKSPACE,
        "cuid_db_lead_2",
        "added_to_audgen_queue",
        expect.any(String),
      );
      // No call with a synthetic id is permitted — that path triggers
      // the production FK violation.
      const calls = mocks.createLeadgenActivity.mock.calls;
      for (const [, opportunityId] of calls) {
        expect(opportunityId).not.toMatch(/^ChIJ/);
      }
    });

    it("skips the activity write (with a typed warn) when the resolver cannot translate an inbound id", async () => {
      // Schema-drift / race scenario: saveLeadgenOpportunities upserted
      // but the follow-up resolver lookup missed. The lead is still
      // persisted; we just lose the activity-log entry. The user-facing
      // count must stand (added > 0) and a structured warn must fire so
      // the gap shows up in Netlify logs.
      const live = [
        makeLead({ id: "ChIJ_unresolved_1", source: "google_places" }),
      ];
      mocks.resolveLeadgenOpportunityDbIds.mockResolvedValueOnce(new Map());
      const result = await addSelectedLeadgenToAudgenAction(live);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(1);
      expect(mocks.createLeadgenActivity).not.toHaveBeenCalled();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "leadgen_add_selected_activity_skipped_no_dbid",
        expect.objectContaining({
          workspaceId: SESSION_WORKSPACE,
          inboundId: "ChIJ_unresolved_1",
        }),
      );
    });

    it("isolates per-lead activity-write failures — one FK violation must not crash the batch", async () => {
      // Three leads. The middle activity write throws (simulates a
      // surviving FK-violation scenario where the resolver lied). The
      // batch must still report added=3 because the opportunity rows
      // themselves are persisted by saveLeadgenOpportunities. A typed
      // warn must fire for the failed activity row.
      const live = [
        makeLead({ id: "lead_a", source: "google_places" }),
        makeLead({ id: "lead_b", source: "google_places" }),
        makeLead({ id: "lead_c", source: "google_places" }),
      ];
      mocks.resolveLeadgenOpportunityDbIds.mockResolvedValueOnce(
        new Map([
          ["lead_a", "cuid_a"],
          ["lead_b", "cuid_b"],
          ["lead_c", "cuid_c"],
        ]),
      );
      mocks.createLeadgenActivity.mockReset();
      mocks.createLeadgenActivity
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Foreign key constraint violated"))
        .mockResolvedValueOnce(undefined);

      const result = await addSelectedLeadgenToAudgenAction(live);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(3);
      expect(mocks.createLeadgenActivity).toHaveBeenCalledTimes(3);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "leadgen_add_selected_activity_failed",
        expect.objectContaining({
          workspaceId: SESSION_WORKSPACE,
          inboundId: "lead_b",
          dbId: "cuid_b",
          reason: "Foreign key constraint violated",
        }),
      );
    });

    it("preserves workspace strict-scoping — resolver receives the SESSION workspaceId, never any lead.workspaceId", async () => {
      // Defense-in-depth on top of b8a3975: even if the inbound leads
      // somehow carry workspaceIds (they shouldn't on the discovery
      // path, but adversarial inputs cannot be ruled out), the resolver
      // must always be called with the session-derived workspaceId.
      // Legitimate cross-workspace leads are filtered out earlier;
      // here we test the in-workspace path uses the right scope.
      const lead = makeLead({ id: "lead_q", source: "google_places" });
      mocks.resolveLeadgenOpportunityDbIds.mockResolvedValueOnce(
        new Map([["lead_q", "cuid_q"]]),
      );
      await addSelectedLeadgenToAudgenAction([lead]);
      expect(mocks.resolveLeadgenOpportunityDbIds).toHaveBeenCalledWith(
        SESSION_WORKSPACE,
        ["lead_q"],
      );
    });
  });

  // REGRESSION GUARD for the dashboard-pipeline gap reported on
  // 2026-05-18 PM: operator clicked "Add Selected to Audgen" on three
  // live HVAC leads (TRIO Heating, IRBIS HVAC, San Jose Heating), saw
  // the sky-blue success banner ("Added 3 leads to Audgen queue"), but
  // could not find any of the three on the home dashboard. Status
  // badges on /leadgen showed QUEUED but the Lead pipeline row never
  // existed, so the user had to manually re-enter each business via
  // the New Lead Audit form to generate an audit.
  //
  // The fix promotes every selected opportunity to a dashboard Lead
  // row (idempotent on businessName + websiteUrl/phone). These tests
  // pin the integration contract between the action and
  // promoteOpportunityToLead.
  describe("dashboard pipeline promotion — Add Selected to Audgen creates Lead rows", () => {
    it("calls promoteOpportunityToLead once per in-workspace selected opportunity", async () => {
      const live = [
        makeLead({ id: "trio", businessName: "TRIO Heating & Cooling" }),
        makeLead({ id: "irbis", businessName: "IRBIS HVAC" }),
        makeLead({ id: "sj", businessName: "San Jose Heating" }),
      ];
      const result = await addSelectedLeadgenToAudgenAction(live);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.reason).toBe("none");
      expect(mocks.promoteOpportunityToLead).toHaveBeenCalledTimes(3);
      // Every call must use the SESSION workspaceId — never any
      // workspaceId carried on the inbound opportunity.
      for (const call of mocks.promoteOpportunityToLead.mock.calls) {
        expect(call[0]).toBe(SESSION_WORKSPACE);
      }
      const promotedNames = mocks.promoteOpportunityToLead.mock.calls
        .map((call) => (call[1] as LeadOpportunity).businessName)
        .sort();
      expect(promotedNames).toEqual([
        "IRBIS HVAC",
        "San Jose Heating",
        "TRIO Heating & Cooling",
      ]);
    });

    it("does NOT promote opportunities tagged for another workspace (defense in depth on b8a3975)", async () => {
      const mine = makeLead({ id: "mine", businessName: "My HVAC" });
      const theirs = {
        ...makeLead({ id: "theirs", businessName: "Other Tenant HVAC" }),
        workspaceId: "ws_OTHER_TENANT",
      } as unknown as LeadOpportunity;
      const result = await addSelectedLeadgenToAudgenAction([mine, theirs]);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.reason).toBe("cross_workspace");
      // Only the in-workspace lead may be promoted.
      expect(mocks.promoteOpportunityToLead).toHaveBeenCalledTimes(1);
      expect(mocks.promoteOpportunityToLead.mock.calls[0]?.[0]).toBe(SESSION_WORKSPACE);
      expect(
        (mocks.promoteOpportunityToLead.mock.calls[0]?.[1] as LeadOpportunity)?.businessName,
      ).toBe("My HVAC");
    });

    it("isolates a single Lead promotion failure — one failure does not crash the batch", async () => {
      // Three leads, the middle one's promotion throws (e.g. a
      // unique-constraint race). Result must still be ok=true with
      // added reflecting only the successful promotions and
      // reason=lead_promotion_failed.
      mocks.promoteOpportunityToLead.mockReset();
      mocks.promoteOpportunityToLead
        .mockResolvedValueOnce({ leadId: "cuid_a", created: true, status: "New" })
        .mockRejectedValueOnce(new Error("Unique constraint failed on the fields: (`shortSlug`)"))
        .mockResolvedValueOnce({ leadId: "cuid_c", created: true, status: "New" });
      const result = await addSelectedLeadgenToAudgenAction([
        makeLead({ id: "lead_a" }),
        makeLead({ id: "lead_b" }),
        makeLead({ id: "lead_c" }),
      ]);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.total).toBe(3);
      expect(result.reason).toBe("lead_promotion_failed");
      expect(result.message).toMatch(/Added 2 of 3 leads/);
      expect(result.message).toMatch(/dashboard queue/);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "leadgen_add_selected_lead_promotion_failed",
        expect.objectContaining({
          workspaceId: SESSION_WORKSPACE,
          opportunityExternalId: "lead_b",
        }),
      );
    });

    it("when ALL Lead promotions fail, result is ok=false with lead_promotion_failed reason (rose banner)", async () => {
      mocks.promoteOpportunityToLead.mockReset();
      mocks.promoteOpportunityToLead.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const result = await addSelectedLeadgenToAudgenAction([
        makeLead({ id: "a" }),
        makeLead({ id: "b" }),
      ]);
      expect(result.ok).toBe(false);
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.reason).toBe("lead_promotion_failed");
      expect(result.message).toMatch(/Could not add any leads to the dashboard queue/);
    });

    it("uses the SESSION workspaceId for promotion — never any inbound opportunity.workspaceId", async () => {
      // Adversarial: the inbound lead carries a workspaceId for the
      // SESSION's own workspace (so it passes the cross-workspace
      // guard) but we still want to assert that the action passes
      // SESSION_WORKSPACE as the first arg, not any field on the lead.
      const lead = {
        ...makeLead({ id: "trojan" }),
        workspaceId: "ws_attacker_supplied_value",
      } as unknown as LeadOpportunity;
      // The cross-workspace guard would actually filter this out
      // because the supplied workspaceId differs from SESSION_WORKSPACE.
      // Use a lead with NO workspaceId (the discovery path's default)
      // and assert the action sources SESSION_WORKSPACE.
      const cleanLead = makeLead({ id: "clean" });
      await addSelectedLeadgenToAudgenAction([cleanLead]);
      expect(mocks.promoteOpportunityToLead).toHaveBeenCalledWith(
        SESSION_WORKSPACE,
        expect.objectContaining({ id: "clean" }),
      );
      // Sanity: the adversarial cross-workspace lead is rejected
      // upstream and never reaches promoteOpportunityToLead.
      mocks.promoteOpportunityToLead.mockClear();
      const rejectResult = await addSelectedLeadgenToAudgenAction([lead]);
      expect(rejectResult.reason).toBe("cross_workspace");
      expect(mocks.promoteOpportunityToLead).not.toHaveBeenCalled();
    });

    it("idempotency contract is delegated to promoteOpportunityToLead (called once per click)", async () => {
      // Re-clicking "Add Selected" on the same opportunity must always
      // route through promoteOpportunityToLead. The helper itself
      // enforces (workspaceId, businessName, websiteUrl/phone)
      // idempotency at the DB layer (covered by the helper-level
      // tests). Here we just pin that the action delegates rather
      // than reimplementing the dedup check.
      const lead = makeLead({ id: "dedupe", businessName: "Same Business" });
      // First click.
      mocks.promoteOpportunityToLead.mockResolvedValueOnce({
        leadId: "cuid_existing",
        created: true,
        status: "New",
      });
      const first = await addSelectedLeadgenToAudgenAction([lead]);
      expect(first.added).toBe(1);
      // Second click. Helper reports "matched existing" via created=false.
      mocks.promoteOpportunityToLead.mockResolvedValueOnce({
        leadId: "cuid_existing",
        created: false,
        status: "New",
      });
      const second = await addSelectedLeadgenToAudgenAction([lead]);
      // From the action's POV both clicks succeeded; the helper
      // handled the dedup transparently. Net leads in dashboard: 1.
      expect(second.added).toBe(1);
      expect(second.ok).toBe(true);
      expect(mocks.promoteOpportunityToLead).toHaveBeenCalledTimes(2);
    });

    it("preserves an in-progress status (Contacted) on re-promotion — does NOT roll back to New", async () => {
      // Helper-level contract: re-promoting an opportunity whose Lead
      // already exists at status Contacted/Follow-up/Won/Lost must NOT
      // reset to New. We mock the helper to return status="Contacted"
      // (which the helper guarantees by reading the existing row's
      // status before update). The action surfaces helper outcomes
      // unchanged.
      mocks.promoteOpportunityToLead.mockReset();
      mocks.promoteOpportunityToLead.mockResolvedValue({
        leadId: "cuid_already_engaged",
        created: false,
        status: "Contacted",
      });
      const result = await addSelectedLeadgenToAudgenAction([
        makeLead({ id: "engaged_1", businessName: "Engaged Co" }),
      ]);
      expect(result.ok).toBe(true);
      expect(result.added).toBe(1);
      // Banner copy should be neutral success (not "added" vs
      // "refreshed" — the user clicked Add Selected and the lead
      // is now in their dashboard queue, which is what the banner
      // truthfully reports).
      expect(result.message).toMatch(/Added 1 lead/);
    });
  });
});
