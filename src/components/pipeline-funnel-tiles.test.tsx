import { describe, it, expect } from "vitest";
import type { PipelineMetrics } from "@/lib/pipeline/counters";
import { PipelineFunnelTiles } from "./pipeline-funnel-tiles";

/**
 * PipelineFunnelTiles is a plain server component. We don't need a DOM —
 * just render the React element with mocked metrics and walk the tree
 * for the strings we care about.
 */

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node === needle || node.includes(needle);
  if (typeof node === "number") return String(node) === needle;
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { children?: unknown } }).props;
    return findString(props.children, needle);
  }
  return false;
}

const baseMetrics: PipelineMetrics = {
  workspaceId: "ws_1",
  asOf: new Date("2026-05-15T15:00:00Z"),
  counts: {
    NEW: 12,
    IMPORTED: 0,
    SCORED: 0,
    AUDIT_GENERATED: 0,
    PREPARED: 0,
    CONTACTED: 4,
    REPLIED: 3,
    QUALIFIED: 1,
    CALL_BOOKED: 2,
    PROPOSAL_SENT: 1,
    WON: 1,
    LOST: 0,
    NURTURE: 0,
    DISQUALIFIED: 0,
  },
  derived: {
    leadsImported: 24,
    leadsScored: 24,
    auditsGenerated: 0,
    outreachPrepared: 0,
    leadsContacted: 4,
    repliesLogged: 3,
    callsBooked: 2,
    proposalsSent: 1,
    won: 1,
    lost: 0,
    nurture: 0,
    disqualified: 0,
  },
  rates: {
    connectionRate: 4 / 24,
    replyRate: 3 / 4,
    bookedCallRate: 2 / 3,
    proposalRate: 1,
    closeRate: 1,
  },
};

describe("PipelineFunnelTiles", () => {
  it("renders every required counter label", () => {
    const tree = PipelineFunnelTiles({ metrics: baseMetrics });
    for (const label of ["Imported", "Contacted", "Replied", "Booked", "Proposal", "Won"]) {
      expect(findString(tree, label)).toBe(true);
    }
  });

  it("renders the counter values from derived metrics", () => {
    const tree = PipelineFunnelTiles({ metrics: baseMetrics });
    expect(findString(tree, "24")).toBe(true); // imported
    expect(findString(tree, "4")).toBe(true); // contacted
    expect(findString(tree, "3")).toBe(true); // replied
    expect(findString(tree, "2")).toBe(true); // booked
  });

  it("renders all five rate labels", () => {
    const tree = PipelineFunnelTiles({ metrics: baseMetrics });
    for (const label of [
      "Connection rate",
      "Reply rate",
      "Booked-call rate",
      "Proposal rate",
      "Close rate",
    ]) {
      expect(findString(tree, label)).toBe(true);
    }
  });

  it("renders zeros without NaN when the workspace is empty", () => {
    const empty: PipelineMetrics = {
      ...baseMetrics,
      derived: { ...baseMetrics.derived, leadsImported: 0, leadsContacted: 0, repliesLogged: 0, callsBooked: 0, proposalsSent: 0, won: 0 },
      rates: { connectionRate: 0, replyRate: 0, bookedCallRate: 0, proposalRate: 0, closeRate: 0 },
    };
    const tree = PipelineFunnelTiles({ metrics: empty });
    // Tree should not contain "NaN" anywhere.
    function hasNaN(node: unknown): boolean {
      if (typeof node === "string") return node.includes("NaN");
      if (Array.isArray(node)) return node.some(hasNaN);
      if (node && typeof node === "object" && "props" in node) {
        return hasNaN((node as { props: { children?: unknown } }).props.children);
      }
      return false;
    }
    expect(hasNaN(tree)).toBe(false);
    expect(findString(tree, "0%")).toBe(true);
  });
});
