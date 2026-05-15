import { describe, it, expect } from "vitest";
import type { NextBestAction } from "@/lib/pipeline/next-best-action";
import { NextBestActionStrip } from "./next-best-action-strip";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

describe("NextBestActionStrip", () => {
  it("returns null for kind=do_nothing", () => {
    const action: NextBestAction = {
      kind: "do_nothing",
      urgency: "low",
      reason: "Proposal is in flight.",
    };
    expect(NextBestActionStrip({ action })).toBeNull();
  });

  it("renders the CTA when present", () => {
    const action: NextBestAction = {
      kind: "send_proposal",
      urgency: "high",
      reason: "Prospect is interested.",
      cta: "Send proposal",
    };
    const tree = NextBestActionStrip({ action });
    expect(findString(tree, "Send proposal")).toBe(true);
    expect(findString(tree, "Prospect is interested.")).toBe(true);
    expect(findString(tree, "high")).toBe(true);
  });

  it("falls back to the kind label when no CTA is provided", () => {
    const action: NextBestAction = {
      kind: "follow_up_email",
      urgency: "medium",
      reason: "Stale outreach. Bump them.",
    };
    const tree = NextBestActionStrip({ action });
    expect(findString(tree, "Send a follow-up email")).toBe(true);
    expect(findString(tree, "medium")).toBe(true);
  });
});
