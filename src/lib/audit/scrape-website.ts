// Lightweight, dependency-free website scraper for audit generation.
//
// Design constraints:
//   - NO new deps (cheerio, puppeteer, etc.). The signals we extract
//     are coarse-grained (presence/absence keywords + element counts)
//     and don't need a full DOM parser.
//   - Single fetch per URL, 8-second timeout, never throws.
//   - In-process LRU cache by hostname (24h TTL). Cleared per-process
//     restart; no DB writes (the schema doesn't have a cache table).
//   - Returns the same shape on success and failure so the caller
//     never has to null-check signal fields.
//
// What we extract (good enough for the LLM to ground findings):
//   - Plain-text excerpts of homepage / about / contact
//   - Boolean signals derived from regex over the raw HTML +
//     stripped text (emergency phone, financing, booking widget,
//     review embed, photos, service area, schema.org, mobile meta)
//   - Coarse load-time + final URL after redirects

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_500_000; // 1.5 MB, plenty for a marketing site
const USER_AGENT = "AuditGen-LeadAudit/1.0 (+https://salegen.org/about; respects robots)";

export type WebsiteScrapeResult = {
  url: string;
  finalUrl: string | null;
  fetched: boolean;
  fetchError: string | null;
  loadTimeMs: number;
  homepageText: string;
  aboutText: string;
  contactText: string;
  signals: {
    hasEmergencyPhone: boolean;
    hasFinancing: boolean;
    hasBookingWidget: boolean;
    hasReviewsEmbedded: boolean;
    hasPhotosGallery: boolean;
    hasServiceArea: boolean;
    hasSchemaMarkup: boolean;
    hasMobileViewport: boolean;
    hasFAQ: boolean;
    hasPricingSection: boolean;
    hasTrustBadges: boolean;
    /** Number of <img> tags. Coarse proxy for "site has photos". */
    imageCount: number;
    /** Number of href="tel:" or visible North-American phone patterns. */
    phoneLinkCount: number;
  };
};

const EMPTY_SIGNALS: WebsiteScrapeResult["signals"] = {
  hasEmergencyPhone: false,
  hasFinancing: false,
  hasBookingWidget: false,
  hasReviewsEmbedded: false,
  hasPhotosGallery: false,
  hasServiceArea: false,
  hasSchemaMarkup: false,
  hasMobileViewport: false,
  hasFAQ: false,
  hasPricingSection: false,
  hasTrustBadges: false,
  imageCount: 0,
  phoneLinkCount: 0,
};

function emptyResult(url: string, fetchError: string | null): WebsiteScrapeResult {
  return {
    url,
    finalUrl: null,
    fetched: false,
    fetchError,
    loadTimeMs: 0,
    homepageText: "",
    aboutText: "",
    contactText: "",
    signals: { ...EMPTY_SIGNALS },
  };
}

// Cache keyed by hostname (not full URL) — protects us from billing
// the same site twice when the user re-runs an audit on a different
// page of the same domain.
type CacheEntry = { value: WebsiteScrapeResult; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKeyFor(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getCached(url: string): WebsiteScrapeResult | null {
  const key = cacheKeyFor(url);
  if (!key) return null;
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(url: string, value: WebsiteScrapeResult): void {
  const key = cacheKeyFor(url);
  if (!key) return;
  if (cache.size >= CACHE_MAX) {
    // Evict the oldest entry (Map iteration order = insertion order).
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === "string") cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** EXPORTED ONLY FOR TESTS — do not call in production code. */
export function _resetScrapeCacheForTests(): void {
  cache.clear();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSignals(rawHtml: string, plainText: string): WebsiteScrapeResult["signals"] {
  const html = rawHtml.toLowerCase();
  const text = plainText.toLowerCase();

  const hasEmergencyPhone = /\b24\s*\/\s*7\b|emergency\s+(service|repair|hotline|phone|line)|after[-\s]?hours/i.test(text);
  const hasFinancing = /\bfinanc(e|ing)\b|0\s*%\s*apr|monthly\s+payment|synchrony|greensky|wells\s+fargo\s+financing|payment\s+plans?/i.test(text);
  const hasBookingWidget =
    /\b(book\s+(now|online|appointment)|schedule\s+(now|online|appointment|service)|reserve\s+a\s+table)\b/i.test(text)
    || /(zocdoc|nexhealth|opentable|resy|toast|chownow|vagaro|mindbody|glofox|booksy|glossgenius|calendly|squareup\.com\/appointments|simplybook)/i.test(html);
  const hasReviewsEmbedded =
    /yelp\.com\/biz|google\.com\/maps|trustpilot\.com|customer\s+reviews|client\s+testimonials|★+|\bratings?\b\s*(of|out)\b/i.test(text)
    || /(elfsight\.com\/widget\/google-reviews|reviewsonmywebsite|widget\.podium\.com|birdeye\.com\/widget)/i.test(html);
  const hasPhotosGallery = /\b(gallery|portfolio|before\s*[\/-]?\s*after|our\s+work|recent\s+projects?)\b/i.test(text);
  const hasServiceArea = /\b(service\s+area|areas?\s+we\s+serve|cities\s+we\s+serve|we\s+serve|coverage\s+area)\b/i.test(text);
  const hasSchemaMarkup = /<script[^>]+application\/ld\+json/i.test(rawHtml);
  const hasMobileViewport = /<meta[^>]+name=["']viewport["']/i.test(rawHtml);
  const hasFAQ = /\b(faq|frequently\s+asked\s+questions?)\b/i.test(text);
  const hasPricingSection = /\b(pricing|prices?|starting\s+at|plans?\s+\&\s+pricing|membership\s+(price|cost|tiers?))\b/i.test(text);
  const hasTrustBadges = /\b(licensed|insured|certified|nate|ase|gaf\s+master|owens\s+corning|bbb\s+(rated|accredited)|epa[-\s]certified|board[-\s]certified)\b/i.test(text);

  const imageCount = (rawHtml.match(/<img\b/gi) || []).length;
  const phoneLinkCount =
    (rawHtml.match(/href=["']tel:/gi) || []).length
    + (rawHtml.match(/\b(\(\d{3}\)\s*\d{3}[-\s]?\d{4}|\b\d{3}[-\s]\d{3}[-\s]\d{4})\b/g) || []).length;

  return {
    hasEmergencyPhone,
    hasFinancing,
    hasBookingWidget,
    hasReviewsEmbedded,
    hasPhotosGallery,
    hasServiceArea,
    hasSchemaMarkup,
    hasMobileViewport,
    hasFAQ,
    hasPricingSection,
    hasTrustBadges,
    imageCount,
    phoneLinkCount,
  };
}

function findSection(plainText: string, keyword: string, maxChars = 1200): string {
  const lower = plainText.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return "";
  return plainText.slice(idx, idx + maxChars).trim();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ status: number; body: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      const body = await response.text();
      return { status: response.status, body: body.slice(0, MAX_HTML_BYTES), finalUrl: response.url };
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.byteLength;
      if (totalBytes >= MAX_HTML_BYTES) break;
    }
    const buffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return { status: response.status, body, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape the prospect's website to extract signals the LLM audit
 * engine consumes. Returns an empty result on missing URL, malformed
 * URL, fetch failure, or timeout — never throws.
 *
 * Cached by hostname for 24h. Cache is per-process; restarts re-fetch.
 */
export async function scrapeBusinessWebsite(url: string | null | undefined): Promise<WebsiteScrapeResult> {
  if (!url || !url.trim()) return emptyResult("", "missing-url");
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return emptyResult(trimmed, "invalid-url-scheme");
  }

  const cached = getCached(trimmed);
  if (cached) return cached;

  const start = Date.now();
  try {
    const { body, finalUrl } = await fetchWithTimeout(trimmed, FETCH_TIMEOUT_MS);
    const loadTimeMs = Date.now() - start;
    const plainText = stripHtml(body);
    const result: WebsiteScrapeResult = {
      url: trimmed,
      finalUrl,
      fetched: true,
      fetchError: null,
      loadTimeMs,
      homepageText: plainText.slice(0, 4000),
      aboutText: findSection(plainText, "about", 1500),
      contactText: findSection(plainText, "contact", 1000),
      signals: detectSignals(body, plainText),
    };
    setCached(trimmed, result);
    return result;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "fetch-timeout"
          : err.message.slice(0, 120)
        : "fetch-error";
    const failure = emptyResult(trimmed, message);
    failure.loadTimeMs = Date.now() - start;
    // Cache failures too — for half the TTL — so a flaky site doesn't
    // billing-DDOS the audit pipeline. 12h is plenty for QA cycles.
    setCached(trimmed, { ...failure, fetched: false });
    return failure;
  }
}
