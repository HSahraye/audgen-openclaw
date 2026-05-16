import { describe, it, expect } from "vitest";
import { normalizeAuditSlug, createAuditSlugBase } from "./audit-slugs";

describe("normalizeAuditSlug", () => {
  it("lowercases, trims, and replaces spaces with single dashes", () => {
    expect(normalizeAuditSlug(" Acme HVAC ")).toBe("acme-hvac");
    expect(normalizeAuditSlug("Acme    HVAC   Plumbing")).toBe("acme-hvac-plumbing");
  });

  it("strips punctuation and emoji while preserving letters/digits", () => {
    expect(normalizeAuditSlug("Acme, Inc. (2026)")).toBe("acme-inc-2026");
    expect(normalizeAuditSlug("Hello! 🚀 World ✨")).toBe("hello-world");
    expect(normalizeAuditSlug("a@b.com")).toBe("abcom");
  });

  it("collapses runs of dashes and trims leading/trailing dashes", () => {
    expect(normalizeAuditSlug("---hello---world---")).toBe("hello-world");
    expect(normalizeAuditSlug("a -- b -- c")).toBe("a-b-c");
  });

  it("truncates to the 32-char max length", () => {
    const long = "the quick brown fox jumps over the lazy dog";
    const out = normalizeAuditSlug(long);
    expect(out.length).toBeLessThanOrEqual(32);
    expect(out).toBe("the-quick-brown-fox-jumps-over-t");
  });

  it("returns an empty string when input has no slug-safe chars", () => {
    expect(normalizeAuditSlug("")).toBe("");
    expect(normalizeAuditSlug("!!!")).toBe("");
    expect(normalizeAuditSlug("   ")).toBe("");
    expect(normalizeAuditSlug("🎉🎈🎊")).toBe("");
  });
});

describe("createAuditSlugBase", () => {
  it("returns normalized slug for a real business name", () => {
    expect(createAuditSlugBase("Acme Plumbing Co.")).toBe("acme-plumbing-co");
  });

  it("falls back to 'audit' when normalization yields empty", () => {
    expect(createAuditSlugBase("")).toBe("audit");
    expect(createAuditSlugBase("!!!")).toBe("audit");
    // matches the implementation's null-safe fallback (businessName || "")
    expect(createAuditSlugBase(undefined as unknown as string)).toBe("audit");
  });

  it("respects the 32-char ceiling", () => {
    const out = createAuditSlugBase("AAAAA BBBBB CCCCC DDDDD EEEEE FFFFF GGGGG");
    expect(out.length).toBeLessThanOrEqual(32);
  });
});
