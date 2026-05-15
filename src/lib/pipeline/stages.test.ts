import { describe, it, expect } from "vitest";
import {
  ACTIVE_STAGES,
  isLeadStage,
  isValidTransition,
  LEAD_STAGES,
  normalizeStage,
  STAGE_TRANSITIONS,
  TERMINAL_STAGES,
} from "./stages";

describe("LeadStage enum + helpers", () => {
  it("exports all required stages", () => {
    expect(LEAD_STAGES).toEqual([
      "NEW",
      "IMPORTED",
      "SCORED",
      "AUDIT_GENERATED",
      "PREPARED",
      "CONTACTED",
      "REPLIED",
      "QUALIFIED",
      "CALL_BOOKED",
      "PROPOSAL_SENT",
      "WON",
      "LOST",
      "NURTURE",
      "DISQUALIFIED",
    ]);
  });

  it("isLeadStage returns true for canonical values and false otherwise", () => {
    expect(isLeadStage("CONTACTED")).toBe(true);
    expect(isLeadStage("contacted")).toBe(false);
    expect(isLeadStage("unknown")).toBe(false);
    expect(isLeadStage(null)).toBe(false);
  });

  it("normalizeStage maps legacy free-text to canonical", () => {
    expect(normalizeStage("New")).toBe("NEW");
    expect(normalizeStage("Contacted")).toBe("CONTACTED");
    expect(normalizeStage("audited")).toBe("AUDIT_GENERATED");
    expect(normalizeStage("Audit Done")).toBe("AUDIT_GENERATED");
    expect(normalizeStage("Demo Booked")).toBe("CALL_BOOKED");
    expect(normalizeStage("Closed Won")).toBe("WON");
    expect(normalizeStage("paid")).toBe("WON");
    expect(normalizeStage("unknown-status")).toBe("NEW");
    expect(normalizeStage(undefined)).toBe("NEW");
    expect(normalizeStage(null)).toBe("NEW");
    expect(normalizeStage("")).toBe("NEW");
  });

  it("isValidTransition rejects self-transitions", () => {
    for (const s of LEAD_STAGES) expect(isValidTransition(s, s)).toBe(false);
  });

  it("isValidTransition rejects clearly invalid moves", () => {
    expect(isValidTransition("WON", "NEW")).toBe(false);
    expect(isValidTransition("WON", "CONTACTED")).toBe(false);
    expect(isValidTransition("PROPOSAL_SENT", "NEW")).toBe(false);
    expect(isValidTransition("DISQUALIFIED", "NEW")).toBe(false);
  });

  it("isValidTransition allows sensible forward moves", () => {
    expect(isValidTransition("NEW", "CONTACTED")).toBe(true);
    expect(isValidTransition("CONTACTED", "REPLIED")).toBe(true);
    expect(isValidTransition("REPLIED", "CALL_BOOKED")).toBe(true);
    expect(isValidTransition("CALL_BOOKED", "PROPOSAL_SENT")).toBe(true);
    expect(isValidTransition("PROPOSAL_SENT", "WON")).toBe(true);
    expect(isValidTransition("PROPOSAL_SENT", "LOST")).toBe(true);
  });

  it("LOST can rehydrate to NURTURE only (and not e.g. NEW)", () => {
    expect(isValidTransition("LOST", "NURTURE")).toBe(true);
    expect(isValidTransition("LOST", "NEW")).toBe(false);
    expect(isValidTransition("LOST", "CONTACTED")).toBe(false);
  });

  it("terminal stages WON and DISQUALIFIED have no forward transitions", () => {
    for (const t of TERMINAL_STAGES) {
      if (t === "LOST") continue; // LOST is in TERMINAL_STAGES? no \u2014 not in our list
      expect(STAGE_TRANSITIONS[t].length).toBe(0);
    }
    expect(STAGE_TRANSITIONS.WON).toEqual([]);
    expect(STAGE_TRANSITIONS.DISQUALIFIED).toEqual([]);
  });

  it("ACTIVE_STAGES excludes terminal and NEW", () => {
    expect(ACTIVE_STAGES).not.toContain("NEW");
    expect(ACTIVE_STAGES).not.toContain("WON");
    expect(ACTIVE_STAGES).not.toContain("LOST");
    expect(ACTIVE_STAGES).not.toContain("DISQUALIFIED");
    expect(ACTIVE_STAGES).not.toContain("NURTURE");
  });
});
