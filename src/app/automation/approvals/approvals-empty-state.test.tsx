import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ApprovalsEmptyState,
  APPROVALS_PAGE_INTRO,
  APPROVALS_EMPTY_HEADING,
  APPROVALS_EMPTY_BODY,
  APPROVALS_EMPTY_CTA_LABEL,
  APPROVALS_EMPTY_CTA_HREF,
} from "./approvals-empty-state";

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
    const props = (node as { props?: { href?: unknown; children?: unknown } }).props;
    if (props && typeof props.href === "string") return props.href;
    if (props && "children" in props) {
      const found = findLinkHref(props.children);
      if (found) return found;
    }
  }
  return null;
}

describe("ApprovalsEmptyState", () => {
  it("renders the page intro string for /automation/approvals", () => {
    expect(APPROVALS_PAGE_INTRO.length).toBeGreaterThan(0);
    expect(APPROVALS_PAGE_INTRO.split(/\s+/).length).toBeLessThanOrEqual(18);
  });

  it("renders the empty-state heading + body when no approvals exist", () => {
    const tree = ApprovalsEmptyState();
    expect(findString(tree, APPROVALS_EMPTY_HEADING)).toBe(true);
    expect(findString(tree, APPROVALS_EMPTY_BODY)).toBe(true);
  });

  it("renders the CTA label with the right href", () => {
    const tree = ApprovalsEmptyState();
    expect(findString(tree, APPROVALS_EMPTY_CTA_LABEL)).toBe(true);
    expect(findLinkHref(tree)).toBe(APPROVALS_EMPTY_CTA_HREF);
  });

  it("is wired into the /automation/approvals page intro and the queue's empty path", () => {
    const pageSource = readFileSync(
      path.resolve(__dirname, "page.tsx"),
      "utf8",
    );
    const queueSource = readFileSync(
      path.resolve(__dirname, "../../../components/approval-queue.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("APPROVALS_PAGE_INTRO");
    expect(queueSource).toContain("ApprovalsEmptyState");
    expect(queueSource).toContain("!items.length");
  });
});
