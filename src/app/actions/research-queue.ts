"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateAudit } from "@/lib/audit-engine";
import { enforceAuditGeneration, ensureWorkspaceOperational } from "@/lib/billing/entitlements";
import { incrementUsageMetric } from "@/lib/billing/usage";
import { parseCsv } from "@/lib/csv";
import { pickLeadgenCsvField } from "@/lib/leadgen/csv-header-aliases";
import { trackProductAnalytics } from "@/lib/analytics/product";
import { markOnboardingMilestone } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { trackEvent } from "@/lib/events";
import { generateUniqueAuditSlug } from "@/lib/audit-slugs";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

const queueStatuses = ["Queued", "Researching", "Audited", "Converted", "Skipped"] as const;

const queueItemSchema = z.object({
  businessName: z.string().min(1),
  websiteUrl: z.string().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
});

const queueStatusSchema = z.object({ id: z.string().min(1), status: z.enum(queueStatuses) });

function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|\t]\s*/);
      if (parts.length > 1) {
        return {
          businessName: parts[0] ?? "",
          websiteUrl: parts[1] ?? "",
          location: parts[2] ?? "",
          category: parts[3] ?? "",
          phone: parts[4] ?? "",
          email: parts[5] ?? "",
          notes: parts.slice(6).join(" | "),
        };
      }
      return { businessName: line, notes: "Manual research queue paste" };
    });
}

function normalizeWebsite(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

export async function addResearchQueueItemsAction(_prevState: unknown, formData: FormData) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const rawText = String(formData.get("items") ?? "");
  const source = String(formData.get("source") ?? "manual paste");
  const priority = Number(formData.get("priority") ?? 3);
  if (!rawText.trim()) return { ok: false, added: 0, skipped: 0, error: "Paste business names, pipe-separated rows, or CSV data first." };

  const looksLikeCsv = rawText.split(/\r?\n/)[0]?.includes(",");
  const rows = looksLikeCsv
    ? parseCsv(rawText).map((row) => ({
        businessName: pickLeadgenCsvField(row, "businessName"),
        websiteUrl: pickLeadgenCsvField(row, "website"),
        location: pickLeadgenCsvField(row, "location"),
        category: pickLeadgenCsvField(row, "category"),
        phone: pickLeadgenCsvField(row, "phone"),
        email: pickLeadgenCsvField(row, "email"),
        notes: pickLeadgenCsvField(row, "notes"),
      }))
    : parseLines(rawText);

  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    const parsed = queueItemSchema.safeParse({ ...row, source, priority });
    if (!parsed.success) {
      skipped += 1;
      continue;
    }

    const websiteKey = normalizeWebsite(parsed.data.websiteUrl);
    const existing = await prisma.researchQueueItem.findFirst({
      where: {
        ...withWorkspaceFallbackScope(workspaceId),
        OR: [
          websiteKey ? { websiteUrl: { contains: websiteKey } } : undefined,
          parsed.data.location ? { AND: [{ businessName: parsed.data.businessName }, { location: parsed.data.location }] } : { businessName: parsed.data.businessName },
        ].filter(Boolean) as Array<{ websiteUrl?: { contains: string }; businessName?: string; AND?: [{ businessName: string }, { location: string }] }>,
      },
    });

    if (existing && (!websiteKey || normalizeWebsite(existing.websiteUrl) === websiteKey || existing.businessName === parsed.data.businessName)) {
      skipped += 1;
      continue;
    }

    await prisma.researchQueueItem.create({
      data: {
        workspaceId,
        ...parsed.data,
        websiteUrl: parsed.data.websiteUrl || null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        source: parsed.data.source || null,
      },
    });
    added += 1;
  }

  revalidatePath("/research");
  await writeAuditLog({ action: "research.queue.add", actorRole, metadata: { added, skipped }, workspaceId });
  return { ok: true, added, skipped, error: "" };
}

export async function updateResearchQueueStatusAction(id: string, status: string) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = queueStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid queue status." };
  await prisma.researchQueueItem.updateMany({ where: { id: parsed.data.id, ...withWorkspaceFallbackScope(workspaceId) }, data: { status: parsed.data.status } });
  revalidatePath("/research");
  await writeAuditLog({ action: "research.queue.status", actorRole, leadId: parsed.data.id, metadata: { status: parsed.data.status }, workspaceId });
  return { ok: true };
}

export async function convertQueueItemToLeadAction(id: string) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const workspaceState = await ensureWorkspaceOperational(workspaceId);
  if (!workspaceState.ok) return { ok: false, error: workspaceState.reason };
  const entitlement = await enforceAuditGeneration(workspaceId);
  if (!entitlement.allowed) return { ok: false, error: entitlement.reason || "Audit generation limit reached." };
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid queue item." };

  const item = await prisma.researchQueueItem.findFirst({ where: { id: parsed.data, ...withWorkspaceFallbackScope(workspaceId) } });
  if (!item) return { ok: false, error: "Queue item not found." };

  const existingLead = await prisma.lead.findFirst({
    where: {
      ...withWorkspaceFallbackScope(workspaceId),
      OR: [
        item.websiteUrl ? { websiteUrl: item.websiteUrl } : undefined,
        item.location ? { AND: [{ businessName: item.businessName }, { location: item.location }] } : { businessName: item.businessName },
      ].filter(Boolean) as Array<{ websiteUrl?: string; businessName?: string; AND?: [{ businessName: string }, { location: string }] }>,
    },
  });
  if (existingLead) {
    await prisma.researchQueueItem.updateMany({ where: { id: item.id, ...withWorkspaceFallbackScope(workspaceId) }, data: { status: "Converted", convertedLeadId: existingLead.id } });
    revalidatePath("/research");
    return { ok: true, leadId: existingLead.id, reused: true };
  }

  const audit = await generateAudit({
    businessName: item.businessName,
    category: item.category ?? undefined,
    location: item.location ?? undefined,
    websiteUrl: item.websiteUrl ?? undefined,
    notes: item.notes ?? undefined,
    workspaceId,
  });
  const shortSlug = await generateUniqueAuditSlug(item.businessName);

  const lead = await prisma.lead.create({
    data: {
      workspaceId,
      shortSlug,
      businessName: item.businessName,
      category: item.category,
      location: item.location,
      websiteUrl: item.websiteUrl,
      googleProfileUrl: null,
      phone: item.phone,
      email: item.email,
      notes: item.notes,
      status: "New",
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
      intelligenceJson: JSON.stringify(audit.intelligence, null, 2),
      generatedContextJson: audit.generatedContext ? JSON.stringify(audit.generatedContext, null, 2) : null,
    },
  });

  await prisma.researchQueueItem.updateMany({ where: { id: item.id, ...withWorkspaceFallbackScope(workspaceId) }, data: { status: "Converted", convertedLeadId: lead.id } });
  revalidatePath("/");
  revalidatePath("/research");
  await incrementUsageMetric({ workspaceId, metric: "audits_generated", amount: 1, metadata: { source: "research_convert" } });
  await incrementUsageMetric({ workspaceId, metric: "proposal_generations", amount: 1, metadata: { source: "research_convert" } });
  await incrementUsageMetric({ workspaceId, metric: "outreach_generations", amount: 1, metadata: { source: "research_convert" } });
  await incrementUsageMetric({ workspaceId, metric: "active_leads", amount: 1, metadata: { source: "research_convert" } });
  await markOnboardingMilestone(workspaceId, "first_audit_generated", { leadId: lead.id });
  await trackProductAnalytics({
    workspaceId,
    leadId: lead.id,
    event: "activation.audit_generated",
    properties: { source: "research_queue" },
  });
  await trackEvent("lead_created", { leadId: lead.id, source: "research-queue" }, lead.id, workspaceId);
  await writeAuditLog({ action: "research.queue.convert", actorRole, leadId: lead.id, metadata: { queueItemId: item.id }, workspaceId });
  return { ok: true, leadId: lead.id, reused: false };
}
