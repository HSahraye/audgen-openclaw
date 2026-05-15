import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindFirst: vi.fn(),
  leadUpdate: vi.fn(),
  outreachLogCreate: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: mocks.leadFindFirst, update: mocks.leadUpdate },
    outreachLog: { create: mocks.outreachLogCreate },
    activity: { create: mocks.activityCreate },
    $transaction: mocks.transaction,
  },
}));

import { CLASSIFICATION_TARGET_STAGE, logManualReply, REPLY_CLASSIFICATIONS } from "./replies";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  // Default: transaction returns [outreachLog, activity] or [outreachLog, activity, lead]
  mocks.transaction.mockImplementation(async (ops: unknown[]) => {
    const out: unknown[] = [{ id: "log_1" }, { id: "act_1" }];
    if (ops.length === 3) out.push({ id: "lead_1" });
    return out;
  });
});

describe("logManualReply", () => {
  it("fails closed when required fields are missing", async () => {
    const r1 = await logManualReply({} as unknown as Parameters<typeof logManualReply>[0]);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe("missing_required");

    const r2 = await logManualReply({
      leadId: "lead_1",
      workspaceId: "",
      actorUserId: "u1",
      classification: "INTERESTED",
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("missing_required");
  });

  it("rejects invalid classification strings", async () => {
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u1",
      classification: "NOT_A_REAL_VALUE" as unknown as "INTERESTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_classification");
    expect(mocks.leadFindFirst).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace logging (lead not in claimed workspace)", async () => {
    mocks.leadFindFirst.mockResolvedValue(null);
    const r = await logManualReply({
      leadId: "lead_in_other_ws",
      workspaceId: "ws_A",
      actorUserId: "u1",
      classification: "INTERESTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("lead_not_found");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("logs INTERESTED reply and transitions CONTACTED -> QUALIFIED", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "CONTACTED" });
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u_actor",
      classification: "INTERESTED",
      body: "Yes, send the proposal.",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previousStage).toBe("CONTACTED");
      expect(r.nextStage).toBe("QUALIFIED");
      expect(r.stageChanged).toBe(true);
    }
    // transaction received 3 ops (outreachLog.create, activity.create, lead.update)
    const opsArg = mocks.transaction.mock.calls[0][0] as unknown[];
    expect(opsArg).toHaveLength(3);
  });

  it("logs BOOKED_CALL reply and transitions REPLIED -> CALL_BOOKED", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "REPLIED" });
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u1",
      classification: "BOOKED_CALL",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previousStage).toBe("REPLIED");
      expect(r.nextStage).toBe("CALL_BOOKED");
      expect(r.stageChanged).toBe(true);
    }
  });

  it("logs reply WITHOUT transitioning when current stage forbids the move", async () => {
    // WON is terminal. ALREADY_HAS_PROVIDER maps to LOST, but WON -> LOST is
    // not a valid transition, so the helper must log the reply and leave the
    // stage at WON.
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "WON" });
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u1",
      classification: "ALREADY_HAS_PROVIDER",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previousStage).toBe("WON");
      expect(r.nextStage).toBe("WON");
      expect(r.stageChanged).toBe(false);
    }
    const opsArg = mocks.transaction.mock.calls[0][0] as unknown[];
    // Only outreachLog + activity \u2014 no lead.update.
    expect(opsArg).toHaveLength(2);
  });

  it("BOUNCED maps to DISQUALIFIED from CONTACTED", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "CONTACTED" });
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: null,
      classification: "BOUNCED",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nextStage).toBe("DISQUALIFIED");
      expect(r.stageChanged).toBe(true);
    }
  });

  it("autoTransition:false records the reply but never changes stage", async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1", status: "CONTACTED" });
    const r = await logManualReply({
      leadId: "lead_1",
      workspaceId: "ws_1",
      actorUserId: "u1",
      classification: "INTERESTED",
      autoTransition: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stageChanged).toBe(false);
      expect(r.nextStage).toBe("CONTACTED");
    }
    const opsArg = mocks.transaction.mock.calls[0][0] as unknown[];
    expect(opsArg).toHaveLength(2);
  });

  it("exports a target stage for every classification", () => {
    for (const c of REPLY_CLASSIFICATIONS) {
      expect(CLASSIFICATION_TARGET_STAGE[c]).toBeTruthy();
    }
  });
});
