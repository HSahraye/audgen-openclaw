"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionRole } from "@/lib/auth";
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
  resolveLeadgenOpportunityDbIds,
  saveLeadgenOpportunities,
} from "@/lib/leadgen/persistence";
import { discoverLeadgenOpportunities } from "@/lib/leadgen/sources";
import type { LeadOpportunity, LeadOpportunityFilters, LeadOpportunityWorkflowStatus } from "@/lib/leadgen/types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { strictWorkspaceScope } from "@/lib/workspace";

// Typed result + banner-decision helper live in a sibling non-"use server"
// module so the strict server-actions compiler does not reject them.
// See src/app/actions/leadgen-result.ts.
import type { AddLeadgenSkipReason, AddSelectedLeadgenResult } from "@/app/actions/leadgen-result";

const savedViewSchema = z.object({
  name: z.string().min(2).max(80),
  filters: z.custom<LeadOpportunityFilters>(),
});

const bulkStatusSchema = z.object({
  opportunityIds: z.array(z.string().min(1)).min(1),
  nextStatus: z.custom<LeadOpportunityWorkflowStatus>(),
  note: z.string().max(600).optional(),
});

const discoveryQuerySchema = z.object({
  query: z.string().trim().min(3).max(160),
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
): Promise<AddSelectedLeadgenResult> {
  // SECURITY: session-derived workspaceId. See SECURITY note on /leadgen page.
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "member"]);

  // 1. INPUT VALIDATION. Guard against empty arrays and malformed entries.
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return {
      ok: false,
      added: 0,
      skipped: 0,
      total: 0,
      reason: "invalid_input",
      message: "Select at least one lead before adding to the queue.",
    };
  }
  const valid = opportunities.filter((lead): lead is LeadOpportunity =>
    Boolean(lead && typeof lead.id === "string" && lead.id.length > 0),
  );
  const invalidCount = opportunities.length - valid.length;

  // 2. CROSS-WORKSPACE GUARD. Defense-in-depth on top of b8a3975. If a
  // selected lead carries a `workspaceId` field tagging it to a tenant
  // OTHER than the caller's session workspace, drop it explicitly with
  // a typed reason rather than silently writing it under the caller's
  // workspaceId (which would re-introduce the cross-tenant leak by way
  // of accidental migration). Sandbox/discovery leads have no
  // workspaceId on them and pass through cleanly.
  type MaybeScoped = LeadOpportunity & { workspaceId?: string | null };
  const crossWorkspace = valid.filter((lead) => {
    const scoped = lead as MaybeScoped;
    return typeof scoped.workspaceId === "string" && scoped.workspaceId.length > 0 && scoped.workspaceId !== workspaceId;
  });
  const inWorkspace = valid.filter((lead) => !crossWorkspace.includes(lead));

  // 3. CANONICAL WRITE. saveLeadgenOpportunities is the upsert path that
  // really persists the lead under the caller's workspaceId. The
  // follow-up bulkUpdateLeadgenStatus is kept ONLY for its activity-log
  // side effect; we no longer use its return count for the user-facing
  // "added" number because the legacy researchQueueItem fallback
  // queries by cuid and never finds discovery-side ids — that
  // mismatch is what caused the production "Added 0 of 14" bug.
  let added = 0;
  if (inWorkspace.length > 0) {
    const now = new Date().toISOString();
    await saveLeadgenOpportunities(
      workspaceId,
      inWorkspace.map((lead) => ({ ...lead, status: "queued", lastActionAt: now })),
    );

    // Translate the inbound IDs (which for live Google Places / Yelp
    // discovery are SYNTHETIC ids stored in LeadgenOpportunity.externalId,
    // not the dedicated-table cuid stored in id) into the dbId required
    // by the LeadgenActivityLog.opportunityId foreign key. Without this
    // step the activity write violates LeadgenActivityLog_opportunityId_fkey
    // (production reproducer: cafe in alameda ca, 2026-05-18T11:26:01Z).
    const inboundIds = inWorkspace.map((lead) => lead.id);
    const dbIdMap = await resolveLeadgenOpportunityDbIds(workspaceId, inboundIds);

    for (const lead of inWorkspace) {
      const dbId = dbIdMap.get(lead.id);
      if (!dbId) {
        // saveLeadgenOpportunities upserted the row (or threw above), so
        // a missing entry here means schema drift, a race, or a
        // dedicated/legacy mode boundary we did not anticipate. Skip
        // the activity write rather than passing the synthetic ID
        // through — that would re-trigger the production FK crash.
        // The lead itself is still persisted; we only lose the
        // human-readable activity-log entry.
        logger.warn("leadgen_add_selected_activity_skipped_no_dbid", {
          workspaceId,
          inboundId: lead.id,
        });
        continue;
      }
      try {
        await createLeadgenActivity(
          workspaceId,
          dbId,
          "added_to_audgen_queue",
          `Lead added to ${BRANDING_CONFIG.appName} queue.`,
        );
      } catch (error) {
        // Per-lead defensive catch: an FK or other persistence failure
        // on a single activity row must not crash the entire batch
        // import. The opportunity is already persisted at this point.
        logger.warn("leadgen_add_selected_activity_failed", {
          workspaceId,
          inboundId: lead.id,
          dbId,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    // Best-effort status pass for previously-existing rows. Failure of
    // this pass MUST NOT zero out the user-facing count — the rows are
    // already persisted by saveLeadgenOpportunities above. (Note:
    // bulkUpdateLeadgenStatus does its own OR-lookup over (id, externalId)
    // so it is safe to call with the synthetic inbound IDs.)
    try {
      await bulkUpdateLeadgenStatus(
        workspaceId,
        inboundIds,
        "queued",
        `Queued for ${BRANDING_CONFIG.appName} workflow.`,
      );
    } catch (error) {
      logger.warn("leadgen_bulk_status_pass_failed", {
        workspaceId,
        count: inWorkspace.length,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    added = inWorkspace.length;
  }

  revalidatePath("/leadgen");
  revalidatePath("/research");

  const skipped = crossWorkspace.length + invalidCount;
  const total = opportunities.length;
  let reason: AddLeadgenSkipReason = "none";
  if (added === 0 && total > 0) {
    reason = crossWorkspace.length > 0 ? "cross_workspace" : "invalid_input";
  } else if (skipped > 0) {
    reason = crossWorkspace.length > 0 ? "cross_workspace" : "invalid_input";
  }

  // Compose the user-facing message. The UI banner color is selected
  // from { added, skipped, reason } on the client (see leadgen-command-center).
  let message: string;
  if (added > 0 && skipped === 0) {
    message = `Added ${added} lead${added === 1 ? "" : "s"} to ${BRANDING_CONFIG.appName} queue.`;
  } else if (added > 0 && skipped > 0) {
    if (reason === "cross_workspace") {
      message = `Added ${added} of ${total} leads. ${skipped} belong to another workspace and were skipped.`;
    } else {
      message = `Added ${added} of ${total} leads. ${skipped} were invalid and were skipped.`;
    }
  } else {
    if (reason === "cross_workspace") {
      message = `${total} lead${total === 1 ? "" : "s"} could not be added — they belong to another workspace.`;
    } else if (reason === "invalid_input") {
      message = invalidCount === total
        ? `Selection contained no valid leads.`
        : `No leads were added. Please retry the discovery and try again.`;
    } else {
      message = `No leads were added.`;
    }
  }

  if (added === 0) {
    logger.warn("leadgen_add_selected_zero_added", {
      workspaceId,
      total,
      invalidCount,
      crossWorkspace: crossWorkspace.length,
      reason,
    });
  }

  return { ok: added > 0, added, skipped, total, reason, message };
}

export async function persistLeadgenOpportunitiesAction(opportunities: LeadOpportunity[]) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  await saveLeadgenOpportunities(workspaceId, opportunities);
  revalidatePath("/leadgen");
  return { ok: true, count: opportunities.length };
}

export async function saveLeadgenViewAction(name: string, filters: LeadOpportunityFilters) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const parsed = savedViewSchema.safeParse({ name, filters });
  if (!parsed.success) return { ok: false, error: "Invalid saved view." };
  await createLeadgenSavedView(workspaceId, parsed.data.name, parsed.data.filters);
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function deleteLeadgenViewAction(viewId: string) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  await deleteLeadgenSavedView(workspaceId, viewId);
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function bulkUpdateLeadgenStatusAction(input: {
  opportunityIds: string[];
  nextStatus: LeadOpportunityWorkflowStatus;
  note?: string;
}) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
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
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  if (!note.trim()) return { ok: false, error: "Note cannot be empty." };
  await createLeadgenActivity(workspaceId, opportunityId, "note_added", note.trim());
  revalidatePath("/leadgen");
  return { ok: true };
}

export async function markLeadgenExportedAction(opportunityIds: string[]) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const updated = await bulkUpdateLeadgenStatus(workspaceId, opportunityIds, "exported", "Marked as exported.");
  for (const id of opportunityIds) {
    await createLeadgenActivity(workspaceId, id, "exported_csv", "Exported from LeadGen command center.");
  }
  revalidatePath("/leadgen");
  return { ok: true, updated };
}

export async function discoverLeadgenOpportunitiesAction(query: string) {
  // Auth-gate only — discovery itself is workspace-agnostic (no DB write).
  await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const parsed = discoveryQuerySchema.safeParse({ query });
  if (!parsed.success) return { ok: false as const, error: "Add a city and category to run discovery." };
  const discovered = await discoverLeadgenOpportunities(parsed.data.query);
  return {
    ok: true as const,
    query: discovered.query,
    leads: discovered.leads,
    count: discovered.leads.length,
    providerWarning: discovered.providerWarnings[0] ?? null,
  };
}

export async function getLeadgenAuditPreflightAction(opportunityIds: string[]) {
  const { workspaceId } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
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
  const { workspaceId, workspaceSlug } = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
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
