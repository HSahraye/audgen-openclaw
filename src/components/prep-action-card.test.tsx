import { describe, it, expect } from "vitest";
import { PrepActionCard } from "./prep-action-card";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

const goodPitch =
  "Hey Maria \u2014 quick note: Bay Smiles Dental's mobile site isn't booking-friendly, " +
  "which costs new patient calls from Santa Clara. Want a 15-min call this week?";

const baseLead = {
  status: "CONTACTED",
  businessName: "Bay Smiles Dental",
  ownerName: "Maria",
  category: "Dental",
  location: "Santa Clara",
  nextFollowUpAt: null,
  lastContactedAt: null,
};

describe("PrepActionCard", () => {
  it("renders the canonical stage and a next-action label", () => {
    const tree = PrepActionCard({
      lead: baseLead,
      pitchText: goodPitch,
      failedAuditCheckKeys: ["mobileFriendly"],
    });
    expect(findString(tree, "CONTACTED")).toBe(true);
    expect(findString(tree, "Wait one beat")).toBe(true);
  });

  it("flags a fully personalised pitch as 4/4 (green)", () => {
    const tree = PrepActionCard({
      lead: baseLead,
      pitchText: goodPitch,
      failedAuditCheckKeys: ["mobileFriendly"],
    });
    expect(findString(tree, "4/4")).toBe(true);
  });

  it("shows the gaps details when the pitch is generic", () => {
    const tree = PrepActionCard({
      lead: baseLead,
      pitchText: "Hi there, hope this finds you well. Let's hop on a call.",
      failedAuditCheckKeys: [],
    });
    // Not 4/4
    expect(findString(tree, "4/4")).toBe(false);
    expect(findString(tree, "Personalization gaps")).toBe(true);
  });

  it("recommends 'Move to call or proposal' when stage is REPLIED", () => {
    const tree = PrepActionCard({
      lead: { ...baseLead, status: "REPLIED" },
      pitchText: goodPitch,
      failedAuditCheckKeys: [],
    });
    expect(findString(tree, "Move to call or proposal")).toBe(true);
    expect(findString(tree, "high urgency")).toBe(true);
  });

  it("normalises legacy free-text status into a canonical stage", () => {
    const tree = PrepActionCard({
      lead: { ...baseLead, status: "Contacted" },
      pitchText: goodPitch,
      failedAuditCheckKeys: [],
    });
    expect(findString(tree, "CONTACTED")).toBe(true);
  });

  it("WON shows low-urgency 'capture the close'", () => {
    const tree = PrepActionCard({
      lead: { ...baseLead, status: "WON" },
      pitchText: goodPitch,
      failedAuditCheckKeys: [],
    });
    expect(findString(tree, "Capture the close")).toBe(true);
    expect(findString(tree, "low urgency")).toBe(true);
  });
});
