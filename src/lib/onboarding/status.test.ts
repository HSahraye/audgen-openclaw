import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  leadCount: vi.fn(),
  outreachCount: vi.fn(),
  leadFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    lead: { count: mocks.leadCount, findMany: mocks.leadFindMany },
    outreachLog: { count: mocks.outreachCount },
  },
}));

import { getOnboardingStatus } from "./status";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("getOnboardingStatus", () => {
  it("rejects missing workspaceId", async () => {
    await expect(getOnboardingStatus("")).rejects.toThrow(/workspaceId required/);
  });

  it("fresh workspace: 0/4, currentStep=import_first_lead", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Default Workspace",
      slug: "default",
    });
    mocks.leadCount.mockResolvedValue(0); // leadCount + auditedCount both
    mocks.outreachCount.mockResolvedValue(0);
    mocks.leadFindMany.mockResolvedValue([]);
    const s = await getOnboardingStatus("ws_1");
    expect(s.currentStep).toBe("import_first_lead");
    expect(s.pctComplete).toBe(0);
    expect(s.steps.every((x) => !x.done)).toBe(true);
  });

  it("named workspace + 25 leads + dental category -> step 3 next (first_audit)", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Hamid's Agency",
      slug: "hamids-agency",
    });
    // leadCount, auditedCount, outreachCount in order
    mocks.leadCount.mockResolvedValueOnce(25).mockResolvedValueOnce(0);
    mocks.outreachCount.mockResolvedValue(0);
    mocks.leadFindMany.mockResolvedValue([{ category: "Dental" }]);
    const s = await getOnboardingStatus("ws_1");
    expect(s.steps.find((x) => x.key === "import_first_lead")?.done).toBe(true);
    expect(s.steps.find((x) => x.key === "pick_vertical")?.done).toBe(true);
    expect(s.steps.find((x) => x.key === "first_audit")?.done).toBe(false);
    expect(s.currentStep).toBe("first_audit");
    expect(s.pctComplete).toBe(0.5);
  });

  it("category that doesn't match known verticals -> pick_vertical stays incomplete", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Hamid's Agency",
      slug: "hamids-agency",
    });
    mocks.leadCount.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    mocks.outreachCount.mockResolvedValue(0);
    mocks.leadFindMany.mockResolvedValue([{ category: "Plumbing" }]);
    const s = await getOnboardingStatus("ws_1");
    expect(s.steps.find((x) => x.key === "pick_vertical")?.done).toBe(false);
  });

  it("full house -> currentStep null, 100%", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Real Agency Inc",
      slug: "real-agency",
    });
    // leadCount, auditedCount
    mocks.leadCount.mockResolvedValueOnce(100).mockResolvedValueOnce(40);
    mocks.outreachCount.mockResolvedValue(20);
    mocks.leadFindMany.mockResolvedValue([{ category: "smoke shop" }]);
    const s = await getOnboardingStatus("ws_1");
    expect(s.currentStep).toBeNull();
    expect(s.pctComplete).toBe(1);
    expect(s.steps.every((x) => x.done)).toBe(true);
  });

  it("workspace name exactly equal to slug is treated as unnamed", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ id: "ws_1", name: "agency-3", slug: "agency-3" });
    mocks.leadCount.mockResolvedValue(0);
    mocks.outreachCount.mockResolvedValue(0);
    mocks.leadFindMany.mockResolvedValue([{ category: "dental" }]);
    const s = await getOnboardingStatus("ws_1");
    expect(s.steps.find((x) => x.key === "pick_vertical")?.done).toBe(false);
  });

  it("scopes every query to the workspaceId", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ id: "ws_t", name: "T", slug: "t" });
    mocks.leadCount.mockResolvedValue(0);
    mocks.outreachCount.mockResolvedValue(0);
    mocks.leadFindMany.mockResolvedValue([]);
    await getOnboardingStatus("ws_t");
    expect(mocks.workspaceFindUnique.mock.calls[0][0].where.id).toBe("ws_t");
    for (const call of mocks.leadCount.mock.calls) {
      expect(call[0].where.workspaceId).toBe("ws_t");
    }
    expect(mocks.outreachCount.mock.calls[0][0].where.workspaceId).toBe("ws_t");
    expect(mocks.leadFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_t");
  });
});
