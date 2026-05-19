import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrapeBusinessWebsite, _resetScrapeCacheForTests } from "./scrape-website";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
  _resetScrapeCacheForTests();
});

afterEach(() => {
  fetchSpy.mockReset();
});

// Duck-typed mock — only the properties the scraper reads.
// `Response.url` is a read-only getter on the real class, so we
// can't `Object.assign` past it; the scraper's interface is small
// enough that a plain object works fine.
function htmlResponse(html: string, finalUrl = "https://example.com/"): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const mock = {
    ok: true,
    status: 200,
    statusText: "OK",
    url: finalUrl,
    body: stream,
    text: async () => html,
  };
  return mock as unknown as Response;
}

describe("scrapeBusinessWebsite", () => {
  it("returns empty result with fetched=false when URL is missing", async () => {
    const r = await scrapeBusinessWebsite("");
    expect(r.fetched).toBe(false);
    expect(r.fetchError).toBe("missing-url");
    expect(r.signals.imageCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid-url-scheme for non-http URLs", async () => {
    const r = await scrapeBusinessWebsite("ftp://example.com");
    expect(r.fetchError).toBe("invalid-url-scheme");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("extracts signals from a typical HVAC homepage", async () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width">
      <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
    </head><body>
      <h1>Acme HVAC</h1>
      <a href="tel:+14085551212">Call us</a>
      <p>24/7 emergency service available. Financing through Synchrony.</p>
      <p>Service area: San Jose, Cupertino, Sunnyvale.</p>
      <p>NATE-certified technicians. BBB Rated A+.</p>
      <p>Online booking: book now</p>
      <img src="/photo1.jpg"><img src="/photo2.jpg"><img src="/photo3.jpg">
      <h2>FAQ</h2>
      <h2>Pricing</h2><p>Starting at $99 per service call.</p>
    </body></html>`;
    fetchSpy.mockResolvedValueOnce(htmlResponse(html, "https://acmehvac.example/"));
    const r = await scrapeBusinessWebsite("https://acmehvac.example/");
    expect(r.fetched).toBe(true);
    expect(r.fetchError).toBeNull();
    expect(r.signals.hasEmergencyPhone).toBe(true);
    expect(r.signals.hasFinancing).toBe(true);
    expect(r.signals.hasServiceArea).toBe(true);
    expect(r.signals.hasTrustBadges).toBe(true);
    expect(r.signals.hasFAQ).toBe(true);
    expect(r.signals.hasPricingSection).toBe(true);
    expect(r.signals.hasMobileViewport).toBe(true);
    expect(r.signals.hasSchemaMarkup).toBe(true);
    expect(r.signals.imageCount).toBeGreaterThanOrEqual(3);
    expect(r.signals.phoneLinkCount).toBeGreaterThanOrEqual(1);
    expect(r.homepageText.toLowerCase()).toContain("emergency service");
  });

  it("returns false signals when site lacks them (negative case)", async () => {
    const html = `<html><head></head><body><h1>Just a static site</h1><p>Contact us</p></body></html>`;
    fetchSpy.mockResolvedValueOnce(htmlResponse(html, "https://blank.example/"));
    const r = await scrapeBusinessWebsite("https://blank.example/");
    expect(r.fetched).toBe(true);
    expect(r.signals.hasEmergencyPhone).toBe(false);
    expect(r.signals.hasFinancing).toBe(false);
    expect(r.signals.hasMobileViewport).toBe(false);
    expect(r.signals.hasSchemaMarkup).toBe(false);
  });

  it("caches results by hostname so the second fetch is a no-op", async () => {
    const html = `<html><body><h1>Cached site</h1></body></html>`;
    fetchSpy.mockResolvedValueOnce(htmlResponse(html, "https://cached.example/"));
    const r1 = await scrapeBusinessWebsite("https://cached.example/");
    expect(r1.fetched).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Second call to a different path on the same hostname → cache hit.
    const r2 = await scrapeBusinessWebsite("https://cached.example/about");
    expect(r2.fetched).toBe(true);
    expect(r2.url).toBe("https://cached.example/"); // cached entry's url
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no second fetch
  });

  it("returns fetch-error result (without throwing) when fetch rejects", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"));
    const r = await scrapeBusinessWebsite("https://broken.example/");
    expect(r.fetched).toBe(false);
    expect(r.fetchError).toContain("network");
    // signals are still empty/default — no crash for the caller.
    expect(r.signals.hasEmergencyPhone).toBe(false);
  });

  it("returns fetch-timeout when AbortError fires", async () => {
    fetchSpy.mockImplementationOnce(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const r = await scrapeBusinessWebsite("https://slow.example/");
    expect(r.fetchError).toBe("fetch-timeout");
  });
});
