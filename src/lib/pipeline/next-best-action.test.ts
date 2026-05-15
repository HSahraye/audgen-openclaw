import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindFirst: vi.fn(),
  activityFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: mocks.leadFindFirst },
    activity: { findFirst: mocks.activityFindFirst },
  },
}));

import { decideNextBestAction, getNextBestAction } from "./next-best-action";

beforeEach(() => {
  mocks.leadFindFirst.mockReset();
  mocks.activityFindFirst.mockReset();
});

describe("decideNextBestAction (pure)", () => {
  it("WON -> do_nothing", () => {
    const r = decideNextBestAction({ stage: "WON", score: 80 });
    expect(r.kind).toBe("do_nothing");
  });

  it("LOST / DISQUALIFIED -> log_outcome", () => {
    expect(decideNextBestAction({ stage: "LOST", score: 60 }).kind).toBe("log_outcome");
    expect(decideNextBestAction({ stage: "DISQUALIFIED", score: 10 }).kind).toBe("log_outcome");
  });

  it("INTERESTED reply -> send_proposal regardless of stage", () => {
    const r = decideNextBestAction({
      stage: "CONTACTED",
      score: 50,
      lastReplyClassification: "INTERESTED",
      lastReplyAt: new Date(),
    });
    expect(r.kind).toBe("send_proposal");
    expect(r.urgency).toBe("high");
  });

  it("BOOKED_CALL reply -> book_call", () => {
    const r = decideNextBestAction({
      stage: "CONTACTED",
      score: 60,
      lastReplyClassification: "BOOKED_CALL",
      lastReplyAt: new Date(),
    });
    expect(r.kind).toBe("book_call");
  });

  it("PRICING_OBJECTION -> follow_up_email (value framing)", () => {
    const r = decideNextBestAction({
      stage: "QUALIFIED",
      score: 70,
      lastReplyClassification: "PRICING_OBJECTION",
      lastReplyAt: new Date(),
    });
    expect(r.kind).toBe("follow_up_email");
    expect(r.urgency).toBe("high");
  });

  it("NOT_INTERESTED / FOLLOW_UP_LATER -> nurture_pause", () => {
    expect(
      decideNextBestAction({
        stage: "CONTACTED",
        score: 50,
        lastReplyClassification: "NOT_INTERESTED",
      }).kind,
    ).toBe("nurture_pause");
    expect(
      decideNextBestAction({
        stage: "CONTACTED",
        score: 50,
        lastReplyClassification: "FOLLOW_UP_LATER",
      }).kind,
    ).toBe("nurture_pause");
  });

  it("WRONG_CONTACT / BOUNCED / ANGRY -> disqualify", () => {
    expect(
      decideNextBestAction({
        stage: "CONTACTED",
        score: 50,
        lastReplyClassification: "WRONG_CONTACT",
      }).kind,
    ).toBe("disqualify");
    expect(
      decideNextBestAction({
        stage: "CONTACTED",
        score: 50,
        lastReplyClassification: "BOUNCED",
      }).kind,
    ).toBe("disqualify");
    expect(
      decideNextBestAction({
        stage: "CONTACTED",
        score: 50,
        lastReplyClassification: "ANGRY",
      }).kind,
    ).toBe("disqualify");
  });

  it("PROPOSAL_SENT stale > 3 days -> follow_up_email", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000);
    const r = decideNextBestAction({
      stage: "PROPOSAL_SENT",
      score: 70,
      lastContactedAt: fourDaysAgo,
    });
    expect(r.kind).toBe("follow_up_email");
    expect(r.urgency).toBe("high");
  });

  it("PROPOSAL_SENT fresh -> do_nothing", () => {
    const r = decideNextBestAction({
      stage: "PROPOSAL_SENT",
      score: 70,
      lastContactedAt: new Date(),
    });
    expect(r.kind).toBe("do_nothing");
  });

  it("CONTACTED + stale > 4 days -> follow_up_call", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
    const r = decideNextBestAction({
      stage: "CONTACTED",
      score: 60,
      lastContactedAt: fiveDaysAgo,
    });
    expect(r.kind).toBe("follow_up_call");
    expect(r.urgency).toBe("medium");
  });

  it("NEW high-score -> prepare_outreach with high urgency", () => {
    const r = decideNextBestAction({ stage: "NEW", score: 90 });
    expect(r.kind).toBe("prepare_outreach");
    expect(r.urgency).toBe("high");
  });

  it("NEW low-score -> prepare_outreach low urgency", () => {
    const r = decideNextBestAction({ stage: "NEW", score: 30 });
    expect(r.kind).toBe("prepare_outreach");
    expect(r.urgency).toBe("low");
  });
});

describe("getNextBestAction (DB)", () => {
  it("rejects missing input", async () => {
    await expect(
      getNextBestAction({} as unknown as Parameters<typeof getNextBestAction>[0]),
    ).rejects.toThrow(/workspaceId.*leadId/);
  });

  it("returns null when the lead is not in the named workspace", async () => {
    mocks.leadFindFirst.mockResolvedValue(null);
    const r = await getNextBestAction({ workspaceId: "ws_A", leadId: "lead_in_B" });
    expect(r).toBeNull();
  });

  it("decodes last-reply classification from Activity metadata", async () => {
    mocks.leadFindFirst.mockResolvedValue({
      id: "lead_1",
      status: "CONTACTED",
      score: 70,
      lastContactedAt: new Date(),
    });
    mocks.activityFindFirst.mockResolvedValue({
      createdAt: new Date(),
      metadataJson: JSON.stringify({ classification: "INTERESTED" }),
    });
    const r = await getNextBestAction({ workspaceId: "ws_1", leadId: "lead_1" });
    expect(r?.kind).toBe("send_proposal");
  });

  it("handles malformed metadata gracefully (falls back to stage logic)", async () => {
    mocks.leadFindFirst.mockResolvedValue({
      id: "lead_1",
      status: "PROPOSAL_SENT",
      score: 60,
      lastContactedAt: new Date(),
    });
    mocks.activityFindFirst.mockResolvedValue({
      createdAt: new Date(),
      metadataJson: "{not json",
    });
    const r = await getNextBestAction({ workspaceId: "ws_1", leadId: "lead_1" });
    // PROPOSAL_SENT fresh, no reply -> do_nothing
    expect(r?.kind).toBe("do_nothing");
  });
});
