import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  leadCount: vi.fn(),
  sequenceCount: vi.fn(),
  activityCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    lead: { count: mocks.leadCount },
    sequence: { count: mocks.sequenceCount },
    activity: { count: mocks.activityCount },
  },
}));

import { getOnboardingWizardState } from "./wizard";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("getOnboardingWizardState", () => {
  it("rejects missing workspaceId", async () => {
    await expect(getOnboardingWizardState("")).rejects.toThrow(/workspaceId required/);
  });

  it("fresh workspace -> all steps incomplete, currentStep=name_workspace, 0%", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Default Workspace",
      slug: "default",
    });
    mocks.leadCount.mockResolvedValue(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mocks.sequenceCount.mockResolvedValue(0);
    mocks.activityCount.mockResolvedValue(0);
    const s = await getOnboardingWizardState("ws_1");
    expect(s.currentStep).toBe("name_workspace");
    expect(s.pctComplete).toBe(0);
    expect(s.steps.every((x) => !x.done)).toBe(true);
  });

  it("named workspace + 1 lead -> first_audit is the current step, 2/5 done", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Hamid's Agency",
      slug: "hamids-agency",
    });
    // Two lead.count calls: leadCount + auditCount.
    mocks.leadCount.mockResolvedValueOnce(25).mockResolvedValueOnce(0);
    mocks.sequenceCount.mockResolvedValue(0);
    mocks.activityCount.mockResolvedValue(0);
    const s = await getOnboardingWizardState("ws_1");
    expect(s.currentStep).toBe("first_audit");
    expect(s.pctComplete).toBe(2 / 5);
    expect(s.steps.find((x) => x.key === "name_workspace")?.done).toBe(true);
    expect(s.steps.find((x) => x.key === "import_first_lead")?.done).toBe(true);
    expect(s.steps.find((x) => x.key === "first_audit")?.done).toBe(false);
  });

  it("full house \u2014 every step done, currentStep null, 100%", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_1",
      name: "Real Agency Inc",
      slug: "real-agency",
    });
    mocks.leadCount.mockResolvedValueOnce(100).mockResolvedValueOnce(40);
    mocks.sequenceCount.mockResolvedValue(3);
    mocks.activityCount.mockResolvedValue(5);
    const s = await getOnboardingWizardState("ws_1");
    expect(s.currentStep).toBeNull();
    expect(s.pctComplete).toBe(1);
    expect(s.steps.every((x) => x.done)).toBe(true);
  });

  it("workspace named exactly the slug is treated as unnamed", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ id: "ws_1", name: "agency-3", slug: "agency-3" });
    mocks.leadCount.mockResolvedValue(0);
    mocks.sequenceCount.mockResolvedValue(0);
    mocks.activityCount.mockResolvedValue(0);
    const s = await getOnboardingWizardState("ws_1");
    expect(s.steps[0].done).toBe(false);
  });

  it("scopes every query to the workspaceId", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ id: "ws_t", name: "T", slug: "t" });
    mocks.leadCount.mockResolvedValue(0);
    mocks.sequenceCount.mockResolvedValue(0);
    mocks.activityCount.mockResolvedValue(0);
    await getOnboardingWizardState("ws_t");
    expect(mocks.workspaceFindUnique.mock.calls[0][0].where.id).toBe("ws_t");
    for (const call of mocks.leadCount.mock.calls) {
      expect(call[0].where.workspaceId).toBe("ws_t");
    }
    expect(mocks.sequenceCount.mock.calls[0][0].where.workspaceId).toBe("ws_t");
    expect(mocks.activityCount.mock.calls[0][0].where.workspaceId).toBe("ws_t");
  });
});
