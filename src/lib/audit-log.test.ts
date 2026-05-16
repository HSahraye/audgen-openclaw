import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
  getWorkspaceContext: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    auditLog: { create: mocks.auditLogCreate },
  },
}));

vi.mock("./workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

vi.mock("./logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { writeAuditLog } from "./audit-log";

describe("writeAuditLog", () => {
  beforeEach(() => {
    mocks.auditLogCreate.mockReset();
    mocks.getWorkspaceContext.mockReset();
    mocks.loggerWarn.mockReset();
  });

  it("writes a row with explicit workspaceId without calling getWorkspaceContext", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "al_1" });
    await writeAuditLog({
      action: "lead.create",
      actorRole: "admin",
      leadId: "lead_1",
      workspaceId: "ws_123",
      metadata: { source: "manual", score: 88 },
    });
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).toHaveBeenCalledTimes(1);
    const call = mocks.auditLogCreate.mock.calls[0][0];
    expect(call.data.workspaceId).toBe("ws_123");
    expect(call.data.action).toBe("lead.create");
    expect(call.data.actorRole).toBe("admin");
    expect(call.data.leadId).toBe("lead_1");
    expect(JSON.parse(call.data.metadataJson)).toEqual({
      source: "manual",
      score: 88,
    });
  });

  it("resolves workspaceId from getWorkspaceContext when not provided", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "ws_from_context" });
    mocks.auditLogCreate.mockResolvedValue({ id: "al_2" });
    await writeAuditLog({ action: "lead.update", actorRole: "sales" });
    expect(mocks.getWorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mocks.auditLogCreate.mock.calls[0][0].data.workspaceId).toBe(
      "ws_from_context",
    );
  });

  it("coerces missing leadId to null", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "al_3" });
    await writeAuditLog({
      action: "workspace.upsert",
      actorRole: "owner",
      workspaceId: "ws_x",
    });
    expect(mocks.auditLogCreate.mock.calls[0][0].data.leadId).toBe(null);
  });

  it("serializes missing metadata to '{}'", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "al_4" });
    await writeAuditLog({
      action: "import.start",
      actorRole: "system",
      workspaceId: "ws_x",
    });
    expect(mocks.auditLogCreate.mock.calls[0][0].data.metadataJson).toBe("{}");
  });

  it("swallows prisma failures via logger.warn (never throws)", async () => {
    mocks.auditLogCreate.mockRejectedValue(new Error("DB unreachable"));
    await expect(
      writeAuditLog({
        action: "lead.create",
        actorRole: "admin",
        workspaceId: "ws_x",
      }),
    ).resolves.toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "audit_log_failed",
      expect.objectContaining({
        action: "lead.create",
        error: "DB unreachable",
      }),
    );
  });

  it("logs 'unknown' when a non-Error is thrown", async () => {
    mocks.auditLogCreate.mockRejectedValue("just a string");
    await writeAuditLog({
      action: "lead.create",
      actorRole: "admin",
      workspaceId: "ws_x",
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "audit_log_failed",
      expect.objectContaining({ error: "unknown" }),
    );
  });
});
