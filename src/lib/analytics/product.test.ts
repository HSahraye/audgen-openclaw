import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  trackEvent: mocks.trackEvent,
}));

import { trackProductAnalytics } from "./product";

describe("trackProductAnalytics", () => {
  beforeEach(() => {
    mocks.trackEvent.mockReset();
    mocks.trackEvent.mockResolvedValue(undefined);
  });

  it("prefixes the event with 'product.' and merges properties with workspaceId", async () => {
    await trackProductAnalytics({
      workspaceId: "ws_1",
      event: "audit_viewed",
      leadId: "lead_1",
      properties: { source: "email" },
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      "product.audit_viewed",
      { source: "email", workspaceId: "ws_1" },
      "lead_1",
      "ws_1",
    );
  });

  it("survives empty/missing properties", async () => {
    await trackProductAnalytics({
      workspaceId: "ws_x",
      event: "onboarding_step",
    });
    expect(mocks.trackEvent.mock.calls[0][1]).toEqual({
      workspaceId: "ws_x",
    });
  });

  it("includes workspaceId in the payload even when caller already supplied one", async () => {
    // Caller properties win over the workspaceId injection? No — current
    // implementation puts workspaceId AFTER the spread, so it always
    // overwrites. Lock that in.
    await trackProductAnalytics({
      workspaceId: "ws_real",
      event: "noop",
      properties: { workspaceId: "ws_fake" },
    });
    const payload = mocks.trackEvent.mock.calls[0][1];
    expect(payload.workspaceId).toBe("ws_real");
  });

  it("forwards leadId positionally to trackEvent (3rd arg)", async () => {
    await trackProductAnalytics({
      workspaceId: "ws_1",
      event: "click",
      leadId: "lead_99",
    });
    expect(mocks.trackEvent.mock.calls[0][2]).toBe("lead_99");
  });

  it("forwards workspaceId positionally to trackEvent (4th arg)", async () => {
    await trackProductAnalytics({ workspaceId: "ws_42", event: "click" });
    expect(mocks.trackEvent.mock.calls[0][3]).toBe("ws_42");
  });
});
