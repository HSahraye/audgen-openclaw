import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStructuredResponse: vi.fn(),
  getLeadTimeline: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  generateStructuredResponse: mocks.generateStructuredResponse,
}));

vi.mock("@/lib/automation/timeline", () => ({
  getLeadTimeline: mocks.getLeadTimeline,
}));

import { draftReplyAssistant } from "./reply-assistant";

const fakeTimeline = [
  {
    type: "outreach.email",
    detail: "Initial outreach sent",
    source: "outreach",
    createdAt: new Date("2026-05-10T10:00:00Z"),
  },
  {
    type: "audit.viewed",
    detail: "Mobile Safari",
    source: "tracking",
    createdAt: new Date("2026-05-11T14:00:00Z"),
  },
];

describe("draftReplyAssistant", () => {
  beforeEach(() => {
    mocks.generateStructuredResponse.mockReset();
    mocks.getLeadTimeline.mockReset();
  });

  it("returns the AI response verbatim when the provider succeeds", async () => {
    mocks.getLeadTimeline.mockResolvedValue(fakeTimeline);
    const aiResponse = {
      summary: "Lead is asking about ROI timeline.",
      draftReply: "Thanks for following up — quick answer on ROI...",
      objectionHandling: "Acknowledge timing concern; reframe ROI as recovered calls.",
      urgencyFraming: "Highlight seasonality risk.",
    };
    mocks.generateStructuredResponse.mockResolvedValue(aiResponse);
    const result = await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "When would we see ROI?",
    });
    expect(result).toEqual(aiResponse);
  });

  it("falls back to safe canned copy when the provider returns null/undefined", async () => {
    mocks.getLeadTimeline.mockResolvedValue([]);
    mocks.generateStructuredResponse.mockResolvedValue(null);
    const result = await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "ping",
    });
    expect(result.summary).toBe("Could not generate AI summary.");
    expect(result.draftReply.length).toBeGreaterThan(0);
    expect(result.objectionHandling.length).toBeGreaterThan(0);
    expect(result.urgencyFraming.length).toBeGreaterThan(0);
  });

  it("trims the timeline to the 10 most-recent entries before sending to AI", async () => {
    const long = Array.from({ length: 25 }, (_, i) => ({
      type: `evt.${i}`,
      detail: null,
      source: "test",
      createdAt: new Date(2026, 4, 1, 0, i),
    }));
    mocks.getLeadTimeline.mockResolvedValue(long);
    mocks.generateStructuredResponse.mockResolvedValue({
      summary: "s",
      draftReply: "d",
      objectionHandling: "o",
      urgencyFraming: "u",
    });
    await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "hi",
    });
    const call = mocks.generateStructuredResponse.mock.calls[0][0];
    expect(call.input.recentTimeline).toHaveLength(10);
    // First entry should match the first of the input timeline (slice 0..10)
    expect(call.input.recentTimeline[0].type).toBe("evt.0");
  });

  it("serialises createdAt to ISO strings for the AI payload", async () => {
    mocks.getLeadTimeline.mockResolvedValue(fakeTimeline);
    mocks.generateStructuredResponse.mockResolvedValue({
      summary: "s",
      draftReply: "d",
      objectionHandling: "o",
      urgencyFraming: "u",
    });
    await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "hi",
    });
    const recent = mocks.generateStructuredResponse.mock.calls[0][0].input
      .recentTimeline as Array<{ createdAt: string }>;
    expect(recent[0].createdAt).toBe("2026-05-10T10:00:00.000Z");
  });

  it("uses default objective when none provided", async () => {
    mocks.getLeadTimeline.mockResolvedValue([]);
    mocks.generateStructuredResponse.mockResolvedValue({
      summary: "s",
      draftReply: "d",
      objectionHandling: "o",
      urgencyFraming: "u",
    });
    await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "hi",
    });
    const call = mocks.generateStructuredResponse.mock.calls[0][0];
    expect(call.input.objective).toBe("move lead toward next step");
  });

  it("propagates explicit objective verbatim", async () => {
    mocks.getLeadTimeline.mockResolvedValue([]);
    mocks.generateStructuredResponse.mockResolvedValue({
      summary: "s",
      draftReply: "d",
      objectionHandling: "o",
      urgencyFraming: "u",
    });
    await draftReplyAssistant({
      workspaceId: "ws_1",
      leadId: "lead_1",
      incomingMessage: "hi",
      objective: "secure a 15-min meeting this week",
    });
    expect(
      mocks.generateStructuredResponse.mock.calls[0][0].input.objective,
    ).toBe("secure a 15-min meeting this week");
  });

  it("passes workspaceId in the metadata for analytics/billing attribution", async () => {
    mocks.getLeadTimeline.mockResolvedValue([]);
    mocks.generateStructuredResponse.mockResolvedValue({
      summary: "s",
      draftReply: "d",
      objectionHandling: "o",
      urgencyFraming: "u",
    });
    await draftReplyAssistant({
      workspaceId: "ws_special",
      leadId: "lead_1",
      incomingMessage: "hi",
    });
    const meta = mocks.generateStructuredResponse.mock.calls[0][0].metadata;
    expect(meta.workspaceId).toBe("ws_special");
    expect(meta.generationType).toBe("reply_assistant");
  });
});
