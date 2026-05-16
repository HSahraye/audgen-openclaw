"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { enforceAuditGeneration } from "@/lib/billing/entitlements";
import { buildLeadgenAuditPreflight } from "@/lib/leadgen/audit-preflight";
import {
  bulkUpdateLeadgenStatus,
  createLeadgenActivity,
  createLeadgenSavedView,
  deleteLeadgenSavedView,
  saveLeadgenOpportunities,
} from "@/lib/leadgen/persistence";
import type { LeadOpportunity, LeadOpportunityFilters, LeadOpportunityWorkflowStatus } from "@/lib/leadgen/types";
import { getWorkspaceContext } from "@/lib/workspace";

const savedViewSchema = z.object({
  name: z.string().min(2).max(80),
  filters: z.custom<LeadOpportunityFilters>(),
});

const bulkStatusSchema = z.object({
  opportunityIds: z.array(z.string().min(1)).min(1),
  nextStatus: z.custom<LeadOpportunityWorkflowStatus>(),
  note: z.string().max(600).optional(),
});

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
      "Lead added to AudGen queue.",
    );
  }
  const updated = await bulkUpdateLeadgenStatus(
    workspaceId,
    opportunities.map((lead) => lead.id),
    "queued",
    "Queued for AudGen workflow.",
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
  const entitlement = await enforceAuditGeneration(workspaceId);
  const preflight = buildLeadgenAuditPreflight(opportunityIds.length, entitlement.remaining, {
    batchLimit: 20,
    requiresApproval: true,
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
  };
}

export async function queueLeadgenAuditGenerationAction(opportunityIds: string[]) {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const entitlement = await enforceAuditGeneration(workspaceId);
  const preflight = buildLeadgenAuditPreflight(opportunityIds.length, entitlement.remaining, {
    batchLimit: 20,
    requiresApproval: true,
  });
  if (!preflight.canQueue) {
    return { ok: false, error: preflight.warning ?? "Cannot queue selected leads.", preflight };
  }
  const updated = await bulkUpdateLeadgenStatus(
    workspaceId,
    opportunityIds,
    "queued",
    "Queued for audit generation preflight (approval required).",
  );
  for (const id of opportunityIds) {
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
      "Live audit generation is disabled in phase 2 until approval.",
    );
  }
  revalidatePath("/leadgen");
  return { ok: true, queued: updated, preflight };
}
