// Pure parsing helpers for audit-dashboard. Extracted so the test
// suite can exercise the exact same defensive code path the
// dashboard's parsedLeads useMemo runs at render time, without
// requiring a jsdom + @testing-library/react setup.
//
// Why these helpers exist:
// On 2026-05-18, the e1c8735 promotion helper wrote 3 Lead rows
// whose assetsJson lacked the 5 script fields (coldCallScript,
// textMessageScript, emailScript, thirtySecondPitch,
// followUpMessage), `proposalOutline`, and had a wrong-typed
// `likelyMoneyLost`. The dashboard's parsedLeads useMemo called
// `sanitizePublicBrandCopy(parsedAssets.coldCallScript)` directly,
// which does `.replace()` on its argument. Undefined passed in →
// TypeError → React error boundary → the entire dashboard rendered
// "SOMETHING BROKE" for every user in those workspaces.
//
// The helper below is the architectural fix: dashboard render is a
// hard isolation boundary. A single malformed Lead row MUST NOT
// crash the queue — it logs a warning and renders with empty
// placeholders. This is intentionally permissive on input shape
// (Partial<...>) so any helper that produces a Lead.assetsJson —
// promote-to-lead, createLeadAction, importLeadsCsvAction, future
// integrations — can never bring down the whole dashboard.

import { sanitizePublicBrandCopy } from "@/lib/branding";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";

const STATUSES = ["New", "Contacted", "Follow-up", "Won", "Lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

export const FALLBACK_AUDIT_CHECKS: AuditChecks = Object.freeze({
  hasWebsite: false,
  outdatedWebsite: false,
  mobileFriendly: false,
  clearCta: false,
  phoneEasyToFind: false,
  reviewsVisible: false,
  onlineBooking: false,
  trustSection: false,
  gallery: false,
  serviceList: false,
  pricing: false,
  faq: false,
});

export type DashboardLeadInput = {
  id: string;
  businessName: string;
  status: string;
  auditJson: string;
  assetsJson: string;
  intelligenceJson: string | null;
};

// Mirrors `LeadView["intelligence"]` in audit-dashboard.tsx — kept
// permissive so the helper's parse step doesn't fight the consumer's
// optional-fields shape.
export type ParsedIntelligence =
  | { momentumScore?: number; urgencyScore?: number; closeProbability?: number }
  | null
  | undefined;

export type ParsedDashboardLead = {
  status: LeadStatus;
  audit: {
    checks: AuditChecks;
    websiteSignals: string[];
    warnings: string[];
    source: string;
    aiGenerated: boolean;
    vertical: string | null;
    verticalDisplayName: string | null;
    /**
     * True when a Background Function is currently regenerating this
     * lead's audit (LLM call in flight). Cleared automatically when
     * the BG function writes the new audit, or after 5 minutes of
     * staleness if the BG function crashed without cleanup.
     */
    pending: boolean;
    /** ISO 8601 timestamp the regeneration was requested. Null when not pending. */
    requestedAt: string | null;
    [k: string]: unknown;
  };
  assets: GeneratedAssets;
  intelligence: ParsedIntelligence;
  // Diagnostic — populated when any required field was missing or
  // wrong-shape on the input. Empty array on healthy inputs.
  // Useful for tests to assert the warning surface; production
  // callers may forward to logger/console.warn.
  missingFields: string[];
};

function parseAssetsJson(input: string, leadId: string, businessName: string): {
  parsed: Partial<GeneratedAssets>;
  parseError: boolean;
} {
  try {
    return { parsed: JSON.parse(input) as Partial<GeneratedAssets>, parseError: false };
  } catch {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[audit-dashboard] lead.assetsJson is not valid JSON; rendering empty placeholders", {
        leadId,
        businessName,
      });
    }
    return { parsed: {}, parseError: true };
  }
}

type RawAuditJson = {
  checks?: Partial<AuditChecks> | null;
  websiteSignals?: unknown;
  warnings?: unknown;
  source?: unknown;
  aiGenerated?: unknown;
  vertical?: unknown;
  verticalDisplayName?: unknown;
  pending?: unknown;
  requestedAt?: unknown;
  [k: string]: unknown;
};

// Pending state TTL — must match `AUDIT_BACKGROUND_FRESHNESS_MS` in
// `src/lib/audit/audit-async.ts`. After this window, a stale pending
// marker is treated as "background function crashed" so the user can
// retry without waiting forever.
const AUDIT_PENDING_FRESHNESS_MS = 5 * 60 * 1000;

function parseAuditJson(input: string, leadId: string, businessName: string): {
  parsed: RawAuditJson;
  parseError: boolean;
} {
  try {
    return { parsed: JSON.parse(input) as RawAuditJson, parseError: false };
  } catch {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[audit-dashboard] lead.auditJson is not valid JSON; rendering empty audit", {
        leadId,
        businessName,
      });
    }
    return { parsed: {}, parseError: true };
  }
}

function detectMissing(parsedAssets: Partial<GeneratedAssets>, parsedAudit: RawAuditJson): string[] {
  const missing: string[] = [];
  if (typeof parsedAssets.coldCallScript !== "string") missing.push("assets.coldCallScript");
  if (typeof parsedAssets.textMessageScript !== "string") missing.push("assets.textMessageScript");
  if (typeof parsedAssets.emailScript !== "string") missing.push("assets.emailScript");
  if (typeof parsedAssets.thirtySecondPitch !== "string") missing.push("assets.thirtySecondPitch");
  if (typeof parsedAssets.followUpMessage !== "string") missing.push("assets.followUpMessage");
  if (!Array.isArray(parsedAssets.proposalOutline)) missing.push("assets.proposalOutline");
  if (typeof parsedAssets.likelyMoneyLost !== "string") missing.push("assets.likelyMoneyLost");
  if (typeof parsedAudit.checks !== "object" || parsedAudit.checks === null) missing.push("audit.checks");
  if (!Array.isArray(parsedAudit.websiteSignals)) missing.push("audit.websiteSignals");
  if (!Array.isArray(parsedAudit.warnings)) missing.push("audit.warnings");
  return missing;
}

/**
 * Parse a single Lead row's JSON blobs into the shape the dashboard
 * UI consumes, defending against missing / wrong-typed fields. Logs
 * a single structured `[audit-dashboard]` warning per malformed lead.
 *
 * - `coldCallScript`/`textMessageScript`/`emailScript`/`thirtySecondPitch`/
 *   `followUpMessage`: coalesced to "" before passing through
 *   `sanitizePublicBrandCopy`. The sanitizer does `.replace()` on its
 *   argument; undefined would crash render.
 * - `proposalOutline`: defaults to `[]` so `.map()` cannot crash.
 * - `likelyMoneyLost`: coerced to "" if not a string (the e1c8735 stub
 *   used `number | null`, which would render an unexpected `[object]`).
 * - `audit.checks`: defaults to a full AuditChecks shape with all 12
 *   booleans set to `false` so each `<CheckItem>` renders an honest
 *   "missing" badge rather than crashing on `undefined`.
 * - `audit.websiteSignals` / `audit.warnings`: default to `[]`.
 * - `audit.source`: defaults to "unknown".
 */
export function parseLeadForDashboard(lead: DashboardLeadInput): ParsedDashboardLead {
  const { parsed: parsedAssets } = parseAssetsJson(lead.assetsJson, lead.id, lead.businessName);
  const { parsed: parsedAudit } = parseAuditJson(lead.auditJson, lead.id, lead.businessName);

  const missingFields = detectMissing(parsedAssets, parsedAudit);
  if (missingFields.length > 0 && typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn("[audit-dashboard] lead has malformed/missing required fields; rendering with placeholders", {
      leadId: lead.id,
      businessName: lead.businessName,
      missingFields,
    });
  }

  const status: LeadStatus = (STATUSES as readonly string[]).includes(lead.status)
    ? (lead.status as LeadStatus)
    : "New";

  // Pending state. Only treat as pending when (a) the marker is
  // literally true, AND (b) requestedAt parses as a recent timestamp.
  // Stale markers (older than the freshness window) are coerced to
  // pending=false so a crashed background function doesn't lock the
  // user out of retrying forever.
  const requestedAtRaw =
    typeof parsedAudit.requestedAt === "string" ? parsedAudit.requestedAt : null;
  const requestedAtMs = requestedAtRaw ? Date.parse(requestedAtRaw) : NaN;
  const pendingFresh =
    parsedAudit.pending === true
    && Number.isFinite(requestedAtMs)
    && Date.now() - requestedAtMs < AUDIT_PENDING_FRESHNESS_MS;

  const audit = {
    ...parsedAudit,
    checks: { ...FALLBACK_AUDIT_CHECKS, ...(parsedAudit.checks ?? {}) } as AuditChecks,
    websiteSignals: Array.isArray(parsedAudit.websiteSignals)
      ? (parsedAudit.websiteSignals as string[])
      : [],
    warnings: Array.isArray(parsedAudit.warnings) ? (parsedAudit.warnings as string[]) : [],
    source: typeof parsedAudit.source === "string" ? parsedAudit.source : "unknown",
    aiGenerated: typeof parsedAudit.aiGenerated === "boolean" ? parsedAudit.aiGenerated : false,
    vertical: typeof parsedAudit.vertical === "string" ? parsedAudit.vertical : null,
    verticalDisplayName:
      typeof parsedAudit.verticalDisplayName === "string" ? parsedAudit.verticalDisplayName : null,
    pending: pendingFresh,
    requestedAt: pendingFresh ? requestedAtRaw : null,
  };

  const assets: GeneratedAssets = {
    ...(parsedAssets as GeneratedAssets),
    coldCallScript: sanitizePublicBrandCopy(parsedAssets.coldCallScript ?? ""),
    textMessageScript: sanitizePublicBrandCopy(parsedAssets.textMessageScript ?? ""),
    emailScript: sanitizePublicBrandCopy(parsedAssets.emailScript ?? ""),
    thirtySecondPitch: sanitizePublicBrandCopy(parsedAssets.thirtySecondPitch ?? ""),
    followUpMessage: sanitizePublicBrandCopy(parsedAssets.followUpMessage ?? ""),
    proposalOutline: Array.isArray(parsedAssets.proposalOutline)
      ? (parsedAssets.proposalOutline as string[])
      : [],
    likelyMoneyLost:
      typeof parsedAssets.likelyMoneyLost === "string" ? parsedAssets.likelyMoneyLost : "",
    // The remaining required GeneratedAssets fields (leadScore,
    // painPointSummary, recommendedPackage, presenceLabsOffer) are
    // already present in the parsedAssets spread or filled with the
    // type's `undefined` (which downstream code null-coalesces). We
    // do NOT fabricate values for them — that would mask a bug rather
    // than just survive it.
    leadScore: typeof parsedAssets.leadScore === "number" ? parsedAssets.leadScore : 0,
    painPointSummary:
      typeof parsedAssets.painPointSummary === "string" ? parsedAssets.painPointSummary : "",
    recommendedPackage:
      typeof parsedAssets.recommendedPackage === "string" ? parsedAssets.recommendedPackage : "",
    presenceLabsOffer:
      typeof parsedAssets.presenceLabsOffer === "string" ? parsedAssets.presenceLabsOffer : "",
  };

  let intelligence: ParsedIntelligence = null;
  if (lead.intelligenceJson) {
    try {
      intelligence = JSON.parse(lead.intelligenceJson) as ParsedIntelligence;
    } catch {
      intelligence = null;
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("[audit-dashboard] lead.intelligenceJson is not valid JSON; rendering null intelligence", {
          leadId: lead.id,
          businessName: lead.businessName,
        });
      }
    }
  }

  return {
    status,
    audit,
    assets,
    intelligence,
    missingFields,
  };
}
