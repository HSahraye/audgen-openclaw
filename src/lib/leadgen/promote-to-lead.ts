import { generateUniqueAuditSlug } from "@/lib/audit-slugs";
import { prisma } from "@/lib/prisma";
import { strictWorkspaceScope } from "@/lib/workspace";
import type { LeadOpportunity } from "@/lib/leadgen/types";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";

/**
 * Source marker stored in Lead.auditJson.source so we can later
 * distinguish leads that came from leadgen discovery (and have a stub
 * audit pending regeneration) from leads created manually via
 * `createLeadAction` or imported via `importLeadsCsvAction` (which
 * carry a fully-generated audit by design).
 */
export const LEADGEN_PROMOTION_SOURCE = "leadgen_discovery";

/**
 * RENDER-PATH CONTRACT (read this before changing the stub shape):
 *
 * The home dashboard's `parsedLeads` useMemo
 * (src/components/audit-dashboard.tsx:424-444) iterates every Lead
 * and dereferences specific keys on JSON.parse(assetsJson) and
 * JSON.parse(auditJson). If any of these are `undefined`, the React
 * tree throws and the global error boundary renders for the whole
 * dashboard:
 *
 *   parsedAssets.coldCallScript      → sanitizePublicBrandCopy(...)
 *   parsedAssets.textMessageScript   → sanitizePublicBrandCopy(...)
 *   parsedAssets.emailScript         → sanitizePublicBrandCopy(...)
 *   parsedAssets.thirtySecondPitch   → sanitizePublicBrandCopy(...)
 *   parsedAssets.followUpMessage     → sanitizePublicBrandCopy(...)
 *   parsedAssets.proposalOutline     → .map() in lead-detail panel
 *   parsedAssets.{leadScore, painPointSummary, recommendedPackage,
 *                 likelyMoneyLost, presenceLabsOffer}     → narrative
 *   parsedAudit.checks.{12 boolean fields}                → CheckItem
 *   parsedAudit.websiteSignals[]                          → .map()
 *   parsedAudit.warnings[] / .source                      → .map()
 *
 * The stubs below populate every one of these fields with a
 * non-undefined value. The user-visible placeholder "Click Regenerate"
 * on each script tells the user the audit content is pending; clicking
 * Regenerate runs the canonical `generateAudit()` and overwrites these
 * stubs with full content.
 *
 * This contract is pinned by:
 *   src/lib/leadgen/promote-to-lead-dashboard-contract.test.ts
 *   src/lib/leadgen/promote-to-lead.test.ts
 * If you add a new required field to GeneratedAssets or AuditChecks,
 * update both this stub AND the contract test.
 */
const STUB_PLACEHOLDER =
  "Audit pending — click \"Regenerate\" on this lead to populate full audit content.";

function buildStubChecks(websiteUrl: string | null, phone: string | null): AuditChecks {
  return {
    // hasWebsite + phoneEasyToFind reflect the only two signals we
    // actually have at promotion time. The remaining 10 default to
    // `false` (the dashboard renders these as "missing" CheckItems,
    // which is honest signalling — full audit fills in real values).
    hasWebsite: Boolean(websiteUrl),
    outdatedWebsite: false,
    mobileFriendly: false,
    clearCta: false,
    phoneEasyToFind: Boolean(phone),
    reviewsVisible: false,
    onlineBooking: false,
    trustSection: false,
    gallery: false,
    serviceList: false,
    pricing: false,
    faq: false,
  };
}

function buildStubAssets(
  opportunity: LeadOpportunity,
  score: number,
  packageName: string,
  painSummary: string,
): GeneratedAssets {
  const likelyMoneyLost =
    typeof opportunity.estimatedRevenuePotential === "number" && opportunity.estimatedRevenuePotential > 0
      ? `~$${opportunity.estimatedRevenuePotential.toLocaleString()}/yr (estimated)`
      : "Pending audit regeneration";
  return {
    leadScore: score,
    painPointSummary: painSummary,
    recommendedPackage: packageName,
    likelyMoneyLost,
    presenceLabsOffer: packageName,
    coldCallScript: STUB_PLACEHOLDER,
    textMessageScript: STUB_PLACEHOLDER,
    emailScript: STUB_PLACEHOLDER,
    thirtySecondPitch: STUB_PLACEHOLDER,
    followUpMessage: STUB_PLACEHOLDER,
    proposalOutline: ["Click \"Regenerate\" to populate the proposal outline."],
  };
}

/**
 * Copy of the manual-flow's package fallback so we never persist an
 * empty packageName (the column is non-nullable). Mirrors the literal
 * default in audit-engine.ts → packageName().
 */
const FALLBACK_PACKAGE = "Presence Labs Conversion Upgrade";

/**
 * Statuses that indicate the user has already started engaging with
 * the lead. Re-promoting an existing lead must NOT roll those back to
 * "New" — that would silently lose progress in the user's pipeline.
 */
const PRESERVE_STATUSES = new Set(["Contacted", "Follow-up", "Won", "Lost"]);

export type PromotionOutcome = {
  leadId: string;
  created: boolean;
  status: string;
};

function buildLocation(opportunity: LeadOpportunity): string | null {
  const city = opportunity.city?.trim() ?? "";
  const state = opportunity.state?.trim() ?? "";
  const joined = [city, state].filter(Boolean).join(", ").trim();
  return joined.length > 0 ? joined : null;
}

function clampScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(100, Math.round(value)));
}

/**
 * Build a well-formed auditJson stub matching the AuditResult shape
 * the dashboard renderer reads (audit-dashboard.tsx:1458-1525). The
 * stub also carries discovery provenance (discoveryProvider +
 * discoveryExternalId) so debug tooling can trace any Lead row back
 * to its origin LeadgenOpportunity.
 */
function buildStubAuditJson(opportunity: LeadOpportunity, websiteUrl: string | null, phone: string | null): string {
  return JSON.stringify({
    source: LEADGEN_PROMOTION_SOURCE,
    discoveryProvider: opportunity.source,
    discoveryExternalId: opportunity.id,
    checks: buildStubChecks(websiteUrl, phone),
    websiteSignals: [],
    warnings: [
      "Lead promoted from leadgen discovery. Click \"Regenerate\" to populate full audit content.",
    ],
  });
}

function buildStubAssetsJson(opportunity: LeadOpportunity, score: number, packageName: string, painSummary: string): string {
  return JSON.stringify({
    ...buildStubAssets(opportunity, score, packageName, painSummary),
    pendingRegeneration: true,
  });
}

/**
 * Idempotently promote a single LeadgenOpportunity into a dashboard
 * Lead row. Returns the resulting Lead id and whether the row was
 * newly created (true) or matched an existing row and updated (false).
 *
 * SECURITY: caller is responsible for sourcing `workspaceId` from
 * `requireSessionRole(...).workspaceId`. This helper uses
 * `strictWorkspaceScope(workspaceId)` on every read/write, so cross-
 * tenant matches are impossible (b8a3975 invariant).
 *
 * IDEMPOTENCY contract:
 *   1. Match an existing Lead in the same workspace by
 *      `(businessName, websiteUrl)` OR `(businessName, phone)`. Mirrors
 *      the CSV import dedup pattern in `importLeadsCsvAction`.
 *   2. Fallback: match by `(businessName, location)` when neither
 *      websiteUrl nor phone is present.
 *   3. If no identifying signals, create a fresh Lead.
 *
 * STATUS preservation:
 *   - If the matched Lead is at "Contacted" / "Follow-up" / "Won" /
 *     "Lost", DO NOT roll it back to "New". User progress is preserved.
 *   - "New" / "Discovered" / unknown statuses ARE refreshed to "New"
 *     so a re-promotion stays consistent with the manual flow's
 *     default.
 *
 * AUDIT content:
 *   - Lead.auditJson / assetsJson are stubbed from discovery data — no
 *     synchronous call to `generateAudit()` (which would burn the
 *     workspace's audit entitlement and potentially call external
 *     paid APIs). The user clicks "Regenerate" on the dashboard Lead
 *     to populate full audit content on demand.
 */
export async function promoteOpportunityToLead(
  workspaceId: string,
  opportunity: LeadOpportunity,
): Promise<PromotionOutcome> {
  const businessName = opportunity.businessName.trim();
  if (!businessName) {
    throw new Error("promoteOpportunityToLead: opportunity.businessName is required.");
  }

  const websiteUrl = opportunity.website?.trim() || null;
  const phone = opportunity.phone?.trim() || null;
  const email = opportunity.email?.trim() || null;
  const googleProfileUrl = opportunity.googleProfileUrl?.trim() || null;
  const category = opportunity.category?.trim() || null;
  const location = buildLocation(opportunity);

  const score = clampScore(opportunity.estimatedNeedScore);
  const packageName = (opportunity.recommendedOffer?.trim() || FALLBACK_PACKAGE).slice(0, 200);
  const painSummary = (
    opportunity.suggestedPitch?.trim()
    || "Audit pending — click Regenerate to populate full audit content."
  ).slice(0, 4000);
  const auditJson = buildStubAuditJson(opportunity, websiteUrl, phone);
  const assetsJson = buildStubAssetsJson(opportunity, score, packageName, painSummary);

  // Idempotency lookup. Use the most reliable identifier we have.
  let existing: { id: string; status: string } | null = null;
  if (websiteUrl || phone) {
    const orClauses: Array<{ websiteUrl: string } | { phone: string }> = [];
    if (websiteUrl) orClauses.push({ websiteUrl });
    if (phone) orClauses.push({ phone });
    existing = await prisma.lead.findFirst({
      where: {
        ...strictWorkspaceScope(workspaceId),
        businessName,
        OR: orClauses,
      },
      select: { id: true, status: true },
    });
  } else if (location) {
    existing = await prisma.lead.findFirst({
      where: {
        ...strictWorkspaceScope(workspaceId),
        businessName,
        location,
      },
      select: { id: true, status: true },
    });
  }

  if (existing) {
    const nextStatus = PRESERVE_STATUSES.has(existing.status) ? existing.status : "New";
    await prisma.lead.updateMany({
      where: {
        id: existing.id,
        ...strictWorkspaceScope(workspaceId),
      },
      data: {
        // Refresh discovery-side metadata, but never overwrite a user-
        // edited value with null — only fill blanks.
        category: category ?? undefined,
        location: location ?? undefined,
        websiteUrl: websiteUrl ?? undefined,
        googleProfileUrl: googleProfileUrl ?? undefined,
        phone: phone ?? undefined,
        email: email ?? undefined,
        status: nextStatus,
      },
    });
    return { leadId: existing.id, created: false, status: nextStatus };
  }

  const shortSlug = await generateUniqueAuditSlug(businessName);
  const created = await prisma.lead.create({
    data: {
      workspaceId,
      shortSlug,
      businessName,
      ownerName: null,
      category,
      location,
      websiteUrl,
      googleProfileUrl,
      phone,
      email,
      notes: null,
      status: "New",
      score,
      packageName,
      painSummary,
      auditJson,
      assetsJson,
      intelligenceJson: null,
      generatedContextJson: null,
    },
    select: { id: true, status: true },
  });
  return { leadId: created.id, created: true, status: created.status };
}
