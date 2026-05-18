// NOTE: this module is intentionally NOT a "use server" file. Next.js's
// strict server-actions compiler refuses to load a "use server" module
// that exports anything other than async functions (the same constraint
// that triggered commit 980969b for leadFormSchema). The
// AddSelectedLeadgenResult type, AddLeadgenSkipReason union, and the
// pure `selectAddSelectedBanner` helper must therefore live outside
// `src/app/actions/leadgen.ts` so they can be safely re-exported from
// the client-side LeadGenCommandCenter component.

/**
 * Outcome of `addSelectedLeadgenToAudgenAction`. The UI uses this to
 * render a banner whose color and copy reflect what really happened —
 * clean success, partial success (some leads skipped for a typed
 * reason), or zero-success failure. Previously the action returned the
 * *redundant* `bulkUpdateLeadgenStatus` count which was 0 in the legacy
 * persistence fallback (researchQueueItem path) because that helper
 * indexes rows by cuid while sandbox-discovered leads carry a synthetic
 * discovery-side id, producing the silent "Added 0 lead(s)" UX bug.
 */
export type AddLeadgenSkipReason =
  | "none"
  | "cross_workspace"
  | "invalid_input"
  /**
   * The opportunity passed cross-workspace + validity checks and was
   * persisted in LeadgenOpportunity, but the dashboard-pipeline Lead
   * row failed to materialise (e.g. unique-constraint race, transient
   * DB error). The user-facing count reflects how many leads are
   * actually visible in the dashboard queue, not how many made it to
   * the LeadgenOpportunity table — that's the observation that matches
   * the user's mental model when they click "Add Selected to Audgen".
   */
  | "lead_promotion_failed";

export type AddSelectedLeadgenResult = {
  ok: boolean;
  added: number;
  skipped: number;
  total: number;
  reason: AddLeadgenSkipReason;
  message: string;
};

export type AddSelectedBannerChannel = "info" | "warning" | "error";

/**
 * Pure helper used by the UI banner to pick a channel (and color) from
 * the typed action result. Lives next to the action's typed result so
 * production code and tests can import a single source of truth.
 *   - clean success           → "info"   (sky)
 *   - partial / typed-skip    → "warning" (amber)
 *   - zero-added / failure    → "error"  (rose)
 */
export function selectAddSelectedBanner(result: AddSelectedLeadgenResult): AddSelectedBannerChannel {
  if (result.added > 0 && result.skipped === 0) return "info";
  if (result.added > 0 && result.skipped > 0) return "warning";
  return "error";
}
