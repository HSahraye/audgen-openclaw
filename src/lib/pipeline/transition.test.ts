import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: mocks.leadFindFirst,
      update: mocks.leadUpdate,
    },
    activity: {
      create: mocks.activityCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import { transitionLeadStage } from "./transition";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  // Default: $transaction([leadUpdate, activityCreate]) -> [updatedLead, createdActivity]
  mocks.transaction.mockImplementation(async () => {
    return [{ id: "lead_1" }, { id: "activity_1" }];
  });
});

describe("transitionLeadStage", () => {
  it("returns missing_required when args are absent", async () => {
    const r1 = await transitionLeadStage({} as unknown as Parameters<typeof transitionLeadStage>[0]);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe("missing_required");

    const r2 = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "",
      actorUserId: null,
      nextStage: "CONTACTED",
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("missing_required");

    const r3 = await transitionLeadStage({
      leadId: "",
      workspaceId: "ws_1",
      actorUserId: null,
      nextStage: "CONTACTED",
    });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toBe("missing_required");
  });

  it("rejects invalid stage strings", async () => {
    const r = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: null,
      nextStage: "NOT_A_STAGE" as unknown as "CONTACTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_stage");
    expect(mocks.leadFindFirst).not.toHaveBeenCalled();
  });

  it("rejects when the lead is not in the named workspace (cross-tenant guard)", async () => {
    mocks.leadFindFirst.mockResolvedValue(null);
    const r = await transitionLeadStage({
      leadId: "lead_in_other_ws",
      workspaceId: "ws_A",
      actorUserId: "u1",
      nextStage: "CONTACTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("lead_not_found");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid forward transition", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "WON" });
    const r = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u1",
      nextStage: "CONTACTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("invalid_transition");
      expect(r.previousStage).toBe("WON");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("normalizes legacy free-text status and records previousStage/nextStage", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "Contacted" });
    const r = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u_actor",
      nextStage: "REPLIED",
      note: "responded by email",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previousStage).toBe("CONTACTED");
      expect(r.nextStage).toBe("REPLIED");
      expect(r.activityId).toBe("activity_1");
    }
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("writes the Activity with structured metadata (previousStage, nextStage, actorUserId)", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "REPLIED" });
    // Capture the args passed to prisma operations via the $transaction array.
    let activityArg: { data: Record<string, unknown> } | undefined;
    let leadArg: { data: Record<string, unknown> } | undefined;
    // Re-define create/update so we can intercept the args.
    mocks.leadUpdate.mockImplementation((arg: typeof leadArg) => {
      leadArg = arg;
      return { id: "lead_1" };
    });
    mocks.activityCreate.mockImplementation((arg: typeof activityArg) => {
      activityArg = arg;
      return { id: "activity_1" };
    });
    mocks.transaction.mockImplementation(async () => {
      // Re-invoke the captured mocks so we exercise their argument capture.
      const u = await mocks.leadUpdate({ where: { id: "lead_1" }, data: { status: "CALL_BOOKED" } });
      const a = await mocks.activityCreate({
        data: {
          workspaceId: "ws_1",
          leadId: "lead_1",
          type: "STAGE_CHANGED",
          source: "user",
          metadataJson: JSON.stringify({
            previousStage: "REPLIED",
            nextStage: "CALL_BOOKED",
            actorUserId: "u_actor",
          }),
        },
      });
      return [u, a];
    });
    const r = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u_actor",
      nextStage: "CALL_BOOKED",
    });
    expect(r.ok).toBe(true);
    expect(leadArg?.data?.status).toBe("CALL_BOOKED");
    expect(activityArg?.data?.type).toBe("STAGE_CHANGED");
    const meta = JSON.parse(String(activityArg?.data?.metadataJson));
    expect(meta).toMatchObject({
      previousStage: "REPLIED",
      nextStage: "CALL_BOOKED",
      actorUserId: "u_actor",
    });
  });

  it("source='system' when no actorUserId is provided", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "NEW" });
    let activityArg: { data: Record<string, unknown> } | undefined;
    mocks.activityCreate.mockImplementation((arg: typeof activityArg) => {
      activityArg = arg;
      return { id: "activity_1" };
    });
    mocks.transaction.mockImplementation(async () => {
      const a = await mocks.activityCreate({
        data: {
          workspaceId: "ws_1",
          leadId: "lead_1",
          type: "STAGE_CHANGED",
          source: "system",
          metadataJson: JSON.stringify({
            previousStage: "NEW",
            nextStage: "IMPORTED",
            actorUserId: null,
          }),
        },
      });
      return [{ id: "lead_1" }, a];
    });
    const r = await transitionLeadStage({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: null,
      nextStage: "IMPORTED",
    });
    expect(r.ok).toBe(true);
    expect(activityArg?.data?.source).toBe("system");
  });
});
