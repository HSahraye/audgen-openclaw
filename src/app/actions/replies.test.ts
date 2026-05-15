import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspaceRole: vi.fn(),
  logManualReply: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
}));
vi.mock("@/lib/pipeline/replies", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline/replies")>(
    "@/lib/pipeline/replies",
  );
  return {
    ...actual,
    logManualReply: mocks.logManualReply,
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { logManualReplyAction } from "./replies";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
});

describe("logManualReplyAction", () => {
  it("rejects invalid input shape (missing leadId)", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1", userId: "u_1", role: "owner" });
    const r = await logManualReplyAction(fd({ classification: "INTERESTED" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_input");
    expect(mocks.logManualReply).not.toHaveBeenCalled();
  });

  it("rejects an invalid classification", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1", userId: "u_1", role: "owner" });
    const r = await logManualReplyAction(
      fd({ leadId: "lead_1", classification: "NOT_REAL_VALUE" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_classification");
    expect(mocks.logManualReply).not.toHaveBeenCalled();
  });

  it("calls logManualReply with session-resolved workspaceId and userId", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      workspaceId: "ws_session",
      userId: "u_actor",
      role: "owner",
    });
    mocks.logManualReply.mockResolvedValue({
      ok: true,
      outreachLogId: "log_1",
      activityId: "a_1",
      previousStage: "CONTACTED",
      nextStage: "QUALIFIED",
      stageChanged: true,
    });
    const r = await logManualReplyAction(
      fd({
        leadId: "lead_1",
        classification: "INTERESTED",
        body: "Yes please send a proposal",
        autoTransition: "on",
      }),
    );
    expect(r.ok).toBe(true);
    expect(mocks.logManualReply).toHaveBeenCalledWith({
      leadId: "lead_1",
      workspaceId: "ws_session",
      actorUserId: "u_actor",
      classification: "INTERESTED",
      body: "Yes please send a proposal",
      autoTransition: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/prep/lead_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("ignores a tampered workspaceId in the form (only session value used)", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      workspaceId: "ws_session",
      userId: "u_actor",
      role: "owner",
    });
    mocks.logManualReply.mockResolvedValue({
      ok: true,
      outreachLogId: "log",
      activityId: "a",
      previousStage: "NEW",
      nextStage: "NEW",
      stageChanged: false,
    });
    await logManualReplyAction(
      fd({
        leadId: "lead_1",
        classification: "NOT_INTERESTED",
        workspaceId: "ws_attacker_injected",
      }),
    );
    const callArg = mocks.logManualReply.mock.calls[0][0] as { workspaceId: string };
    expect(callArg.workspaceId).toBe("ws_session");
  });

  it("propagates lead_not_found from logManualReply (cross-workspace lead)", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      workspaceId: "ws_1",
      userId: "u_1",
      role: "owner",
    });
    mocks.logManualReply.mockResolvedValue({ ok: false, error: "lead_not_found" });
    const r = await logManualReplyAction(
      fd({ leadId: "lead_in_other_ws", classification: "INTERESTED" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("lead_not_found");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("autoTransition is false when checkbox is absent from FormData", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      workspaceId: "ws_1",
      userId: "u_1",
      role: "owner",
    });
    mocks.logManualReply.mockResolvedValue({
      ok: true,
      outreachLogId: "log",
      activityId: "a",
      previousStage: "CONTACTED",
      nextStage: "CONTACTED",
      stageChanged: false,
    });
    await logManualReplyAction(fd({ leadId: "lead_1", classification: "INTERESTED" }));
    const arg = mocks.logManualReply.mock.calls[0][0] as { autoTransition: boolean };
    expect(arg.autoTransition).toBe(false);
  });
});
