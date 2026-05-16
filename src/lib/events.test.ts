import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  eventLogCreate: vi.fn(),
  getWorkspaceContext: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    eventLog: { create: mocks.eventLogCreate },
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

import { trackEvent } from "./events";

describe("trackEvent", () => {
  beforeEach(() => {
    mocks.eventLogCreate.mockReset();
    mocks.getWorkspaceContext.mockReset();
    mocks.loggerWarn.mockReset();
  });

  it("writes a row with explicit workspaceId without calling getWorkspaceContext", async () => {
    mocks.eventLogCreate.mockResolvedValue({ id: "ev_1" });
    await trackEvent("lead_created", { source: "manual" }, "lead_1", "ws_x");
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    const data = mocks.eventLogCreate.mock.calls[0][0].data;
    expect(data.workspaceId).toBe("ws_x");
    expect(data.eventType).toBe("lead_created");
    expect(data.leadId).toBe("lead_1");
    expect(JSON.parse(data.payloadJson)).toEqual({ source: "manual" });
  });

  it("resolves workspaceId from getWorkspaceContext when omitted", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "ws_ctx" });
    mocks.eventLogCreate.mockResolvedValue({ id: "ev_2" });
    await trackEvent("audit_viewed", { agent: "ios" });
    expect(mocks.getWorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mocks.eventLogCreate.mock.calls[0][0].data.workspaceId).toBe("ws_ctx");
  });

  it("coerces missing leadId to null", async () => {
    mocks.eventLogCreate.mockResolvedValue({ id: "ev_3" });
    await trackEvent("workspace_event", {}, undefined, "ws_x");
    expect(mocks.eventLogCreate.mock.calls[0][0].data.leadId).toBe(null);
  });

  it("serialises empty payload to '{}'", async () => {
    mocks.eventLogCreate.mockResolvedValue({ id: "ev_4" });
    await trackEvent("ping", {}, undefined, "ws_x");
    expect(mocks.eventLogCreate.mock.calls[0][0].data.payloadJson).toBe("{}");
  });

  it("swallows prisma failures via logger.warn (never throws)", async () => {
    mocks.eventLogCreate.mockRejectedValue(new Error("DB error"));
    await expect(
      trackEvent("lead_created", { source: "manual" }, "lead_1", "ws_x"),
    ).resolves.toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "event_track_failed",
      expect.objectContaining({ eventType: "lead_created", error: "DB error" }),
    );
  });

  it("logs 'unknown' when a non-Error is thrown", async () => {
    mocks.eventLogCreate.mockRejectedValue("a string");
    await trackEvent("ping", {}, undefined, "ws_x");
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "event_track_failed",
      expect.objectContaining({ error: "unknown" }),
    );
  });
});
