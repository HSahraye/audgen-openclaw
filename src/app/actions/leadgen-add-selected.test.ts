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
  createLeadgenSavedView: vi.fn(),
  deleteLeadgenSavedView: vi.fn(),
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
});
