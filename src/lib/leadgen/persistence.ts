import { Prisma } from "@prisma/client";
import type {
  Activity,
  FeatureFlag,
  LeadgenActivityLog,
  LeadgenOpportunity,
  LeadgenSavedView as PrismaLeadgenSavedView,
  ResearchQueueItem,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import type {
  LeadOpportunity,
  LeadOpportunityFilters,
  LeadOpportunityWorkflowStatus,
  LeadgenActivityEvent,
  LeadgenActivityEventType,
  LeadgenSavedView,
  LeadSourceType,
} from "@/lib/leadgen/types";
import { strictWorkspaceScope } from "@/lib/workspace";

const LEADGEN_META_PREFIX = "__leadgen_meta__:";
const LEADGEN_SOURCE_PREFIX = "leadgen:";
const LEADGEN_VIEW_KEY_PREFIX = "leadgen.saved_view.";
const LEADGEN_ACTIVITY_PREFIX = "leadgen.";
const LEADGEN_TABLE_NAMES = ["LeadgenOpportunity", "LeadgenSavedView", "LeadgenActivityLog"];
const KNOWN_LEAD_SOURCES = new Set<LeadSourceType>([
  "manual_csv",
  "google_sheets",
  "google_places",
  "yelp_fusion",
  "domain_list",
  "mock_local",
  "future_connector",
]);

type LeadgenOpportunityMeta = {
  city: string;
  state: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  hasGoogleBusinessProfile: boolean;
  hasBookingLink: boolean;
  hasContactForm: boolean;
  hasSocialLinks: boolean;
  websiteQuality: "none" | "weak" | "average" | "strong";
  responseSpeedSignal: "unknown" | "slow" | "average" | "fast";
  source: LeadSourceType;
  sourceUrl: string | null;
  estimatedNeedScore: number;
  estimatedRevenuePotential: number;
  opportunityLevel: "Low" | "Medium" | "High" | "Critical";
  presenceGaps: string[];
  recommendedOffer: string;
  suggestedPitch: string;
  lastActionAt: string | null;
};

type LeadgenSavedViewPersistenceInput = {
  columnOrder?: string[];
  sorting?: string;
};

type LeadgenSavedViewMetadata = {
  name?: string;
  filters?: LeadOpportunityFilters;
  columnOrder?: string[];
  sorting?: string;
};

type LeadgenActivityMetadata = {
  opportunityId?: string;
  eventType?: LeadgenActivityEventType;
};

const WORKFLOW_STATUSES: LeadOpportunityWorkflowStatus[] = [
  "discovered",
  "reviewed",
  "exported",
  "queued",
  "audit_generated",
  "contacted",
  "follow_up",
  "won",
  "lost",
  "archived",
];

const ACTIVITY_TYPES: LeadgenActivityEventType[] = [
  "discovered",
  "score_calculated",
  "exported_csv",
  "added_to_audgen_queue",
  "status_changed",
  "audit_generation_requested",
  "audit_generation_requires_approval",
  "note_added",
];

let hasDedicatedLeadgenTablesCache: boolean | null = null;

function isWorkflowStatus(value: string): value is LeadOpportunityWorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as LeadOpportunityWorkflowStatus);
}

function isActivityEventType(value: string): value is LeadgenActivityEventType {
  return ACTIVITY_TYPES.includes(value as LeadgenActivityEventType);
}

function serializeMeta(meta: LeadgenOpportunityMeta) {
  return `${LEADGEN_META_PREFIX}${JSON.stringify(meta)}`;
}

function parseMeta(notes: string | null): LeadgenOpportunityMeta | null {
  if (!notes || !notes.startsWith(LEADGEN_META_PREFIX)) return null;
  const raw = notes.slice(LEADGEN_META_PREFIX.length);
  try {
    const parsed = JSON.parse(raw) as LeadgenOpportunityMeta;
    return parsed;
  } catch {
    return null;
  }
}

function splitLocation(location: string | null): { city: string; state: string } {
  if (!location) return { city: "Unknown", state: "NA" };
  const [city, state] = location.split(",").map((segment) => segment.trim());
  return { city: city || "Unknown", state: state || "NA" };
}

function sourceFromQueueValue(source: string | null, fallback: LeadSourceType = "manual_csv"): LeadSourceType {
  if (!source) return fallback;
  if (source.startsWith(LEADGEN_SOURCE_PREFIX)) {
    const value = source.replace(LEADGEN_SOURCE_PREFIX, "") as LeadSourceType;
    if (KNOWN_LEAD_SOURCES.has(value)) return value;
  }
  return fallback;
}

function sourceFromRawValue(source: string | null, fallback: LeadSourceType = "manual_csv"): LeadSourceType {
  if (!source) return fallback;
  const normalized = source.trim() as LeadSourceType;
  return KNOWN_LEAD_SOURCES.has(normalized) ? normalized : fallback;
}

function safeParseStringArray(serialized: string | null | undefined, fallback: string[]): string[] {
  if (!serialized) return fallback;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return fallback;
  }
}

function extractPitchAngles(suggestedPitch: string, serialized: string | null): string {
  const parsed = safeParseStringArray(serialized, []);
  if (parsed.length > 0) return parsed[0];
  return suggestedPitch;
}

function safeParseSavedViewMetadata(serialized: string | null): LeadgenSavedViewMetadata {
  if (!serialized) return {};
  try {
    return JSON.parse(serialized) as LeadgenSavedViewMetadata;
  } catch {
    return {};
  }
}

function isMissingLeadgenTablesError(error: unknown) {
  const isKnownPrismaError =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022");
  if (isKnownPrismaError) return true;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "P2021" || code === "P2022") return true;
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return LEADGEN_TABLE_NAMES.some((table) => message.includes(table.toLowerCase()));
}

async function hasDedicatedLeadgenTables() {
  if (hasDedicatedLeadgenTablesCache !== null) return hasDedicatedLeadgenTablesCache;
  try {
    await prisma.leadgenOpportunity.count();
    hasDedicatedLeadgenTablesCache = true;
    return true;
  } catch (error) {
    if (isMissingLeadgenTablesError(error)) {
      hasDedicatedLeadgenTablesCache = false;
      return false;
    }
    throw error;
  }
}

async function withLeadgenPersistenceFallback<T>(
  dedicatedPath: () => Promise<T>,
  legacyPath: () => Promise<T>,
) {
  const dedicatedAvailable = await hasDedicatedLeadgenTables();
  if (!dedicatedAvailable) return legacyPath();
  try {
    return await dedicatedPath();
  } catch (error) {
    if (!isMissingLeadgenTablesError(error)) throw error;
    hasDedicatedLeadgenTablesCache = false;
    return legacyPath();
  }
}

function normalizeOpportunityStatus(status: string): LeadOpportunityWorkflowStatus {
  const lowered = status.toLowerCase();
  if (isWorkflowStatus(lowered)) return lowered;
  if (isWorkflowStatus(status)) return status;
  return "discovered";
}

function toOpportunityRecordData(
  workspaceId: string,
  opportunity: LeadOpportunity,
  legacyQueueItemId?: string,
): Prisma.LeadgenOpportunityUncheckedCreateInput {
  return {
    workspaceId,
    externalId: opportunity.id,
    legacyQueueItemId: legacyQueueItemId ?? null,
    businessName: opportunity.businessName,
    category: opportunity.category,
    city: opportunity.city,
    state: opportunity.state,
    address: opportunity.address,
    websiteUrl: opportunity.website,
    googleProfileUrl: opportunity.googleProfileUrl,
    phone: opportunity.phone,
    email: opportunity.email,
    rating: opportunity.rating,
    reviewCount: opportunity.reviewCount,
    hasWebsite: opportunity.hasWebsite,
    hasGoogleBusinessProfile: opportunity.hasGoogleBusinessProfile,
    hasBookingLink: opportunity.hasBookingLink,
    hasContactForm: opportunity.hasContactForm,
    hasSocialLinks: opportunity.hasSocialLinks,
    websiteQuality: opportunity.websiteQuality,
    responseSpeedSignal: opportunity.responseSpeedSignal,
    source: opportunity.source,
    sourceUrl: opportunity.sourceUrl,
    status: opportunity.status,
    estimatedNeedScore: opportunity.estimatedNeedScore,
    estimatedRevenuePotential: opportunity.estimatedRevenuePotential,
    opportunityLevel: opportunity.opportunityLevel,
    presenceGapsJson: JSON.stringify(opportunity.presenceGaps),
    pitchAnglesJson: JSON.stringify([opportunity.suggestedPitch]),
    recommendedOffer: opportunity.recommendedOffer,
    suggestedPitch: opportunity.suggestedPitch,
    sourceMetricsJson: JSON.stringify({
      rating: opportunity.rating,
      reviewCount: opportunity.reviewCount,
      sourceUrl: opportunity.sourceUrl,
    }),
    lastActionAt: opportunity.lastActionAt ? new Date(opportunity.lastActionAt) : null,
    createdAt: new Date(opportunity.createdAt),
    updatedAt: new Date(opportunity.updatedAt),
  };
}

export function mapLegacyQueueItemToLeadOpportunity(item: ResearchQueueItem): LeadOpportunity {
  const meta = parseMeta(item.notes);
  const location = splitLocation(item.location);
  const status = normalizeOpportunityStatus(item.status);

  return {
    id: item.id,
    businessName: item.businessName,
    category: item.category ?? "Local Services",
    city: meta?.city ?? location.city,
    state: meta?.state ?? location.state,
    phone: item.phone,
    email: item.email,
    website: item.websiteUrl,
    googleProfileUrl: null,
    address: meta?.address ?? null,
    rating: meta?.rating ?? null,
    reviewCount: meta?.reviewCount ?? null,
    hasWebsite: meta?.hasWebsite ?? Boolean(item.websiteUrl),
    hasGoogleBusinessProfile: meta?.hasGoogleBusinessProfile ?? false,
    hasBookingLink: meta?.hasBookingLink ?? false,
    hasContactForm: meta?.hasContactForm ?? false,
    hasSocialLinks: meta?.hasSocialLinks ?? false,
    websiteQuality: meta?.websiteQuality ?? (item.websiteUrl ? "weak" : "none"),
    responseSpeedSignal: meta?.responseSpeedSignal ?? "unknown",
    source: meta?.source ?? sourceFromQueueValue(item.source),
    sourceUrl: meta?.sourceUrl ?? null,
    status,
    estimatedNeedScore: meta?.estimatedNeedScore ?? 50,
    estimatedRevenuePotential: meta?.estimatedRevenuePotential ?? 1800,
    opportunityLevel: meta?.opportunityLevel ?? "Medium",
    presenceGaps: meta?.presenceGaps ?? ["Lead imported into LeadGen queue"],
    recommendedOffer: meta?.recommendedOffer ?? "Presence Labs Conversion Upgrade",
    suggestedPitch:
      meta?.suggestedPitch ??
      `${item.businessName} was discovered in LeadGen and should be reviewed for audit readiness.`,
    lastActionAt: meta?.lastActionAt ?? item.updatedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function mapDedicatedRecordToLeadOpportunity(item: LeadgenOpportunity): LeadOpportunity {
  return {
    id: item.externalId ?? item.id,
    businessName: item.businessName,
    category: item.category ?? "Local Services",
    city: item.city,
    state: item.state,
    phone: item.phone,
    email: item.email,
    website: item.websiteUrl,
    googleProfileUrl: item.googleProfileUrl,
    address: item.address,
    rating: item.rating,
    reviewCount: item.reviewCount,
    hasWebsite: item.hasWebsite,
    hasGoogleBusinessProfile: item.hasGoogleBusinessProfile,
    hasBookingLink: item.hasBookingLink,
    hasContactForm: item.hasContactForm,
    hasSocialLinks: item.hasSocialLinks,
    websiteQuality: item.websiteQuality as LeadOpportunity["websiteQuality"],
    responseSpeedSignal: item.responseSpeedSignal as LeadOpportunity["responseSpeedSignal"],
    source: sourceFromRawValue(item.source),
    sourceUrl: item.sourceUrl,
    status: normalizeOpportunityStatus(item.status),
    estimatedNeedScore: item.estimatedNeedScore,
    estimatedRevenuePotential: item.estimatedRevenuePotential,
    opportunityLevel: item.opportunityLevel as LeadOpportunity["opportunityLevel"],
    presenceGaps: safeParseStringArray(item.presenceGapsJson, ["Lead imported into LeadGen queue"]),
    recommendedOffer: item.recommendedOffer,
    suggestedPitch: extractPitchAngles(item.suggestedPitch, item.pitchAnglesJson),
    lastActionAt: item.lastActionAt?.toISOString() ?? item.updatedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function buildMetaFromOpportunity(opportunity: LeadOpportunity): LeadgenOpportunityMeta {
  return {
    city: opportunity.city,
    state: opportunity.state,
    address: opportunity.address,
    rating: opportunity.rating,
    reviewCount: opportunity.reviewCount,
    hasWebsite: opportunity.hasWebsite,
    hasGoogleBusinessProfile: opportunity.hasGoogleBusinessProfile,
    hasBookingLink: opportunity.hasBookingLink,
    hasContactForm: opportunity.hasContactForm,
    hasSocialLinks: opportunity.hasSocialLinks,
    websiteQuality: opportunity.websiteQuality,
    responseSpeedSignal: opportunity.responseSpeedSignal,
    source: opportunity.source,
    sourceUrl: opportunity.sourceUrl,
    estimatedNeedScore: opportunity.estimatedNeedScore,
    estimatedRevenuePotential: opportunity.estimatedRevenuePotential,
    opportunityLevel: opportunity.opportunityLevel,
    presenceGaps: opportunity.presenceGaps,
    recommendedOffer: opportunity.recommendedOffer,
    suggestedPitch: opportunity.suggestedPitch,
    lastActionAt: opportunity.lastActionAt,
  };
}

function normalizeLocation(city: string, state: string) {
  return [city.trim(), state.trim()].filter(Boolean).join(", ");
}

function toSavedView(flag: FeatureFlag): LeadgenSavedView | null {
  if (!flag.key.startsWith(LEADGEN_VIEW_KEY_PREFIX)) return null;
  const parsed = safeParseSavedViewMetadata(flag.metadataJson);
  if (!parsed.name || !parsed.filters) return null;
  return {
    id: flag.id,
    name: parsed.name,
    filters: parsed.filters,
    columnOrder: parsed.columnOrder,
    sorting: parsed.sorting,
    isPreset: false,
  };
}

function parseLeadgenActivity(activity: Activity): LeadgenActivityEvent | null {
  if (!activity.type.startsWith(LEADGEN_ACTIVITY_PREFIX)) return null;
  try {
    const metadata = activity.metadataJson ? (JSON.parse(activity.metadataJson) as LeadgenActivityMetadata) : {};
    const opportunityId = metadata.opportunityId;
    if (!opportunityId) return null;
    return {
      id: activity.id,
      opportunityId,
      eventType: metadata.eventType && isActivityEventType(metadata.eventType) ? metadata.eventType : "note_added",
      detail: activity.detail ?? activity.type,
      createdAt: activity.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

function toLeadgenActivityEventFromDedicated(activity: LeadgenActivityLog): LeadgenActivityEvent {
  let parsedMeta: LeadgenActivityMetadata = {};
  if (activity.metadataJson) {
    try {
      parsedMeta = JSON.parse(activity.metadataJson) as LeadgenActivityMetadata;
    } catch {
      parsedMeta = {};
    }
  }
  const resolvedType = isActivityEventType(activity.eventType) ? activity.eventType : "note_added";
  const metadataType = parsedMeta.eventType && isActivityEventType(parsedMeta.eventType) ? parsedMeta.eventType : null;
  return {
    id: activity.id,
    opportunityId: activity.opportunityId,
    eventType: metadataType ?? resolvedType,
    detail: activity.detail,
    createdAt: activity.createdAt.toISOString(),
  };
}

function toSavedViewFromDedicated(view: PrismaLeadgenSavedView): LeadgenSavedView {
  return {
    id: view.id,
    name: view.name,
    filters: deserializeLeadgenViewFilters(view.filtersJson),
    columnOrder: safeParseStringArray(view.columnOrderJson, []),
    sorting: view.sortingJson ?? undefined,
    isPreset: false,
  };
}

export function getPresetLeadgenSavedViews(): LeadgenSavedView[] {
  return [
    { id: "preset-missing-website", name: "Missing Website", filters: { websiteStatus: "missing" }, isPreset: true },
    { id: "preset-high-opportunity", name: "High Opportunity", filters: { opportunityLevel: "High" }, isPreset: true },
    { id: "preset-ready-for-audit", name: "Ready for Audit", filters: { status: "reviewed" }, isPreset: true },
    { id: "preset-exported", name: "Exported", filters: { status: "exported" }, isPreset: true },
    { id: "preset-queued", name: "Queued", filters: { status: "queued" }, isPreset: true },
    { id: "preset-local-contractors", name: "Local Contractors", filters: { category: "contractor" }, isPreset: true },
    { id: "preset-low-reviews", name: "Low Reviews", filters: { maxReviewCount: 10 }, isPreset: true },
    { id: "preset-no-gbp", name: "No GBP Signal", filters: { googleProfileStatus: "missing" }, isPreset: true },
  ];
}

export async function listLeadgenOpportunities(workspaceId: string) {
  return withLeadgenPersistenceFallback(
    async () => {
      const opportunities = await prisma.leadgenOpportunity.findMany({
        where: strictWorkspaceScope(workspaceId),
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      return opportunities.map(mapDedicatedRecordToLeadOpportunity);
    },
    async () => {
      const queueItems = await prisma.researchQueueItem.findMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          source: { startsWith: LEADGEN_SOURCE_PREFIX },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      return queueItems.map(mapLegacyQueueItemToLeadOpportunity);
    },
  );
}

async function ensureLeadgenSeedDataDedicated(workspaceId: string) {
  const count = await prisma.leadgenOpportunity.count({
    where: strictWorkspaceScope(workspaceId),
  });
  if (count > 0) return;

  const mockLeads = getMockLeadOpportunities();
  await saveLeadgenOpportunities(workspaceId, mockLeads);
  for (const lead of mockLeads) {
    await createLeadgenActivity(workspaceId, lead.id, "discovered", "Lead discovered via mock/local provider.");
    await createLeadgenActivity(workspaceId, lead.id, "score_calculated", `Need score calculated: ${lead.estimatedNeedScore}.`);
  }
}

async function ensureLeadgenSeedDataLegacy(workspaceId: string) {
  const count = await prisma.researchQueueItem.count({
    where: {
      ...strictWorkspaceScope(workspaceId),
      source: { startsWith: LEADGEN_SOURCE_PREFIX },
    },
  });
  if (count > 0) return;

  const mockLeads = getMockLeadOpportunities();
  for (const lead of mockLeads) {
    const created = await prisma.researchQueueItem.create({
      data: {
        workspaceId,
        businessName: lead.businessName,
        websiteUrl: lead.website,
        location: normalizeLocation(lead.city, lead.state),
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        source: `${LEADGEN_SOURCE_PREFIX}${lead.source}`,
        status: "discovered",
        priority: lead.estimatedNeedScore >= 80 ? 1 : lead.estimatedNeedScore >= 60 ? 2 : 3,
        notes: serializeMeta(buildMetaFromOpportunity({ ...lead, lastActionAt: lead.createdAt })),
      },
    });
    await createLeadgenActivity(workspaceId, created.id, "discovered", "Lead discovered via mock/local provider.");
    await createLeadgenActivity(workspaceId, created.id, "score_calculated", `Need score calculated: ${lead.estimatedNeedScore}.`);
  }
}

export async function ensureLeadgenSeedData(workspaceId: string) {
  await withLeadgenPersistenceFallback(
    async () => ensureLeadgenSeedDataDedicated(workspaceId),
    async () => ensureLeadgenSeedDataLegacy(workspaceId),
  );
}

async function saveLeadgenOpportunitiesDedicated(workspaceId: string, opportunities: LeadOpportunity[]) {
  if (opportunities.length === 0) return;
  const operations = opportunities.map((lead) =>
    prisma.leadgenOpportunity.upsert({
      where: {
        workspaceId_externalId: {
          workspaceId,
          externalId: lead.id,
        },
      },
      update: toOpportunityRecordData(workspaceId, lead),
      create: toOpportunityRecordData(workspaceId, lead),
    }),
  );
  await prisma.$transaction(operations);
}

async function saveLeadgenOpportunitiesLegacy(workspaceId: string, opportunities: LeadOpportunity[]) {
  for (const lead of opportunities) {
    const existing = await prisma.researchQueueItem.findFirst({
      where: {
        ...strictWorkspaceScope(workspaceId),
        id: lead.id,
      },
    });
    const data = {
      businessName: lead.businessName,
      websiteUrl: lead.website,
      location: normalizeLocation(lead.city, lead.state),
      category: lead.category,
      phone: lead.phone,
      email: lead.email,
      source: `${LEADGEN_SOURCE_PREFIX}${lead.source}`,
      status: lead.status,
      notes: serializeMeta(buildMetaFromOpportunity(lead)),
      priority: lead.estimatedNeedScore >= 80 ? 1 : lead.estimatedNeedScore >= 60 ? 2 : 3,
    };
    if (existing) {
      await prisma.researchQueueItem.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.researchQueueItem.create({
        data: { workspaceId, ...data },
      });
    }
  }
}

export async function saveLeadgenOpportunities(
  workspaceId: string,
  opportunities: LeadOpportunity[],
) {
  await withLeadgenPersistenceFallback(
    async () => saveLeadgenOpportunitiesDedicated(workspaceId, opportunities),
    async () => saveLeadgenOpportunitiesLegacy(workspaceId, opportunities),
  );
}

export async function bulkUpdateLeadgenStatus(
  workspaceId: string,
  opportunityIds: string[],
  nextStatus: LeadOpportunityWorkflowStatus,
  note?: string,
) {
  return withLeadgenPersistenceFallback(
    async () => {
      const current = await prisma.leadgenOpportunity.findMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          OR: [{ id: { in: opportunityIds } }, { externalId: { in: opportunityIds } }],
        },
        select: { id: true, externalId: true },
      });
      if (current.length === 0) return 0;
      const now = new Date();
      const detail = note?.trim() ? `Status set to ${nextStatus}. ${note.trim()}` : `Status set to ${nextStatus}.`;
      await prisma.$transaction([
        prisma.leadgenOpportunity.updateMany({
          where: {
            ...strictWorkspaceScope(workspaceId),
            id: { in: current.map((item) => item.id) },
          },
          data: { status: nextStatus, updatedAt: now, lastActionAt: now },
        }),
        ...current.map((item) =>
          prisma.leadgenActivityLog.create({
            data: {
              workspaceId,
              opportunityId: item.id,
              eventType: "status_changed",
              detail,
              source: "leadgen",
              metadataJson: JSON.stringify({
                opportunityId: item.externalId ?? item.id,
                eventType: "status_changed",
              }),
            },
          }),
        ),
      ]);
      return current.length;
    },
    async () => {
      let updated = 0;
      for (const id of opportunityIds) {
        const current = await prisma.researchQueueItem.findFirst({
          where: { ...strictWorkspaceScope(workspaceId), id, source: { startsWith: LEADGEN_SOURCE_PREFIX } },
        });
        if (!current) continue;
        await prisma.researchQueueItem.update({
          where: { id: current.id },
          data: { status: nextStatus, updatedAt: new Date() },
        });
        await createLeadgenActivity(
          workspaceId,
          current.id,
          "status_changed",
          note?.trim() ? `Status set to ${nextStatus}. ${note.trim()}` : `Status set to ${nextStatus}.`,
        );
        updated += 1;
      }
      return updated;
    },
  );
}

/**
 * Translate a list of opportunity IDs (which may be the freshly-persisted
 * dedicated-table cuids OR the discovery-side synthetic IDs that live in
 * `LeadgenOpportunity.externalId`) to the actual `LeadgenOpportunity.id`
 * values required by the `LeadgenActivityLog.opportunityId` foreign key.
 *
 * Returns a Map<inputId, dbId> populated for every input ID that resolves.
 * Inputs that don't resolve are simply absent from the map — callers
 * should treat that as "skip the activity write for this lead" rather
 * than passing the synthetic ID through, which triggers the FK violation
 * observed in production at 11:26 UTC on 2026-05-18 when adding live
 * Google Places / Yelp leads to AudGen.
 *
 * Workspace-scoping note: every read here is gated by
 * `strictWorkspaceScope(workspaceId)` (commit b8a3975). Synthetic IDs
 * from a different tenant cannot be resolved against this workspace, so
 * they will simply be absent from the map and skipped — there is no path
 * by which this helper can leak cross-tenant opportunity IDs.
 *
 * Legacy persistence mode (dedicated tables missing → P2021/P2022): the
 * `LeadgenActivityLog` FK does not apply because activity logs go to the
 * `Activity` table instead. We return an identity map letting callers
 * pass the original IDs straight through to `createLeadgenActivity`,
 * whose legacy fallback writes them as informational metadata only.
 */
export async function resolveLeadgenOpportunityDbIds(
  workspaceId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  return withLeadgenPersistenceFallback(
    async () => {
      const rows = await prisma.leadgenOpportunity.findMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          OR: [{ id: { in: ids } }, { externalId: { in: ids } }],
        },
        select: { id: true, externalId: true },
      });
      const inputSet = new Set(ids);
      for (const row of rows) {
        if (row.externalId && inputSet.has(row.externalId)) {
          result.set(row.externalId, row.id);
        }
        if (inputSet.has(row.id)) {
          result.set(row.id, row.id);
        }
      }
      return result;
    },
    async () => {
      for (const id of ids) result.set(id, id);
      return result;
    },
  );
}

export async function createLeadgenActivity(
  workspaceId: string,
  opportunityId: string,
  eventType: LeadgenActivityEventType,
  detail: string,
) {
  await withLeadgenPersistenceFallback(
    async () => {
      await prisma.leadgenActivityLog.create({
        data: {
          workspaceId,
          opportunityId,
          eventType,
          detail,
          source: "leadgen",
          metadataJson: JSON.stringify({ opportunityId, eventType }),
        },
      });
    },
    async () => {
      await prisma.activity.create({
        data: {
          workspaceId,
          leadId: null,
          type: `${LEADGEN_ACTIVITY_PREFIX}${eventType}`,
          detail,
          source: "leadgen",
          metadataJson: JSON.stringify({ opportunityId, eventType }),
        },
      });
    },
  );
}

export async function listLeadgenActivities(workspaceId: string): Promise<LeadgenActivityEvent[]> {
  return withLeadgenPersistenceFallback(
    async () => {
      const activities = await prisma.leadgenActivityLog.findMany({
        where: strictWorkspaceScope(workspaceId),
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return activities.map(toLeadgenActivityEventFromDedicated);
    },
    async () => {
      const activities = await prisma.activity.findMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          type: { startsWith: LEADGEN_ACTIVITY_PREFIX },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return activities
        .map(parseLeadgenActivity)
        .filter((event): event is LeadgenActivityEvent => Boolean(event));
    },
  );
}

export async function listLeadgenSavedViews(workspaceId: string) {
  return withLeadgenPersistenceFallback(
    async () => {
      const savedViews = await prisma.leadgenSavedView.findMany({
        where: strictWorkspaceScope(workspaceId),
        orderBy: { updatedAt: "desc" },
      });
      return [...getPresetLeadgenSavedViews(), ...savedViews.map(toSavedViewFromDedicated)];
    },
    async () => {
      const customFlags = await prisma.featureFlag.findMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          key: { startsWith: LEADGEN_VIEW_KEY_PREFIX },
        },
        orderBy: { updatedAt: "desc" },
      });
      const customViews = customFlags
        .map(toSavedView)
        .filter((view): view is LeadgenSavedView => Boolean(view));
      return [...getPresetLeadgenSavedViews(), ...customViews];
    },
  );
}

function slugifySavedViewName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createLeadgenSavedView(
  workspaceId: string,
  name: string,
  filters: LeadOpportunityFilters,
  options: LeadgenSavedViewPersistenceInput = {},
) {
  const slug = slugifySavedViewName(name);
  await withLeadgenPersistenceFallback(
    async () => {
      await prisma.leadgenSavedView.create({
        data: {
          workspaceId,
          name,
          slug: `${slug}-${Date.now()}`,
          filtersJson: serializeLeadgenViewFilters(filters),
          columnOrderJson: options.columnOrder ? JSON.stringify(options.columnOrder) : null,
          sortingJson: options.sorting ?? null,
        },
      });
    },
    async () => {
      const uniqueKey = `${LEADGEN_VIEW_KEY_PREFIX}${slug}-${Date.now()}`;
      await prisma.featureFlag.create({
        data: {
          workspaceId,
          key: uniqueKey,
          enabled: true,
          metadataJson: JSON.stringify({
            name,
            filters,
            columnOrder: options.columnOrder ?? [],
            sorting: options.sorting ?? null,
          }),
          rolloutPct: 100,
        },
      });
    },
  );
}

export async function deleteLeadgenSavedView(workspaceId: string, viewId: string) {
  await withLeadgenPersistenceFallback(
    async () => {
      await prisma.leadgenSavedView.deleteMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          id: viewId,
        },
      });
    },
    async () => {
      await prisma.featureFlag.deleteMany({
        where: {
          ...strictWorkspaceScope(workspaceId),
          id: viewId,
          key: { startsWith: LEADGEN_VIEW_KEY_PREFIX },
        },
      });
    },
  );
}

export function serializeLeadgenViewFilters(filters: LeadOpportunityFilters) {
  return JSON.stringify(filters);
}

export function deserializeLeadgenViewFilters(serialized: string): LeadOpportunityFilters {
  try {
    return JSON.parse(serialized) as LeadOpportunityFilters;
  } catch {
    return {};
  }
}

export async function migrateLegacyLeadgenWorkspaceData(workspaceId: string) {
  const dedicatedAvailable = await hasDedicatedLeadgenTables();
  if (!dedicatedAvailable) {
    return {
      usedDedicatedTables: false,
      opportunitiesMigrated: 0,
      savedViewsMigrated: 0,
      activityLogsMigrated: 0,
    };
  }

  const [legacyQueueItems, legacySavedViews, legacyActivities] = await prisma.$transaction([
    prisma.researchQueueItem.findMany({
      where: {
        ...strictWorkspaceScope(workspaceId),
        source: { startsWith: LEADGEN_SOURCE_PREFIX },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.featureFlag.findMany({
      where: {
        ...strictWorkspaceScope(workspaceId),
        key: { startsWith: LEADGEN_VIEW_KEY_PREFIX },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activity.findMany({
      where: {
        ...strictWorkspaceScope(workspaceId),
        type: { startsWith: LEADGEN_ACTIVITY_PREFIX },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const item of legacyQueueItems) {
    const mapped = mapLegacyQueueItemToLeadOpportunity(item);
    await prisma.leadgenOpportunity.upsert({
      where: {
        workspaceId_externalId: {
          workspaceId,
          externalId: item.id,
        },
      },
      update: toOpportunityRecordData(workspaceId, mapped, item.id),
      create: toOpportunityRecordData(workspaceId, mapped, item.id),
    });
  }

  for (const view of legacySavedViews) {
    const parsed = toSavedView(view);
    if (!parsed) continue;
    await prisma.leadgenSavedView.upsert({
      where: { id: view.id },
      update: {
        workspaceId,
        name: parsed.name,
        slug: `${slugifySavedViewName(parsed.name)}-${view.id.slice(0, 8)}`,
        filtersJson: serializeLeadgenViewFilters(parsed.filters),
        columnOrderJson: parsed.columnOrder ? JSON.stringify(parsed.columnOrder) : null,
        sortingJson: parsed.sorting ?? null,
      },
      create: {
        id: view.id,
        workspaceId,
        name: parsed.name,
        slug: `${slugifySavedViewName(parsed.name)}-${view.id.slice(0, 8)}`,
        filtersJson: serializeLeadgenViewFilters(parsed.filters),
        columnOrderJson: parsed.columnOrder ? JSON.stringify(parsed.columnOrder) : null,
        sortingJson: parsed.sorting ?? null,
      },
    });
  }

  const existingOpportunityIds = new Set(
    (
      await prisma.leadgenOpportunity.findMany({
        where: strictWorkspaceScope(workspaceId),
        select: { id: true, externalId: true },
      })
    ).map((item) => item.externalId ?? item.id),
  );

  let activityLogsMigrated = 0;
  for (const activity of legacyActivities) {
    const parsed = parseLeadgenActivity(activity);
    if (!parsed) continue;
    if (!existingOpportunityIds.has(parsed.opportunityId)) continue;
    await prisma.leadgenActivityLog.upsert({
      where: { id: activity.id },
      update: {
        workspaceId,
        opportunityId: parsed.opportunityId,
        eventType: parsed.eventType,
        detail: parsed.detail,
        source: "leadgen",
        metadataJson: JSON.stringify({ opportunityId: parsed.opportunityId, eventType: parsed.eventType }),
        createdAt: new Date(parsed.createdAt),
      },
      create: {
        id: activity.id,
        workspaceId,
        opportunityId: parsed.opportunityId,
        eventType: parsed.eventType,
        detail: parsed.detail,
        source: "leadgen",
        metadataJson: JSON.stringify({ opportunityId: parsed.opportunityId, eventType: parsed.eventType }),
        createdAt: new Date(parsed.createdAt),
      },
    });
    activityLogsMigrated += 1;
  }

  return {
    usedDedicatedTables: true,
    opportunitiesMigrated: legacyQueueItems.length,
    savedViewsMigrated: legacySavedViews.length,
    activityLogsMigrated,
  };
}
