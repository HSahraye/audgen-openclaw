import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  trackEvent: mocks.trackEvent,
}));

import { trackSalesOsEvent } from "./events";

describe("trackSalesOsEvent", () => {
  beforeEach(() => {
    mocks.trackEvent.mockReset();
    mocks.trackEvent.mockResolvedValue(undefined);
  });

  it("prefixes the event type with 'sales_os.'", async () => {
    await trackSalesOsEvent({
      eventType: "audit_generated",
      workspaceId: "ws_1",
      leadId: "lead_1",
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      "sales_os.audit_generated",
      expect.objectContaining({ leadId: "lead_1" }),
      "lead_1",
      "ws_1",
    );
  });

  it("merges caller-supplied payload with leadId injection", async () => {
    await trackSalesOsEvent({
      eventType: "payment_intent_recorded",
      workspaceId: "ws_1",
      leadId: "lead_42",
      payload: { amount: 1500, currency: "USD" },
    });
    const payload = mocks.trackEvent.mock.calls[0][1];
    expect(payload).toEqual({
      amount: 1500,
      currency: "USD",
      leadId: "lead_42",
    });
  });

  it("coerces missing leadId to null inside the payload", async () => {
    await trackSalesOsEvent({
      eventType: "engagement_spike_detected",
      workspaceId: "ws_1",
    });
    const payload = mocks.trackEvent.mock.calls[0][1];
    expect(payload.leadId).toBe(null);
  });

  it("passes undefined leadId/workspaceId straight through (trackEvent fallbacks decide)", async () => {
    await trackSalesOsEvent({ eventType: "lead_progressed" });
    const call = mocks.trackEvent.mock.calls[0];
    expect(call[2]).toBe(undefined);
    expect(call[3]).toBe(undefined);
  });

  it("works for every documented SalesOsEvent value", async () => {
    const events: Array<
      | "audit_generated"
      | "outreach_generated"
      | "proposal_generated"
      | "engagement_spike_detected"
      | "payment_intent_recorded"
      | "lead_progressed"
    > = [
      "audit_generated",
      "outreach_generated",
      "proposal_generated",
      "engagement_spike_detected",
      "payment_intent_recorded",
      "lead_progressed",
    ];
    for (const eventType of events) {
      mocks.trackEvent.mockClear();
      await trackSalesOsEvent({ eventType, workspaceId: "ws_1" });
      expect(mocks.trackEvent.mock.calls[0][0]).toBe(`sales_os.${eventType}`);
    }
  });
});
