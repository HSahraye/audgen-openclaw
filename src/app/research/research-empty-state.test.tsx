import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ResearchEmptyState,
  RESEARCH_PAGE_INTRO,
  RESEARCH_EMPTY_HEADING,
  RESEARCH_EMPTY_BODY,
  RESEARCH_EMPTY_CTA_LABEL,
  RESEARCH_EMPTY_CTA_HREF,
} from "./research-empty-state";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

function findLinkHref(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findLinkHref(child);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as { type?: unknown; props?: { href?: unknown; children?: unknown } };
    const props = obj.props;
    if (props && typeof props.href === "string") return props.href;
    if (props && "children" in props) {
      const found = findLinkHref(props.children);
      if (found) return found;
    }
  }
  return null;
}

describe("ResearchEmptyState", () => {
  it("renders the page intro string for /research", () => {
    expect(RESEARCH_PAGE_INTRO.length).toBeGreaterThan(0);
    expect(RESEARCH_PAGE_INTRO.split(/\s+/).length).toBeLessThanOrEqual(18);
  });

  it("renders the empty-state heading + body when no items exist", () => {
    const tree = ResearchEmptyState();
    expect(findString(tree, RESEARCH_EMPTY_HEADING)).toBe(true);
    expect(findString(tree, RESEARCH_EMPTY_BODY)).toBe(true);
  });

  it("renders the CTA label with the right href", () => {
    const tree = ResearchEmptyState();
    expect(findString(tree, RESEARCH_EMPTY_CTA_LABEL)).toBe(true);
    expect(findLinkHref(tree)).toBe(RESEARCH_EMPTY_CTA_HREF);
  });

  it("is wired into the research dashboard for the parsed.length === 0 path", () => {
    const dashboardSource = readFileSync(
      path.resolve(__dirname, "../../components/research-queue-dashboard.tsx"),
      "utf8",
    );
    expect(dashboardSource).toContain("ResearchEmptyState");
    expect(dashboardSource).toContain("RESEARCH_PAGE_INTRO");
    expect(dashboardSource).toContain("parsed.length === 0");
  });
});
