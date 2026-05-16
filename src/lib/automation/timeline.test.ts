import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  activityFindMany: vi.fn(),
  outreachLogFindMany: vi.fn(),
  viewLogFindMany: vi.fn(),
  paymentLogFindMany: vi.fn(),
  outboundMessageFindMany: vi.fn(),
  taskFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: { create: mocks.activityCreate, findMany: mocks.activityFindMany },
    outreachLog: { findMany: mocks.outreachLogFindMany },
    viewLog: { findMany: mocks.viewLogFindMany },
    paymentLog: { findMany: mocks.paymentLogFindMany },
    outboundMessage: { findMany: mocks.outboundMessageFindMany },
    task: { findMany: mocks.taskFindMany },
  },
}));

import { createActivity, getLeadTimeline } from "./timeline";

function ts(iso: string) {
  return new Date(iso);
}

describe("createActivity", () => {
  beforeEach(() => {
    mocks.activityCreate.mockReset();
  });

  it("defaults source='system' and stringifies metadata", async () => {
    mocks.activityCreate.mockResolvedValue({ id: "act_1" });
    await createActivity({
      workspaceId: "ws_1",
      leadId: "lead_1",
      type: "audit.regenerated",
      metadata: { reason: "ai-update" },
    });
    const call = mocks.activityCreate.mock.calls[0][0];
    expect(call.data.workspaceId).toBe("ws_1");
    expect(call.data.leadId).toBe("lead_1");
    expect(call.data.type).toBe("audit.regenerated");
    expect(call.data.source).toBe("system");
    expect(call.data.metadataJson).toBe('{"reason":"ai-update"}');
  });

  it("coerces missing optional fields to null", async () => {
    mocks.activityCreate.mockResolvedValue({ id: "act_2" });
    await createActivity({ workspaceId: "ws_1", type: "ping" });
    const data = mocks.activityCreate.mock.calls[0][0].data;
    expect(data.leadId).toBe(null);
    expect(data.detail).toBe(null);
    expect(data.metadataJson).toBe(null);
  });

  it("honours an explicit source", async () => {
    mocks.activityCreate.mockResolvedValue({ id: "act_3" });
    await createActivity({ workspaceId: "ws_1", type: "manual.note", source: "user" });
    expect(mocks.activityCreate.mock.calls[0][0].data.source).toBe("user");
  });
});

describe("getLeadTimeline", () => {
  beforeEach(() => {
    for (const m of [
      mocks.activityFindMany,
      mocks.outreachLogFindMany,
      mocks.viewLogFindMany,
      mocks.paymentLogFindMany,
      mocks.outboundMessageFindMany,
      mocks.taskFindMany,
    ]) {
      m.mockReset();
      m.mockResolvedValue([]);
    }
  });

  it("returns an empty array when every source is empty", async () => {
    const out = await getLeadTimeline("ws_1", "lead_1");
    expect(out).toEqual([]);
  });

  it("merges entries from every source and sorts by createdAt descending", async () => {
    mocks.activityFindMany.mockResolvedValue([
      { type: "audit.regenerated", detail: "manual", source: "system", createdAt: ts("2026-05-01T10:00:00Z") },
    ]);
    mocks.outreachLogFindMany.mockResolvedValue([
      { type: "Call", notes: "left voicemail", createdAt: ts("2026-05-03T09:00:00Z") },
    ]);
    mocks.viewLogFindMany.mockResolvedValue([
      { userAgent: "Mozilla/5.0", createdAt: ts("2026-05-02T15:00:00Z") },
    ]);
    mocks.paymentLogFindMany.mockResolvedValue([
      { eventType: "checkout.session.completed", provider: "stripe", createdAt: ts("2026-05-05T12:00:00Z") },
    ]);
    mocks.outboundMessageFindMany.mockResolvedValue([
      { channel: "email", status: "sent", subject: "Hi Acme", body: "long body here", createdAt: ts("2026-05-04T08:00:00Z") },
    ]);
    mocks.taskFindMany.mockResolvedValue([
      { status: "done", title: "Follow up", source: "user", createdAt: ts("2026-05-06T14:00:00Z") },
    ]);

    const out = await getLeadTimeline("ws_1", "lead_1");
    expect(out).toHaveLength(6);
    // Newest first: task (May 6) → payment (5) → message (4) → outreach (3) → view (2) → activity (1)
    expect(out.map((e) => e.type)).toEqual([
      "task.done",
      "payment.checkout.session.completed",
      "automation.email.sent",
      "outreach.call",
      "audit.viewed",
      "audit.regenerated",
    ]);
  });

  it("lowercases outreach types in the merged stream", async () => {
    mocks.outreachLogFindMany.mockResolvedValue([
      { type: "SMS", notes: "ping", createdAt: ts("2026-05-01T00:00:00Z") },
    ]);
    const out = await getLeadTimeline("ws_1", "lead_1");
    expect(out[0].type).toBe("outreach.sms");
  });

  it("truncates long outbound message bodies to 100 chars when subject is missing", async () => {
    const longBody = "x".repeat(250);
    mocks.outboundMessageFindMany.mockResolvedValue([
      { channel: "email", status: "queued", subject: null, body: longBody, createdAt: ts("2026-05-01T00:00:00Z") },
    ]);
    const out = await getLeadTimeline("ws_1", "lead_1");
    expect(out[0].detail).toBe("x".repeat(100));
  });

  it("uses subject when present instead of truncating body", async () => {
    mocks.outboundMessageFindMany.mockResolvedValue([
      { channel: "email", status: "sent", subject: "Hi Acme", body: "x".repeat(500), createdAt: ts("2026-05-01T00:00:00Z") },
    ]);
    const out = await getLeadTimeline("ws_1", "lead_1");
    expect(out[0].detail).toBe("Hi Acme");
  });

  it("scopes every query to the workspace + lead ids", async () => {
    await getLeadTimeline("ws_42", "lead_99");
    for (const m of [
      mocks.activityFindMany,
      mocks.outreachLogFindMany,
      mocks.viewLogFindMany,
      mocks.paymentLogFindMany,
      mocks.outboundMessageFindMany,
      mocks.taskFindMany,
    ]) {
      const where = m.mock.calls[0][0].where;
      expect(where.workspaceId).toBe("ws_42");
      expect(where.leadId).toBe("lead_99");
    }
  });
});
