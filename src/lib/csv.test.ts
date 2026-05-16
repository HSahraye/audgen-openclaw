import { describe, it, expect } from "vitest";
import { parseCsv, csvEscape, toCsv, normalizeHeader, pick } from "./csv";

describe("normalizeHeader", () => {
  it("lowercases, trims, and collapses non-alphanum runs to single spaces", () => {
    expect(normalizeHeader(" Business Name ")).toBe("business name");
    expect(normalizeHeader("Website-URL")).toBe("website url");
    expect(normalizeHeader("Industry / Category")).toBe("industry category");
    expect(normalizeHeader("  Phone__#  ")).toBe("phone");
  });
});

describe("parseCsv", () => {
  it("returns [] for empty or header-only input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("name,email")).toEqual([]);
  });

  it("parses a simple two-row CSV with header normalization", () => {
    const got = parseCsv(
      "Business Name,Website URL,Email\nAcme HVAC,https://acme.test,owner@acme.test\nBee Plumbing,https://bee.test,info@bee.test",
    );
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({
      "business name": "Acme HVAC",
      "website url": "https://acme.test",
      email: "owner@acme.test",
    });
    expect(got[1]["business name"]).toBe("Bee Plumbing");
  });

  it("handles CRLF line endings", () => {
    const got = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(got).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("respects quoted fields containing commas and newlines", () => {
    const got = parseCsv(
      'name,note\n"Acme, Inc.","line one\nline two"\nBee,plain',
    );
    expect(got[0]).toEqual({ name: "Acme, Inc.", note: "line one\nline two" });
    expect(got[1]).toEqual({ name: "Bee", note: "plain" });
  });

  it("supports doubled quotes inside quoted fields", () => {
    const got = parseCsv('name,quote\nAcme,"She said ""hi"""');
    expect(got[0].quote).toBe('She said "hi"');
  });

  it("skips fully blank rows", () => {
    const got = parseCsv("a,b\n1,2\n\n,\n3,4\n");
    expect(got).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("backfills missing trailing columns as empty strings", () => {
    const got = parseCsv("a,b,c\n1,2");
    expect(got[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("csvEscape + toCsv", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape("hello, world")).toBe('"hello, world"');
    expect(csvEscape('a "b" c')).toBe('"a ""b"" c"');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });

  it("treats null/undefined as empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("toCsv preserves header order and quotes when needed", () => {
    const out = toCsv(
      [
        { name: "Acme, Inc.", email: "a@b.co" },
        { name: "Bee", email: "" },
      ],
      ["name", "email"],
    );
    expect(out).toBe('name,email\n"Acme, Inc.",a@b.co\nBee,');
  });
});

describe("pick", () => {
  it("returns the first alias hit (after header normalization)", () => {
    const row = { "business name": "Acme", company: "" };
    expect(pick(row, ["company", "Business Name", "name"])).toBe("Acme");
  });

  it("trims whitespace-only values and falls through", () => {
    const row = { website: "   ", url: "https://acme.test" };
    expect(pick(row, ["Website", "URL"])).toBe("https://acme.test");
  });

  it("returns empty string when no alias matches", () => {
    expect(pick({ a: "1" }, ["b", "c"])).toBe("");
  });

  it("alias matching is case/space/punctuation insensitive", () => {
    const row = { "industry category": "HVAC" };
    expect(pick(row, ["Industry / Category"])).toBe("HVAC");
  });
});

describe("parseCsv ↔ toCsv round-trip", () => {
  it("survives a round trip on typical lead data", () => {
    const original = [
      { name: "Acme, Inc.", website: "https://acme.test", note: 'tags: "vip", hot' },
      { name: "Bee", website: "", note: "" },
    ];
    const csv = toCsv(original, ["name", "website", "note"]);
    const parsed = parseCsv(csv);
    // normalizeHeader collapses to lowercase single words; our keys already are
    expect(parsed).toEqual(original);
  });
});
