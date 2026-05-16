import type { AuditChecks, AuditInput } from "./types";

/**
 * Pure scoring helpers extracted from audit-engine.ts so they can be unit
 * tested without standing up the full generation pipeline (which involves
 * billing entitlements, lead intelligence, AI providers, etc).
 *
 * Behavior is intentionally identical to the original inline helpers —
 * if anything in here needs to change, update both the implementation
 * and the test cases in audit-scoring.test.ts in lockstep.
 */

/**
 * Score a lead from 1-100. Higher score = more pain points and therefore
 * more upside if we close them. The baseline 55 represents an "average"
 * local business; missing critical surfaces (website, mobile, CTA) bumps
 * the score quickly. Capped at [1, 100].
 */
export function scoreLead(checks: AuditChecks, input: AuditInput): number {
  let score = 55;
  if (!checks.hasWebsite) score += 25;
  if (checks.outdatedWebsite) score += 14;
  if (!checks.mobileFriendly) score += 10;
  if (!checks.clearCta) score += 10;
  if (!checks.phoneEasyToFind) score += 8;
  if (!checks.reviewsVisible) score += 6;
  if (!checks.onlineBooking) score += 7;
  if (!checks.gallery) score += 4;
  if (!checks.serviceList) score += 4;
  if (!checks.trustSection) score += 4;
  if (!checks.pricing) score += 3;
  if (!checks.faq) score += 2;
  if (input.googleProfileUrl?.trim()) score += 3;
  return Math.max(1, Math.min(100, score));
}

const DEFAULT_LAUNCH = "Presence Labs Launch Package";
const DEFAULT_CONVERSION = "Presence Labs Conversion Upgrade";
const DEFAULT_TRUST = "Presence Labs Local Trust Tune-Up";

/**
 * Pick the recommended package name based on score + checks.
 *
 *  - No website OR score >= 86 → Launch (full rebuild)
 *  - Score >= 72              → Conversion Upgrade (improve existing)
 *  - Otherwise                → Local Trust Tune-Up (low-touch polish)
 *
 * `packageLabels` lets a workspace override the customer-visible names
 * (e.g. agencies white-labeling). The conditional structure stays
 * identical regardless.
 */
export function packageName(
  score: number,
  checks: AuditChecks,
  packageLabels?: Record<string, string>,
): string {
  if (!packageLabels) {
    if (!checks.hasWebsite || score >= 86) return DEFAULT_LAUNCH;
    if (score >= 72) return DEFAULT_CONVERSION;
    return DEFAULT_TRUST;
  }
  if (!checks.hasWebsite || score >= 86) return packageLabels.launch || DEFAULT_LAUNCH;
  if (score >= 72) return packageLabels.conversion || DEFAULT_CONVERSION;
  return packageLabels.trust || DEFAULT_TRUST;
}

/**
 * Rough vertical-based estimate of annual revenue leakage for a lead's
 * business category. Used for the "likely money lost" framing on audits.
 * Match is regex on the lowercased category string; the first hit wins.
 */
export function estimateAnnualLoss(category: string): number {
  const lower = (category || "").toLowerCase();
  if (/restaurant|food/.test(lower)) return 20_000;
  if (/contractor|roof|plumb|electric|hvac|home/.test(lower)) return 15_000;
  if (/mechanic|auto|repair/.test(lower)) return 12_000;
  if (/landscap|lawn/.test(lower)) return 10_000;
  if (/clean/.test(lower)) return 8_000;
  if (/detail/.test(lower)) return 5_000;
  if (/barber|salon/.test(lower)) return 4_000;
  return 7_500;
}
