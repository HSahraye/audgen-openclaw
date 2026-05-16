import type { Activity, FeatureFlag, ResearchQueueItem } from "@prisma/client";
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

function isWorkflowStatus(value: string): value is LeadOpportunityWorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as LeadOpportunityWorkflowStatus);
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
    return value;
  }
  return fallback;
}

function toLeadgenOpportunity(item: ResearchQueueItem): LeadOpportunity {
  const meta = parseMeta(item.notes);
  const location = splitLocation(item.location);
  const status = isWorkflowStatus(item.status.toLowerCase())
    ? (item.status.toLowerCase() as LeadOpportunityWorkflowStatus)
    : isWorkflowStatus(item.status)
      ? (item.status as LeadOpportunityWorkflowStatus)
      : "discovered";

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
  try {
    const parsed = JSON.parse(flag.metadataJson || "{}") as {
      name?: string;
      filters?: LeadOpportunityFilters;
    };
    if (!parsed.name || !parsed.filters) return null;
    return {
      id: flag.id,
      name: parsed.name,
      filters: parsed.filters,
      isPreset: false,
    };
  } catch {
    return null;
  }
}

function parseLeadgenActivity(activity: Activity): LeadgenActivityEvent | null {
  if (!activity.type.startsWith(LEADGEN_ACTIVITY_PREFIX)) return null;
  try {
    const metadata = activity.metadataJson
      ? (JSON.parse(activity.metadataJson) as { opportunityId?: string; eventType?: LeadgenActivityEventType })
      : {};
    const opportunityId = metadata.opportunityId;
    if (!opportunityId) return null;
    return {
      id: activity.id,
      opportunityId,
      eventType: metadata.eventType ?? "note_added",
      detail: activity.detail ?? activity.type,
      createdAt: activity.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
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
  const queueItems = await prisma.researchQueueItem.findMany({
    where: {
      ...strictWorkspaceScope(workspaceId),
      source: { startsWith: LEADGEN_SOURCE_PREFIX },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  return queueItems.map(toLeadgenOpportunity);
}

export async function ensureLeadgenSeedData(workspaceId: string) {
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

export async function saveLeadgenOpportunities(
  workspaceId: string,
  opportunities: LeadOpportunity[],
) {
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

export async function bulkUpdateLeadgenStatus(
  workspaceId: string,
  opportunityIds: string[],
  nextStatus: LeadOpportunityWorkflowStatus,
  note?: string,
) {
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
}

export async function createLeadgenActivity(
  workspaceId: string,
  opportunityId: string,
  eventType: LeadgenActivityEventType,
  detail: string,
) {
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
}

export async function listLeadgenActivities(workspaceId: string): Promise<LeadgenActivityEvent[]> {
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
}

export async function listLeadgenSavedViews(workspaceId: string) {
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
}

export async function createLeadgenSavedView(
  workspaceId: string,
  name: string,
  filters: LeadOpportunityFilters,
) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const uniqueKey = `${LEADGEN_VIEW_KEY_PREFIX}${slug}-${Date.now()}`;
  await prisma.featureFlag.create({
    data: {
      workspaceId,
      key: uniqueKey,
      enabled: true,
      metadataJson: JSON.stringify({ name, filters }),
      rolloutPct: 100,
    },
  });
}

export async function deleteLeadgenSavedView(workspaceId: string, viewId: string) {
  await prisma.featureFlag.deleteMany({
    where: {
      ...strictWorkspaceScope(workspaceId),
      id: viewId,
      key: { startsWith: LEADGEN_VIEW_KEY_PREFIX },
    },
  });
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
