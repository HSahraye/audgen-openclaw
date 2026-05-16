import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  validateExternalUrl: vi.fn(),
}));

vi.mock("@/lib/network-safety", () => ({
  validateExternalUrl: mocks.validateExternalUrl,
}));

import { collectWebsiteSignals } from "./signals";

const originalFetch = globalThis.fetch;

function mockFetch(html: string, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    status,
    text: async () => html,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mocks.validateExternalUrl.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("collectWebsiteSignals — HTML parsing", () => {
  it("extracts the page title", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch(
      `<!DOCTYPE html><html lang="en"><head><title>Acme HVAC — Austin's Best</title></head><body></body></html>`,
    );
    const result = await collectWebsiteSignals("acme.test");
    expect(result.hasTitle).toBe(true);
    expect(result.title).toBe("Acme HVAC — Austin's Best");
  });

  it("extracts the meta description", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch(
      `<!DOCTYPE html><html><head><meta name="description" content="Austin HVAC services"></head><body></body></html>`,
    );
    const result = await collectWebsiteSignals("acme.test");
    expect(result.hasMetaDescription).toBe(true);
    expect(result.metaDescription).toBe("Austin HVAC services");
  });

  it("detects viewport meta + schema markup + accessibility lang attr", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width">
    <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
  </head>
  <body><img alt="hero shot" src="x.jpg"></body>
</html>`,
    );
    const result = await collectWebsiteSignals("acme.test");
    expect(result.hasViewportMeta).toBe(true);
    expect(result.hasSchemaMarkup).toBe(true);
    expect(result.hasAccessibilityLangAttr).toBe(true);
    expect(result.hasImageAltTextHints).toBe(true);
  });

  it("detects social proof signals", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch(
      `<html><body>
        <a href="https://facebook.com/acme">FB</a>
        <p>Read our google reviews — 5 stars</p>
        <p>Licensed, insured, and BBB certified.</p>
      </body></html>`,
    );
    const result = await collectWebsiteSignals("acme.test");
    expect(result.hasSocialLinks).toBe(true);
    expect(result.hasReviewSignals).toBe(true);
    expect(result.hasTrustBadges).toBe(true);
  });

  it("detects CTA + contact info from common phone formats", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch(
      `<html><body>
        <a href="tel:+15125550199">Call Now</a>
        <p>Book online today</p>
      </body></html>`,
    );
    const result = await collectWebsiteSignals("acme.test");
    expect(result.hasPhonePattern).toBe(true);
    expect(result.hasContactInfo).toBe(true);
    expect(result.hasCta).toBe(true);
    expect(result.hasBookingLanguage).toBe(true);
  });

  it("scores performance hint by bodySize tiers", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    // Small body → good
    mockFetch(`<html><body>small</body></html>`);
    expect((await collectWebsiteSignals("acme.test")).performanceHint).toBe(
      "good",
    );

    // Medium body → moderate (>= 35000, < 120000)
    mockFetch(`<html><body>${"x".repeat(40_000)}</body></html>`);
    expect((await collectWebsiteSignals("acme.test")).performanceHint).toBe(
      "moderate",
    );

    // Large body → poor (>= 120000)
    mockFetch(`<html><body>${"x".repeat(125_000)}</body></html>`);
    expect((await collectWebsiteSignals("acme.test")).performanceHint).toBe(
      "poor",
    );
  });

  it("flags fetch warning when validateExternalUrl rejects (e.g. internal IP)", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: false,
      reason: "private-ip",
    });
    const result = await collectWebsiteSignals("http://10.0.0.1");
    expect(result.fetchWarnings.length).toBeGreaterThan(0);
    expect(result.fetchWarnings[0]).toContain("Website fetch skipped");
    expect(result.html).toBe("");
  });

  it("captures fetch errors as warnings (no throw)", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as unknown as typeof fetch;
    const result = await collectWebsiteSignals("acme.test");
    expect(result.fetchWarnings.length).toBeGreaterThan(0);
    expect(result.fetchWarnings[0]).toContain("Could not fetch");
  });

  it("HTTPS detection reflects the normalized URL scheme", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "https://acme.test",
    });
    mockFetch("<html></html>");
    const result = await collectWebsiteSignals("acme.test");
    // normalizeUrl prepends https:// for bare hosts
    expect(result.hasHttps).toBe(true);
  });

  it("HTTP-only URL is flagged as hasHttps=false", async () => {
    mocks.validateExternalUrl.mockResolvedValue({
      ok: true,
      url: "http://acme.test",
    });
    mockFetch("<html></html>");
    const result = await collectWebsiteSignals("http://acme.test");
    expect(result.hasHttps).toBe(false);
  });
});
