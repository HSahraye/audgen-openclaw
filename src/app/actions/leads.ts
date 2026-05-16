"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { generateAudit } from "@/lib/audit-engine";
import {
  enforceAuditGeneration,
  enforceImportLimit,
  ensureWorkspaceOperational,
} from "@/lib/billing/entitlements";
import { incrementUsageMetric, setUsageMetric } from "@/lib/billing/usage";
import { parseCsv, pick } from "@/lib/csv";
import { processImportJobChunk } from "@/lib/import-jobs";
import { trackProductAnalytics } from "@/lib/analytics/product";
import { markOnboardingMilestone } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { trackSalesOsEvent } from "@/lib/analytics/events";
import { writeAuditLog } from "@/lib/audit-log";
import { trackEvent } from "@/lib/events";
import { sendCrmWebhook } from "@/lib/crm";
import { generateUniqueAuditSlug, normalizeAuditSlug } from "@/lib/audit-slugs";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

const leadStatuses = ["New", "Contacted", "Follow-up", "Won", "Lost"] as const;
const MAX_SYNC_AUDIT_ROWS_PER_IMPORT = 50;

import { leadFormSchema } from "@/lib/leads/form-schema";
const formSchema = leadFormSchema;

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(leadStatuses),
});

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().max(4000).optional(),
});

const offerSchema = z.object({
  id: z.string().min(1),
  packageName: z.string().min(1).max(200),
  customPrice: z.coerce.number().int().min(0).max(100000).optional(),
  attachedCaseStudyId: z.string().optional(),
  stripePaymentUrl: z.string().url().optional().or(z.literal("")),
});

const outreachSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["Email", "Call", "SMS", "Share", "Note"]),
  notes: z.string().max(2000).optional(),
  nextFollowUpAt: z.string().optional(),
});

const shortSlugSchema = z.object({
  id: z.string().min(1),
  shortSlug: z
    .string()
    .min(1, "Short slug is required.")
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Short slug can include lowercase letters, numbers, and hyphens only."),
});

function normalizeWebsiteKey(value?: string) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export async function createLeadAction(_prevState: unknown, formData: FormData) {
  try {
    const actorRole = await requireRole(["admin", "sales"]);
    const { workspaceId } = await getWorkspaceContext();
    const workspaceState = await ensureWorkspaceOperational(workspaceId);
    if (!workspaceState.ok) return { ok: false, error: workspaceState.reason || "Workspace is not operational." };
    const entitlement = await enforceAuditGeneration(workspaceId);
    if (!entitlement.allowed) return { ok: false, error: entitlement.reason || "Audit generation limit reached." };
    const parsed = formSchema.safeParse({
      businessName: formData.get("businessName"),
      ownerName: formData.get("ownerName"),
      category: formData.get("category"),
      location: formData.get("location"),
      websiteUrl: formData.get("websiteUrl"),
      googleProfileUrl: formData.get("googleProfileUrl"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Please provide valid lead details." };
    }

    const audit = await generateAudit({ ...parsed.data, workspaceId });
    const shortSlug = await generateUniqueAuditSlug(parsed.data.businessName);

    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        workspaceId,
        shortSlug,
        ownerName: parsed.data.ownerName || null,
        websiteUrl: parsed.data.websiteUrl || null,
        googleProfileUrl: parsed.data.googleProfileUrl || null,
        category: parsed.data.category || null,
        location: parsed.data.location || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
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

    revalidatePath("/");
    await writeAuditLog({ action: "lead.create", actorRole, leadId: lead.id, metadata: { source: "manual" }, workspaceId });
    await trackEvent("lead_created", { leadId: lead.id, source: "manual" }, lead.id, workspaceId);
    await trackSalesOsEvent({
      eventType: "audit_generated",
      workspaceId,
      leadId: lead.id,
      payload: {
        source: "manual_create",
        templateAuditId: audit.generatedContext?.templates.audit.id ?? null,
        templateOutreachId: audit.generatedContext?.templates.outreach.id ?? null,
        templateOfferId: audit.generatedContext?.templates.offer.id ?? null,
      },
    });
    await incrementUsageMetric({ workspaceId, metric: "audits_generated", amount: 1, metadata: { source: "manual_create" } });
    await incrementUsageMetric({ workspaceId, metric: "proposal_generations", amount: 1, metadata: { source: "manual_create" } });
    await incrementUsageMetric({ workspaceId, metric: "outreach_generations", amount: 1, metadata: { source: "manual_create" } });
    await incrementUsageMetric({ workspaceId, metric: "active_leads", amount: 1, metadata: { source: "manual_create" } });
    await markOnboardingMilestone(workspaceId, "first_audit_generated", { leadId: lead.id });
    await trackProductAnalytics({
      workspaceId,
      leadId: lead.id,
      event: "activation.audit_generated",
      properties: { source: "manual_create" },
    });
    await sendCrmWebhook("lead_created", { leadId: lead.id, businessName: lead.businessName });
    return { ok: true, leadId: lead.id };
  } catch (error) {
    logger.error("create_lead_action_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof Error && error.message.trim() ? error.message : "Could not create lead. Please try again.",
    };
  }
}

export async function updateLeadStatusAction(id: string, status: string) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid lead status update." };

  await prisma.lead.updateMany({
    where: { id: parsed.data.id, ...withWorkspaceFallbackScope(workspaceId) },
    data: { status: parsed.data.status },
  });
  const activeLeadCount = await prisma.lead.count({
    where: {
      ...withWorkspaceFallbackScope(workspaceId),
      status: { notIn: ["Won", "Lost"] },
    },
  });
  await setUsageMetric({ workspaceId, metric: "active_leads", quantity: activeLeadCount });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  await writeAuditLog({ action: "lead.status.update", actorRole, leadId: parsed.data.id, metadata: { status: parsed.data.status }, workspaceId });
  await trackSalesOsEvent({ eventType: "lead_progressed", workspaceId, leadId: parsed.data.id, payload: { status: parsed.data.status } });
  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.id,
    eventType: "lead_status_changed",
    payload: { status: parsed.data.status },
  });
  return { ok: true };
}

export async function updateLeadOfferAction(_prevState: unknown, formData: FormData) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = offerSchema.safeParse({
    id: formData.get("id"),
    packageName: formData.get("packageName"),
    customPrice: formData.get("customPrice") || undefined,
    attachedCaseStudyId: formData.get("attachedCaseStudyId") || undefined,
    stripePaymentUrl: formData.get("stripePaymentUrl") || "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid offer update.", leadId: "" };

  const updateResult = await prisma.lead.updateMany({
    where: { id: parsed.data.id, ...withWorkspaceFallbackScope(workspaceId) },
    data: {
      packageName: parsed.data.packageName,
      customPrice: parsed.data.customPrice && parsed.data.customPrice > 0 ? parsed.data.customPrice : null,
      attachedCaseStudyId: parsed.data.attachedCaseStudyId || null,
      stripePaymentUrl: parsed.data.stripePaymentUrl || null,
    },
  });
  if (updateResult.count === 0) {
    return { ok: false, error: "Lead not found in the active workspace.", leadId: parsed.data.id };
  }

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  revalidatePath(`/prep/${parsed.data.id}`);
  await writeAuditLog({
    action: "lead.offer.update",
    actorRole,
    leadId: parsed.data.id,
    metadata: { packageName: parsed.data.packageName, customPrice: parsed.data.customPrice ?? null },
    workspaceId,
  });
  if (parsed.data.stripePaymentUrl) {
    await markOnboardingMilestone(workspaceId, "first_payment_link_sent", { leadId: parsed.data.id });
  }
  return { ok: true, leadId: parsed.data.id };
}

export async function updateLeadNotesAction(formData: FormData) {
  const actorRole = await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = notesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid notes update." };

  await prisma.lead.updateMany({
    where: { id: parsed.data.id, ...withWorkspaceFallbackScope(workspaceId) },
    data: { notes: parsed.data.notes || null },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  await writeAuditLog({ action: "lead.notes.update", actorRole, leadId: parsed.data.id, workspaceId });
  return { ok: true, leadId: parsed.data.id };
}

export async function logOutreachAction(id: string, type: "Email" | "Call" | "SMS" | "Share" | "Note", notes?: string, nextFollowUpAt?: string) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = outreachSchema.safeParse({ id, type, notes, nextFollowUpAt });
  if (!parsed.success) return { ok: false, error: "Invalid outreach log." };

  const followUpDate = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
  await prisma.$transaction([
    prisma.outreachLog.create({
      data: {
        workspaceId,
        leadId: parsed.data.id,
        type: parsed.data.type,
        notes: parsed.data.notes || null,
      },
    }),
    prisma.lead.updateMany({
      where: { id: parsed.data.id, ...withWorkspaceFallbackScope(workspaceId) },
      data: {
        status: parsed.data.type === "Note" ? undefined : "Contacted",
        lastContactedAt: parsed.data.type === "Note" ? undefined : new Date(),
        nextFollowUpAt: followUpDate && !Number.isNaN(followUpDate.getTime()) ? followUpDate : undefined,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/call-today");
  await trackEvent("lead_outreach_logged", { leadId: id, type }, id, workspaceId);
  if (type !== "Note") {
    await incrementUsageMetric({ workspaceId, metric: "outreach_generations", amount: 1, metadata: { type } });
    await markOnboardingMilestone(workspaceId, "first_outreach_generated", { leadId: id, type });
    await trackProductAnalytics({
      workspaceId,
      leadId: id,
      event: "feature.outreach_logged",
      properties: { type },
    });
    await triggerWorkflows({
      workspaceId,
      leadId: id,
      eventType: "outreach_logged",
      payload: { type },
    });
  }
  await writeAuditLog({ action: "lead.outreach.log", actorRole, leadId: id, metadata: { type }, workspaceId });
  return { ok: true };
}

export async function regenerateLeadAction(id: string, notes?: string) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const workspaceState = await ensureWorkspaceOperational(workspaceId);
  if (!workspaceState.ok) return { ok: false, error: workspaceState.reason };
  const entitlement = await enforceAuditGeneration(workspaceId);
  if (!entitlement.allowed) return { ok: false, error: entitlement.reason || "Audit generation limit reached." };
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid lead id." };

  const parsedNotes = z.string().max(4000).optional().safeParse(notes);
  if (!parsedNotes.success) return { ok: false, error: "Notes are too long." };

  const lead = await prisma.lead.findFirst({ where: { id: parsed.data, ...withWorkspaceFallbackScope(workspaceId) } });
  if (!lead) return { ok: false, error: "Lead not found." };

  const currentNotes = parsedNotes.data ?? lead.notes ?? undefined;
  const audit = await generateAudit({
    businessName: lead.businessName,
    ownerName: lead.ownerName ?? undefined,
    category: lead.category ?? undefined,
    location: lead.location ?? undefined,
    websiteUrl: lead.websiteUrl ?? undefined,
    googleProfileUrl: lead.googleProfileUrl ?? undefined,
    notes: currentNotes,
    workspaceId,
  });

  await prisma.lead.updateMany({
    where: { id: parsed.data, ...withWorkspaceFallbackScope(workspaceId) },
    data: {
      notes: currentNotes ?? null,
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
      intelligenceJson: JSON.stringify(audit.intelligence, null, 2),
      generatedContextJson: audit.generatedContext ? JSON.stringify(audit.generatedContext, null, 2) : null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data}`);
  await trackEvent("audit_regenerated", { leadId: parsed.data }, parsed.data, workspaceId);
  await trackSalesOsEvent({
    eventType: "audit_generated",
    workspaceId,
    leadId: parsed.data,
    payload: {
      source: "regenerate",
      templateAuditId: audit.generatedContext?.templates.audit.id ?? null,
      templateOutreachId: audit.generatedContext?.templates.outreach.id ?? null,
      templateOfferId: audit.generatedContext?.templates.offer.id ?? null,
    },
  });
  await incrementUsageMetric({ workspaceId, metric: "audits_generated", amount: 1, metadata: { source: "regenerate" } });
  await incrementUsageMetric({ workspaceId, metric: "proposal_generations", amount: 1, metadata: { source: "regenerate" } });
  await incrementUsageMetric({ workspaceId, metric: "outreach_generations", amount: 1, metadata: { source: "regenerate" } });
  await writeAuditLog({ action: "lead.audit.regenerate", actorRole, leadId: parsed.data, workspaceId });
  return { ok: true };
}

export async function importLeadsCsvAction(_prevState: unknown, formData: FormData) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const workspaceState = await ensureWorkspaceOperational(workspaceId);
  if (!workspaceState.ok) return { ok: false, imported: 0, skipped: 0, failed: 0, duplicateCount: 0, invalidCount: 0, limitSkipped: 0, queued: false, jobId: "", error: workspaceState.reason };
  const pastedCsv = String(formData.get("csvText") ?? "");
  const file = formData.get("csvFile");
  const fileCsv = file instanceof File && file.size > 0 ? await file.text() : "";
  const csvText = fileCsv || pastedCsv;

  if (!csvText.trim()) return { ok: false, imported: 0, skipped: 0, failed: 0, duplicateCount: 0, invalidCount: 0, limitSkipped: 0, queued: false, jobId: "", error: "Paste or upload CSV data first." };

  const rows = parseCsv(csvText);
  if (!rows.length) return { ok: false, imported: 0, skipped: 0, failed: 0, duplicateCount: 0, invalidCount: 0, limitSkipped: 0, queued: false, jobId: "", error: "No valid CSV rows found." };
  const importEntitlement = await enforceImportLimit(workspaceId);
  if (!importEntitlement.allowed) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicateCount: 0,
      invalidCount: 0,
      limitSkipped: 0,
      queued: false,
      jobId: "",
      error: importEntitlement.reason || "Import limit reached for this billing plan.",
    };
  }
  const auditEntitlement = await enforceAuditGeneration(workspaceId);
  if (!auditEntitlement.allowed) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicateCount: 0,
      invalidCount: 0,
      limitSkipped: 0,
      queued: false,
      jobId: "",
      error: auditEntitlement.reason || "Audit generation limit reached for this billing plan.",
    };
  }
  if (rows.length > auditEntitlement.remaining) {
    return {
      ok: false,
      imported: 0,
      skipped: rows.length,
      failed: 0,
      duplicateCount: 0,
      invalidCount: 0,
      queued: false,
      jobId: "",
      error: `This import has ${rows.length} rows but your current plan allows ${auditEntitlement.remaining} more audits this period.`,
      limitSkipped: rows.length - auditEntitlement.remaining,
    };
  }

  if (rows.length > MAX_SYNC_AUDIT_ROWS_PER_IMPORT) {
    const job = await prisma.importJob.create({
      data: {
        workspaceId,
        status: "Queued",
        mode: "full-audit",
        totalRows: rows.length,
        payloadJson: JSON.stringify(rows),
      },
    });
    void (async () => {
      const maxTicks = rows.length + 5;
      for (let tick = 0; tick < maxTicks; tick += 1) {
        const current = await processImportJobChunk(job.id, undefined, workspaceId);
        if (!current) break;
        if (current.status === "Completed" || current.status === "Failed") break;
      }
    })().catch(() => {
      // Intentionally swallowed: failures are captured in ImportJob state during chunk processing.
    });
    revalidatePath("/");
    return {
      ok: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicateCount: 0,
      invalidCount: 0,
      queued: true,
      jobId: job.id,
      error: `Queued ${rows.length} rows for background import. You can keep using the app while audits process.`,
      limitSkipped: 0,
    };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const businessName = pick(row, ["business name", "name", "business", "company"]);
    const websiteUrl = pick(row, ["website", "website url", "url", "site"]);
    const websiteKey = normalizeWebsiteKey(websiteUrl);
    const location = pick(row, ["city", "location", "area"]);
    const ownerName = pick(row, ["owner", "owner name", "contact", "contact name"]);
    const category = pick(row, ["industry/category", "industry", "category", "type"]);
    const phone = pick(row, ["phone", "phone number", "mobile"]);
    const email = pick(row, ["email", "email address"]);
    const notes = pick(row, ["notes", "note", "description"]);

    if (!businessName && !websiteUrl) {
      failed += 1;
      invalidCount += 1;
      errors.push(`Row ${index + 2}: missing business name and website.`);
      continue;
    }

    const candidates = await prisma.lead.findMany({
      where: {
        ...withWorkspaceFallbackScope(workspaceId),
        OR: [
          websiteUrl ? { websiteUrl: { contains: websiteKey || websiteUrl } } : undefined,
          businessName && location ? { AND: [{ businessName: { equals: businessName } }, { location }] } : undefined,
        ].filter(Boolean) as Array<{ websiteUrl?: { contains: string }; AND?: [{ businessName: { equals: string } }, { location: string }] }>,
      },
    });
    const existing = candidates.find((lead) => (websiteKey && normalizeWebsiteKey(lead.websiteUrl ?? "") === websiteKey) || (businessName && location && lead.businessName === businessName && lead.location === location));

    if (existing) {
      skipped += 1;
      duplicateCount += 1;
      continue;
    }

    try {
      const audit = await generateAudit({ businessName: businessName || websiteUrl, ownerName, category, location, websiteUrl, notes, workspaceId });
      const shortSlug = await generateUniqueAuditSlug(businessName || websiteUrl);
      await prisma.lead.create({
        data: {
          workspaceId,
          shortSlug,
          businessName: businessName || websiteUrl,
          ownerName: ownerName || null,
          category: category || null,
          location: location || null,
          websiteUrl: websiteUrl || null,
          googleProfileUrl: null,
          phone: phone || null,
          email: email || null,
          notes: notes || null,
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
      imported += 1;
      await incrementUsageMetric({ workspaceId, metric: "audits_generated", amount: 1, metadata: { source: "csv_import_sync" } });
      await incrementUsageMetric({ workspaceId, metric: "proposal_generations", amount: 1, metadata: { source: "csv_import_sync" } });
      await incrementUsageMetric({ workspaceId, metric: "outreach_generations", amount: 1, metadata: { source: "csv_import_sync" } });
      await incrementUsageMetric({ workspaceId, metric: "imported_leads", amount: 1, metadata: { source: "csv_import_sync" } });
      await incrementUsageMetric({ workspaceId, metric: "active_leads", amount: 1, metadata: { source: "csv_import_sync" } });
    } catch (error) {
      failed += 1;
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "import failed"}`);
    }
  }

  revalidatePath("/");
  const samples = errors.slice(0, 2).join(" ");
  const summary = `Imported ${imported}. Skipped ${skipped} (duplicates ${duplicateCount}, invalid ${invalidCount}). Failed ${failed}.${samples ? ` ${samples}` : ""}`;
  await writeAuditLog({ action: "lead.csv.import", actorRole, metadata: { totalRows: rows.length, imported, skipped, failed, duplicateCount, invalidCount }, workspaceId });
  if (imported > 0) {
    await markOnboardingMilestone(workspaceId, "first_import_completed", { imported });
    await trackProductAnalytics({
      workspaceId,
      event: "activation.import_completed",
      properties: { imported },
    });
  }
  return { ok: true, imported, skipped, failed, duplicateCount, invalidCount, limitSkipped: 0, queued: false, jobId: "", error: summary };
}

export async function deleteLeadAction(id: string) {
  const actorRole = await requireRole(["admin"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid lead id." };

  await prisma.lead.deleteMany({ where: { id: parsed.data, ...withWorkspaceFallbackScope(workspaceId) } });
  const activeLeads = await prisma.lead.count({
    where: {
      ...withWorkspaceFallbackScope(workspaceId),
      status: { notIn: ["Won", "Lost"] },
    },
  });
  await setUsageMetric({ workspaceId, metric: "active_leads", quantity: activeLeads });
  revalidatePath("/");
  await writeAuditLog({ action: "lead.delete", actorRole, leadId: parsed.data, workspaceId });
  return { ok: true };
}

export async function updateLeadShortSlugAction(_prevState: unknown, formData: FormData) {
  const actorRole = await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();
  const parsed = shortSlugSchema.safeParse({
    id: formData.get("id"),
    shortSlug: normalizeAuditSlug(String(formData.get("shortSlug") ?? "")),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid short slug.", leadId: "" };
  }

  try {
    await prisma.lead.updateMany({
      where: {
        id: parsed.data.id,
        ...withWorkspaceFallbackScope(workspaceId),
      },
      data: { shortSlug: parsed.data.shortSlug },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update short slug.";
    if (message.toLowerCase().includes("unique")) {
      return { ok: false, error: "This short slug is already in use.", leadId: parsed.data.id };
    }
    return { ok: false, error: message, leadId: parsed.data.id };
  }

  revalidatePath("/");
  revalidatePath(`/prep/${parsed.data.id}`);
  await writeAuditLog({
    action: "lead.short_slug.update",
    actorRole,
    leadId: parsed.data.id,
    metadata: { shortSlug: parsed.data.shortSlug },
    workspaceId,
  });
  return { ok: true, error: "", leadId: parsed.data.id };
}
