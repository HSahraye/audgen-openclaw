import type { VerticalPack, VerticalSlug } from "./types";
import { dentalPack } from "./packs/dental";
import { smokeShopPack } from "./packs/smoke-shop";
import { hvacPack } from "./packs/hvac";

/**
 * Registered vertical packs. Order matters \u2014 the first match wins in
 * resolveVerticalPack when a lead's category text matches multiple
 * packs.
 */
export const VERTICAL_PACKS: VerticalPack[] = [dentalPack, smokeShopPack, hvacPack];

export type { VerticalPack, VerticalSlug } from "./types";

export function listVerticalSlugs(): VerticalSlug[] {
  return VERTICAL_PACKS.map((p) => p.slug);
}

export function getVerticalPack(slug: VerticalSlug | null | undefined): VerticalPack | null {
  if (!slug) return null;
  return VERTICAL_PACKS.find((p) => p.slug === slug) ?? null;
}

/**
 * Resolve the best vertical pack for a free-text business category. We
 * normalise both sides (lowercase, trim) and look for whole-word match.
 * Returns null when no pack matches; the caller decides whether to fall
 * back to a generic pack or just skip vertical-aware logic.
 *
 * This is intentionally cheap and synchronous \u2014 every Lead row can
 * call it during rendering or scoring without hitting the DB.
 */
export function resolveVerticalPack(category: string | null | undefined): VerticalPack | null {
  if (!category) return null;
  const norm = category.trim().toLowerCase();
  if (!norm) return null;
  for (const pack of VERTICAL_PACKS) {
    for (const m of pack.matchCategories) {
      const mNorm = m.toLowerCase();
      if (norm === mNorm) return pack;
      // Whole-word containment: 'pediatric dental' matches dental, but
      // 'wholesale dental supply distributor' would not (it doesn't
      // contain the term as a whole word).
      const re = new RegExp(`(^|\\W)${mNorm.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\W|$)`);
      if (re.test(norm)) return pack;
    }
  }
  return null;
}

/**
 * Cheap effective-pricing helper that picks the standard tier when the
 * pack is known, or returns a sensible generic default when it's not.
 */
export function effectivePricing(pack: VerticalPack | null) {
  if (pack) return pack.pricing;
  return {
    starterPackageUsd: 1000,
    standardPackageUsd: 1500,
    premiumPackageUsd: 2500,
    typicalCycleDays: 10,
  };
}
