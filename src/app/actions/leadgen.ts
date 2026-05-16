"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { enforceAuditGeneration } from "@/lib/billing/entitlements";
import { BRANDING_CONFIG } from "@/config/branding";
import { shouldShowDemoBanner } from "@/lib/demo-mode";
import {
  buildLeadgenAuditPreflight,
  getWorkspaceMonthlyCreditAllocation,
  LEADGEN_AUDIT_BATCH_LIMIT,
  LEADGEN_PREFLIGHT_LIMIT_ERROR,
} from "@/lib/leadgen/audit-preflight";
import {
  bulkUpdateLeadgenStatus,
  createLeadgenActivity,
  createLeadgenSavedView,
  deleteLeadgenSavedView,
  saveLeadgenOpportunities,
} from "@/lib/leadgen/persistence";
import type { LeadOpportunity, LeadOpportunityFilters, LeadOpportunityWorkflowStatus } from "@/lib/leadgen/types";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, strictWorkspaceScope } from "@/lib/workspace";

const savedViewSchema = z.object({
  name: z.string().min(2).max(80),
  filters: z.custom<LeadOpportunityFilters>(),
});

const bulkStatusSchema = z.object({
  opportunityIds: z.array(z.string().min(1)).min(1),
  nextStatus: z.custom<LeadOpportunityWorkflowStatus>(),
  note: z.string().max(600).optional(),
});

const LEADGEN_AUDIT_DISPATCH_SOURCE = "leadgen:audit_dispatch";

type LeadgenQueueDispatchCandidate = {
  opportunityId: string;
  businessName: string;
  category: string | null;
  location: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  priority: number;
};

function normalizeSelectedOpportunityIds(opportunityIds: string[]) {
  return [...new Set(opportunityIds.map((id) => id.trim()).filter(Boolean))];
}

function toQueuePriority(estimatedNeedScore: number) {
  if (estimatedNeedScore >= 80) return 1;
  if (estimatedNeedScore >= 60) return 2;
  return 3;
}

function buildLocation(city: string | null, state: string | null) {
  if (!city && !state) return null;
  return [city, state].filter(Boolean).join(", ");
}

function buildMockAuditStructure(lead: LeadgenQueueDispatchCandidate) {
  return {
    mode: "mock_structural",
    generatedAt: new Date().toISOString(),
    leadgenOpportunityId: lead.opportunityId,
    audit: {
      category: lead.category,
      location: lead.location,
      websitePresent: Boolean(lead.websiteUrl),
      contactSignals: {
        phonePresent: Boolean(lead.phone),
        emailPresent: Boolean(lead.email),
      },
      recommendedNextAction: "Queue-safe mock payload generated; no live billing execution performed.",
    },
  };
}

function buildDispatchNotes(lead: LeadgenQueueDispatchCandidate, useDemoPath: boolean) {
  const marker = `[leadgen-opportunity:${lead.opportunityId}]`;
  if (!useDemoPath) {
    return `${marker} Lead queued from LeadGen audit preflight dispatcher.`;
  }
  return `${marker} ${JSON.stringify(buildMockAuditStructure(lead))}`;
}

async function resolveLeadgenQueueDispatchCandidates(
  workspaceId: string,
  opportunityIds: string[],
): Promise<LeadgenQueueDispatchCandidate[]> {
  const scopedWhere = strictWorkspaceScope(workspaceId);
  const [dedicatedRows, legacyRows] = await Promise.all([
    prisma.leadgenOpportunity.findMany({
      where: {
        ...scopedWhere,
        OR: [{ id: { in: opportunityIds } }, { externalId: { in: opportunityIds } }],
      },
      select: {
        id: true,
        externalId: true,
        businessName: true,
        category: true,
        city: true,
        state: true,
        websiteUrl: true,
        phone: true,
        email: true,
        estimatedNeedScore: true,
      },
    }),
    prisma.researchQueueItem.findMany({
      where: {
        ...scopedWhere,
        id: { in: opportunityIds },
        source: { startsWith: "leadgen:" },
      },
      select: {
        id: true,
        businessName: true,
        category: true,
        location: true,
        websiteUrl: true,
        phone: true,
        email: true,
        priority: true,
      },
    }),
  ]);

  const candidates = new Map<string, LeadgenQueueDispatchCandidate>();

  for (const row of dedicatedRows) {
    const opportunityId = row.externalId ?? row.id;
    candidates.set(opportunityId, {
      opportunityId,
      businessName: row.businessName,
      category: row.category ?? null,
      location: buildLocation(row.city, row.state),
      websiteUrl: row.websiteUrl ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      priority: toQueuePriority(row.estimatedNeedScore),
    });
  }

  for (const row of legacyRows) {
    if (candidates.has(row.id)) continue;
    candidates.set(row.id, {
      opportunityId: row.id,
      businessName: row.businessName,
      category: row.category ?? null,
      location: row.location ?? null,
      websiteUrl: row.websiteUrl ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      priority: row.priority,
    });
  }

  return opportunityIds
    .map((id) => candidates.get(id))
    .filter((candidate): candidate is LeadgenQueueDispatchCandidate => Boolean(candidate));
}

export async function addSelectedLeadgenToAudgenAction(
  opportunities: LeadOpportunity[],
) {
  await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  await saveLeadgenOpportunities(
    workspaceId,
    opportunities.map((lead) => ({ ...lead, status: "queued", lastActionAt: new Date().toISOString() })),
  );
  for (const lead of opportunities) {
    await createLeadgenActivity(
      workspaceId,
      lead.id,
      "added_to_audgen_queue",
      `Lead added to ${BRANDING_CONFIG.appName} queue.`,
    );
  }
  const updated = await bulkUpdateLeadgenStatus(
    workspaceId,
    opportunities.map((lead) => lead.id),
    "queued",
    `Queued for ${BRANDING_CONFIG.appName} workflow.`,
  );
  revalidatePath("/leadgen");
  revalidatePath("/research");
  return { ok: true, added: updated, skipped: 0, error: "" };
}

export async function persistLeadgenOpportunitiesAction(opportunities: LeadOpportunity[]) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  await saveLeadgenOpportunities(workspaceId, opportunities);
  revalidatePath("/leadgen");
  return { ok: true, count: opportunities.length };
}

export async function saveLeadgenViewAction(name: string, filters: LeadOpportunityFilters) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = savedViewSchema.safeParse({ name, filters });
  if (!parsed.success) return { ok: false, error: "Invalid saved view." };
  await createLeadgenSavedView(workspaceId, parsed.data.name, parsed.data.filters);
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function deleteLeadgenViewAction(viewId: string) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  await deleteLeadgenSavedView(workspaceId, viewId);
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function bulkUpdateLeadgenStatusAction(input: {
  opportunityIds: string[];
  nextStatus: LeadOpportunityWorkflowStatus;
  note?: string;
}) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid bulk status payload." };
  const updated = await bulkUpdateLeadgenStatus(
    workspaceId,
    parsed.data.opportunityIds,
    parsed.data.nextStatus,
    parsed.data.note,
  );
  revalidatePath("/leadgen");
  return { ok: true, updated };
}

export async function addLeadgenActivityNoteAction(opportunityId: string, note: string) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  if (!note.trim()) return { ok: false, error: "Note cannot be empty." };
  await createLeadgenActivity(workspaceId, opportunityId, "note_added", note.trim());
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function markLeadgenExportedAction(opportunityIds: string[]) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const updated = await bulkUpdateLeadgenStatus(workspaceId, opportunityIds, "exported", "Marked as exported.");
  for (const id of opportunityIds) {
    await createLeadgenActivity(workspaceId, id, "exported_csv", "Exported from LeadGen command center.");
  }
  revalidatePath("/leadgen");
  return { ok: true, updated };
}

export async function getLeadgenAuditPreflightAction(opportunityIds: string[]) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const normalizedIds = normalizeSelectedOpportunityIds(opportunityIds);
  const entitlement = await enforceAuditGeneration(workspaceId);
  const monthlyCredits = await getWorkspaceMonthlyCreditAllocation(workspaceId);
  const preflight = buildLeadgenAuditPreflight(normalizedIds.length, entitlement.remaining, {
    batchLimit: LEADGEN_AUDIT_BATCH_LIMIT,
    requiresApproval: true,
    monthlyCreditRemaining: monthlyCredits.remainingCredits,
  });
  return {
    ok: true,
    preflight,
    entitlement: {
      allowed: entitlement.allowed,
      remaining: entitlement.remaining,
      used: entitlement.used,
      limit: entitlement.limit,
    },
    monthlyCredits,
  };
}

export async function queueLeadgenAuditGenerationAction(opportunityIds: string[]) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId, workspaceSlug } = await getWorkspaceContext();
  const normalizedIds = normalizeSelectedOpportunityIds(opportunityIds);
  const useDemoPath = shouldShowDemoBanner({ workspaceSlug });
  const entitlement = await enforceAuditGeneration(workspaceId);
  const monthlyCredits = await getWorkspaceMonthlyCreditAllocation(workspaceId);
  const preflight = buildLeadgenAuditPreflight(normalizedIds.length, entitlement.remaining, {
    batchLimit: LEADGEN_AUDIT_BATCH_LIMIT,
    requiresApproval: true,
    monthlyCreditRemaining: monthlyCredits.remainingCredits,
  });
  if (!preflight.canQueue) {
    if (preflight.warning === LEADGEN_PREFLIGHT_LIMIT_ERROR) {
      throw new Error(LEADGEN_PREFLIGHT_LIMIT_ERROR);
    }
    return { ok: false, error: "Cannot queue selected leads.", preflight };
  }

  const candidates = await resolveLeadgenQueueDispatchCandidates(workspaceId, normalizedIds);
  let dispatched = 0;
  for (const candidate of candidates) {
    const marker = `[leadgen-opportunity:${candidate.opportunityId}]`;
    const existingDispatch = await prisma.researchQueueItem.findFirst({
      where: {
        ...strictWorkspaceScope(workspaceId),
        source: LEADGEN_AUDIT_DISPATCH_SOURCE,
        notes: { contains: marker },
      },
      select: { id: true },
    });
    if (existingDispatch) continue;
    await prisma.researchQueueItem.create({
      data: {
        workspaceId,
        businessName: candidate.businessName,
        websiteUrl: candidate.websiteUrl,
        location: candidate.location,
        category: candidate.category,
        phone: candidate.phone,
        email: candidate.email,
        notes: buildDispatchNotes(candidate, useDemoPath),
        source: LEADGEN_AUDIT_DISPATCH_SOURCE,
        priority: candidate.priority,
        status: "Queued",
      },
    });
    dispatched += 1;
  }

  const queuedIds = candidates.map((candidate) => candidate.opportunityId);
  const updated = queuedIds.length
    ? await bulkUpdateLeadgenStatus(
        workspaceId,
        queuedIds,
        "queued",
        "Queued for audit generation preflight and dispatched to research queue.",
      )
    : 0;
  for (const id of queuedIds) {
    await createLeadgenActivity(
      workspaceId,
      id,
      "audit_generation_requested",
      "Audit generation requested and queued for approval.",
    );
    await createLeadgenActivity(
      workspaceId,
      id,
      "audit_generation_requires_approval",
      useDemoPath
        ? "Dispatched via demo-safe mock audit payload path."
        : "Dispatched to production research queue; live generation remains approval-gated.",
    );
  }
  revalidatePath("/leadgen");
  revalidatePath("/research");
  return { ok: true, queued: updated, dispatched, preflight, mode: useDemoPath ? "demo" : "production" };
}
