import { describe, it, expect } from "vitest";
import { VerticalPackHints } from "./vertical-pack-hints";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

describe("VerticalPackHints", () => {
  it("returns null when category does not match any pack", () => {
    expect(
      VerticalPackHints({ category: "plumbing", businessName: "ACME Plumbing" }),
    ).toBeNull();
    expect(
      VerticalPackHints({ category: null, businessName: "ACME" }),
    ).toBeNull();
    expect(
      VerticalPackHints({ category: undefined, businessName: "ACME" }),
    ).toBeNull();
  });

  it("renders the dental pack for a dental category", () => {
    const tree = VerticalPackHints({
      category: "Dental",
      businessName: "Bay Smiles",
    });
    expect(findString(tree, "Dental practices")).toBe(true);
    expect(findString(tree, "Bay Smiles")).toBe(true);
    // At least one opening angle word from the dental pack
    expect(findString(tree, "Online booking")).toBe(true);
    // Pricing tile labels
    expect(findString(tree, "Starter")).toBe(true);
    expect(findString(tree, "Premium")).toBe(true);
    // Cycle days display: dental pack's typicalCycleDays = 9
    expect(findString(tree, "9")).toBe(true);
  });

  it("renders the smoke-shop pack for a vape shop", () => {
    const tree = VerticalPackHints({
      category: "vape shop and accessories",
      businessName: "420 Smoke",
    });
    expect(findString(tree, "Smoke shops")).toBe(true);
    expect(findString(tree, "420 Smoke")).toBe(true);
  });

  it("renders the hvac pack for an AC repair business", () => {
    const tree = VerticalPackHints({
      category: "AC Repair",
      businessName: "Cool Air Bros",
    });
    expect(findString(tree, "HVAC contractors")).toBe(true);
    expect(findString(tree, "Cool Air Bros")).toBe(true);
  });
});
