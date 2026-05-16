import { describe, it, expect } from "vitest";
import { Plus } from "lucide-react";
import { EmptyState } from "./empty-state";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

function findElement(
  node: unknown,
  predicate: (props: Record<string, unknown>, type: unknown) => boolean,
): unknown {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, predicate);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object" && "type" in node && "props" in node) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    if (predicate(el.props, el.type)) return el;
    return findElement(el.props.children, predicate);
  }
  return null;
}

describe("EmptyState", () => {
  it("renders title text", () => {
    const tree = EmptyState({ title: "No leads yet" });
    expect(findString(tree, "No leads yet")).toBe(true);
  });

  it("renders description when provided", () => {
    const tree = EmptyState({
      title: "Empty",
      description: "Import a CSV to get started.",
    });
    expect(findString(tree, "Import a CSV to get started.")).toBe(true);
  });

  it("renders a Link CTA when ctaHref is provided", () => {
    const tree = EmptyState({
      title: "Empty",
      ctaLabel: "Import leads",
      ctaHref: "/?import=1",
    });
    const link = findElement(
      tree,
      (props) => typeof props.href === "string" && props.href === "/?import=1",
    );
    expect(link).not.toBeNull();
    expect(findString(tree, "Import leads")).toBe(true);
  });

  it("renders a button CTA when ctaOnClick is provided (no href)", () => {
    const tree = EmptyState({
      title: "Empty",
      ctaLabel: "Create sequence",
      ctaOnClick: () => {},
    });
    const button = findElement(
      tree,
      (props, type) => type === "button" && props.type === "button",
    );
    expect(button).not.toBeNull();
    expect(findString(tree, "Create sequence")).toBe(true);
  });

  it("renders no CTA when label is missing", () => {
    const tree = EmptyState({ title: "Empty", ctaHref: "/foo" });
    const button = findElement(tree, (_, type) => type === "button");
    const link = findElement(tree, (props) => "href" in props);
    expect(button).toBeNull();
    expect(link).toBeNull();
  });

  it("renders an icon wrapper when icon is provided", () => {
    const tree = EmptyState({ title: "Empty", icon: Plus });
    const iconEl = findElement(tree, (_, type) => type === Plus);
    expect(iconEl).not.toBeNull();
  });

  it("uses 'inline' variant without card chrome", () => {
    const tree = EmptyState({ title: "Empty", variant: "inline" });
    // The outer wrapper className should NOT contain 'border-dashed' for inline
    const root = tree as { props: { className?: string } };
    expect(typeof root.props.className).toBe("string");
    expect(root.props.className).not.toContain("border-dashed");
  });

  it("uses default variant with dashed card chrome", () => {
    const tree = EmptyState({ title: "Empty" });
    const root = tree as { props: { className?: string } };
    expect(root.props.className).toContain("border-dashed");
  });

  it("sets role=status for assistive tech announcement", () => {
    const tree = EmptyState({ title: "Empty" });
    const root = tree as { props: { role?: string } };
    expect(root.props.role).toBe("status");
  });
});
