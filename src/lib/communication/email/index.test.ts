import { describe, it, expect } from "vitest";
import { _internalForTesting } from "./index";

const { safeHttpUrl, escapeHtml, unsubscribeBlock } = _internalForTesting;

describe("safeHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(safeHttpUrl("https://example.com/unsub?token=abc")).toBe(
      "https://example.com/unsub?token=abc",
    );
    expect(safeHttpUrl("http://localhost:3000/")).toBe("http://localhost:3000/");
  });

  it("rejects javascript: URLs (XSS vector)", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBe(null);
    expect(safeHttpUrl("JavaScript:alert(1)")).toBe(null);
  });

  it("rejects data: and other non-http schemes", () => {
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(null);
    expect(safeHttpUrl("file:///etc/passwd")).toBe(null);
    expect(safeHttpUrl("mailto:x@y.com")).toBe(null);
    expect(safeHttpUrl("ftp://example.com/")).toBe(null);
  });

  it("rejects malformed URLs and empty input", () => {
    expect(safeHttpUrl(undefined)).toBe(null);
    expect(safeHttpUrl("")).toBe(null);
    expect(safeHttpUrl("not a url")).toBe(null);
    expect(safeHttpUrl('"><script>alert(1)</script>')).toBe(null);
  });
});

describe("escapeHtml", () => {
  it("escapes the five canonical characters", () => {
    expect(escapeHtml('&<>"\'')).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("passes plain text through unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes amp first to avoid double-escaping", () => {
    expect(escapeHtml("A&B>C")).toBe("A&amp;B&gt;C");
  });
});

describe("unsubscribeBlock", () => {
  it("returns empty string for missing or invalid URLs", () => {
    expect(unsubscribeBlock(undefined)).toBe("");
    expect(unsubscribeBlock("")).toBe("");
    expect(unsubscribeBlock("javascript:alert(1)")).toBe("");
    expect(unsubscribeBlock("not-a-url")).toBe("");
  });

  it("returns a valid <a> block for safe URLs", () => {
    const out = unsubscribeBlock("https://app.example.com/unsub?token=abc");
    expect(out).toBe(
      '<br/><br/><a href="https://app.example.com/unsub?token=abc">Unsubscribe</a>',
    );
  });

  it("escapes XSS attempts that survive URL parsing", () => {
    // A URL like https://a.test/"><script>alert(1)</script> isn't a valid URL,
    // so the safeHttpUrl path will reject it. But if someone passes a URL
    // whose path contains injected characters that DO parse, escapeHtml
    // ensures they're neutralised in the attribute.
    const sneaky = "https://a.test/" + encodeURIComponent('"><script>');
    const out = unsubscribeBlock(sneaky);
    expect(out).toContain("href=");
    expect(out).not.toContain('"><script>');
    expect(out).toContain("%22%3E%3Cscript%3E");
  });
});
