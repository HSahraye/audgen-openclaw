import { describe, it, expect } from "vitest";
import { ACTIVITY_TYPES, buildActivityCreate, isActivityType } from "./activity";

describe("activity helpers", () => {
  it("exports the full activity type set", () => {
    expect(ACTIVITY_TYPES).toEqual([
      "LEAD_IMPORTED",
      "LEAD_SCORED",
      "AUDIT_GENERATED",
      "OUTREACH_PREPARED",
      "LEAD_CONTACTED",
      "REPLY_LOGGED",
      "CALL_BOOKED",
      "PROPOSAL_SENT",
      "DEAL_WON",
      "DEAL_LOST",
      "NOTE_ADDED",
      "STAGE_CHANGED",
    ]);
  });

  it("isActivityType validates canonical strings", () => {
    expect(isActivityType("STAGE_CHANGED")).toBe(true);
    expect(isActivityType("nope")).toBe(false);
    expect(isActivityType(null)).toBe(false);
  });

  it("buildActivityCreate produces canonical Prisma input", () => {
    const out = buildActivityCreate({
      workspaceId: "ws_1",
      leadId: "lead_1",
      type: "STAGE_CHANGED",
      detail: "moved to CONTACTED",
      source: "user",
      metadata: { previousStage: "NEW", nextStage: "CONTACTED" },
    });
    expect(out).toEqual({
      workspaceId: "ws_1",
      leadId: "lead_1",
      type: "STAGE_CHANGED",
      detail: "moved to CONTACTED",
      source: "user",
      metadataJson: JSON.stringify({ previousStage: "NEW", nextStage: "CONTACTED" }),
    });
  });

  it("buildActivityCreate defaults source to 'system' and metadataJson to null", () => {
    const out = buildActivityCreate({
      workspaceId: "ws_1",
      leadId: null,
      type: "NOTE_ADDED",
    });
    expect(out.source).toBe("system");
    expect(out.metadataJson).toBeNull();
    expect(out.leadId).toBeNull();
  });

  it("throws on missing workspaceId or invalid type", () => {
    expect(() =>
      buildActivityCreate({
        workspaceId: "",
        leadId: null,
        type: "NOTE_ADDED",
      }),
    ).toThrow(/workspaceId required/);
    expect(() =>
      buildActivityCreate({
        workspaceId: "ws_1",
        leadId: null,
        type: "NOT_A_TYPE" as unknown as "NOTE_ADDED",
      }),
    ).toThrow(/invalid type/);
  });
});
