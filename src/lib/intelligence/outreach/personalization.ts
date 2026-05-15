/**
 * Outreach personalization validator.
 *
 * Every outreach prep piece (pitch, sequence message, post-call email)
 * must include all four of the following before it can be sent:
 *
 *   1. AUDIT-SPECIFIC ISSUE  \u2014 cite which audit check failed
 *      (e.g. "mobileFriendly", "clearCta", "reviewsVisible").
 *   2. BUSINESS-SPECIFIC DETAIL \u2014 the business name, their service,
 *      a phrase from their own site copy, the owner's name, or city.
 *   3. LOCAL / REVIEW / SEARCH / COMPETITOR SIGNAL \u2014 review count,
 *      Google rank, competitor density, "near you" phrasing.
 *   4. CLEAR NEXT ACTION \u2014 a time-bound CTA (book a call, reply by X,
 *      open the audit link, etc.).
 *
 * If any of the four is missing the prep is generic and reads like spam.
 * We refuse to mark it ready until all four are present.
 *
 * The validator is intentionally lenient and heuristic: it looks for
 * patterns that indicate each signal is present, not exact phrases. The
 * goal is to catch the worst offenders (pure template paste), not to
 * grade the copy.
 */

export type PersonalizationSignal =
  | "AUDIT_SPECIFIC_ISSUE"
  | "BUSINESS_SPECIFIC_DETAIL"
  | "LOCAL_OR_COMPETITOR_SIGNAL"
  | "CLEAR_NEXT_ACTION";

export type ValidationContext = {
  /** The full text of the prep piece being validated. */
  text: string;
  /** Business name, e.g. "420 Smoke Shop". */
  businessName?: string | null;
  /** City / neighborhood / metro, e.g. "Santa Clara". */
  location?: string | null;
  /** Owner name, e.g. "Maria". */
  ownerName?: string | null;
  /** Service / category, e.g. "smoke shop", "dental practice". */
  category?: string | null;
  /** Audit check keys that failed (e.g. ["mobileFriendly","reviewsVisible"]). */
  failedAuditChecks?: string[] | null;
  /** Any reviews / rank / competitor signals we believe to be true. */
  signals?: {
    reviewCount?: number | null;
    averageRating?: number | null;
    googleRank?: number | null;
    competitorCount?: number | null;
  } | null;
};

export type PersonalizationReport = {
  ok: boolean;
  missing: PersonalizationSignal[];
  found: PersonalizationSignal[];
  notes: string[]; // human-readable reasons per signal
};

const AUDIT_KEYWORDS: Record<string, string[]> = {
  mobileFriendly: ["mobile", "phone-friendly", "responsive", "smartphone"],
  clearCta: ["call to action", "cta", "clear call", "click to call"],
  phoneEasyToFind: ["phone number", "hard to find", "buried", "visible phone"],
  reviewsVisible: ["review", "reviews", "testimonial", "rating", "stars"],
  onlineBooking: ["booking", "book online", "schedule", "appointment"],
  trustSection: ["trust", "credibility", "social proof"],
  gallery: ["gallery", "photos", "portfolio", "before / after", "before and after"],
  serviceList: ["service list", "services listed", "menu"],
  pricing: ["pricing", "prices shown", "price list"],
  faq: ["faq", "frequently asked"],
};

const NEXT_ACTION_HINTS = [
  /\b(book|schedule|grab|reserve|claim)\s+(a\s+)?(call|demo|slot|time|appointment)\b/i,
  /\b(reply|respond)\s+(by|before|to)\b/i,
  /\b(click|tap|open)\s+(the\s+)?(audit|link|report)\b/i,
  /\b(call|text|sms)\s+(me|us)\b/i,
  /\b15[- ]?min\b/i,
  /\b30[- ]?min\b/i,
  /\bcalendly\b/i,
  /\bnext\s+step\b/i,
  /\bin the next\s+\d+\s+(hours?|days?)\b/i,
];

const LOCAL_OR_COMPETITOR_HINTS = [
  /\bnear (you|me|your|here)\b/i,
  /\bcompetitor[s]?\b/i,
  /\bgoogle\b/i,
  /\bsearch\b/i,
  /\branks?\b/i,
  /\branking\b/i,
  /\bsearches?\b/i,
  /\b\d+ reviews?\b/i,
  /\b\d+(\.\d+)?\s*(star|stars)\b/i,
  /\blocal (business|search|market)\b/i,
  /\bin (downtown|north|south|east|west)\b/i,
];

function containsAuditIssue(ctx: ValidationContext): boolean {
  const text = ctx.text.toLowerCase();
  // Direct match against the audit check id (e.g. "mobileFriendly")
  for (const k of ctx.failedAuditChecks ?? []) {
    if (text.includes(k.toLowerCase())) return true;
    const kws = AUDIT_KEYWORDS[k] || [];
    if (kws.some((kw) => text.includes(kw))) return true;
  }
  // Otherwise: at least one general audit keyword from any category.
  for (const kws of Object.values(AUDIT_KEYWORDS)) {
    if (kws.some((kw) => text.includes(kw))) return true;
  }
  return false;
}

function containsBusinessDetail(ctx: ValidationContext): boolean {
  const text = ctx.text.toLowerCase();
  if (ctx.businessName && text.includes(ctx.businessName.toLowerCase())) return true;
  if (ctx.ownerName && text.includes(ctx.ownerName.toLowerCase())) return true;
  // Category alone is too generic ("smoke shop" is a category, not specific
  // to this lead). We require business name OR owner name to be safe.
  return false;
}

function containsLocalOrCompetitorSignal(ctx: ValidationContext): boolean {
  const text = ctx.text.toLowerCase();
  if (ctx.location && text.includes(ctx.location.toLowerCase())) return true;
  if (typeof ctx.signals?.reviewCount === "number" && ctx.signals.reviewCount > 0) {
    if (text.includes("review") || /\d+\s*review/.test(text)) return true;
  }
  if (typeof ctx.signals?.googleRank === "number") {
    if (text.includes("rank") || text.includes("google")) return true;
  }
  if (typeof ctx.signals?.competitorCount === "number" && ctx.signals.competitorCount > 0) {
    if (text.includes("competitor")) return true;
  }
  return LOCAL_OR_COMPETITOR_HINTS.some((re) => re.test(ctx.text));
}

function containsClearNextAction(ctx: ValidationContext): boolean {
  return NEXT_ACTION_HINTS.some((re) => re.test(ctx.text));
}

export function validatePersonalization(ctx: ValidationContext): PersonalizationReport {
  if (!ctx || typeof ctx.text !== "string" || ctx.text.trim().length === 0) {
    return {
      ok: false,
      missing: [
        "AUDIT_SPECIFIC_ISSUE",
        "BUSINESS_SPECIFIC_DETAIL",
        "LOCAL_OR_COMPETITOR_SIGNAL",
        "CLEAR_NEXT_ACTION",
      ],
      found: [],
      notes: ["Empty outreach text."],
    };
  }

  const checks: Array<{ key: PersonalizationSignal; ok: boolean; note: string }> = [
    {
      key: "AUDIT_SPECIFIC_ISSUE",
      ok: containsAuditIssue(ctx),
      note: "Mention a real audit finding (e.g. mobile, CTA, reviews, booking).",
    },
    {
      key: "BUSINESS_SPECIFIC_DETAIL",
      ok: containsBusinessDetail(ctx),
      note: "Mention the business name or the owner's name so it isn't generic.",
    },
    {
      key: "LOCAL_OR_COMPETITOR_SIGNAL",
      ok: containsLocalOrCompetitorSignal(ctx),
      note: "Reference the city, review count, search rank, or competitor density.",
    },
    {
      key: "CLEAR_NEXT_ACTION",
      ok: containsClearNextAction(ctx),
      note: "End with a clear next step: book a call, reply by X, open the audit link.",
    },
  ];

  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  const found = checks.filter((c) => c.ok).map((c) => c.key);
  const notes = checks.filter((c) => !c.ok).map((c) => c.note);

  return { ok: missing.length === 0, missing, found, notes };
}

/**
 * Tiny convenience for callers that only need a yes/no.
 */
export function isOutreachPersonalized(ctx: ValidationContext): boolean {
  return validatePersonalization(ctx).ok;
}
