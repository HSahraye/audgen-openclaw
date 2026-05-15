/**
 * Vertical pack schema.
 *
 * A vertical pack bundles everything AuditGen knows about a specific
 * local-business category: audit checks tuned to that vertical, scoring
 * weight overrides, pricing benchmarks, and template hints for outreach
 * and proposals. Each pack is self-contained TypeScript today; when
 * verticals become a paid add-on (Phase 7) the pack contents move to
 * the DB so they can be edited per workspace.
 *
 * Design constraints:
 *  - Pure data. No DB calls inside a pack file.
 *  - Slugs are lowercased, kebab-cased, stable identifiers.
 *  - Pricing in dollars (not cents) for human-readable working draft.
 *  - Every pack must declare which audit checks matter for the vertical
 *    so the personalization validator can flag a missing real signal.
 */

export type VerticalSlug = string;

export type VerticalPack = {
  slug: VerticalSlug;
  /** Human label, e.g. "Dental practices". */
  name: string;
  /** Short description shown on the picker. */
  description: string;
  /** Common business categories that should auto-match this pack. */
  matchCategories: string[];
  /**
   * Audit checks (keys from src/lib/types.ts AuditChecks) that matter
   * most for this vertical. Used by the personalization validator to
   * ensure outreach copy actually cites a check that's relevant.
   */
  criticalAuditChecks: string[];
  /**
   * Scoring weight overrides. Each key matches a top-level score from
   * src/lib/intelligence/types.ts LeadIntelligence.scores. Values are
   * multiplicative weights; 1.0 = no change.
   */
  scoringWeightOverrides: Partial<Record<
    "seo" | "performance" | "trust" | "conversion" | "accessibility" | "branding",
    number
  >>;
  /** Pricing benchmarks in USD. */
  pricing: {
    starterPackageUsd: number;
    standardPackageUsd: number;
    premiumPackageUsd: number;
    /** Typical close cycle in days; informs the daily-brief 'stale' thresholds. */
    typicalCycleDays: number;
  };
  /**
   * Outreach hints. Short snippets and angle prompts that downstream
   * generators can splice into prep copy. Each hint should contain a
   * real-world specific signal (review count, mobile experience, etc.)
   * rather than a generic 'grow your business' phrase.
   */
  outreachHints: {
    openingAngles: string[];
    painPoints: string[];
    objectionResponses: Array<{ objection: string; response: string }>;
    proposalFraming: string;
  };
  /** Useful "talk like a local" notes for the seller. */
  sellerNotes: string[];
};
