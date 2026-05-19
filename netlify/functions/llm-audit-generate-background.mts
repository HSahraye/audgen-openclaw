// Netlify Background Function — runs Claude Sonnet 4.6 audit generation
// asynchronously so the user-facing server action can return in <1s
// while the LLM (which takes 30-90 seconds) runs to completion.
//
// The `-background` suffix in the filename is what tells Netlify to
// run this in async mode: the HTTP response is sent immediately
// (status 202 Accepted) and the handler keeps running for up to 15
// minutes after the response.
//
// Auth model:
//   1. Caller (server action) computes HMAC-SHA256 over
//      "${leadId}:${workspaceId}:${timestamp}" using the shared
//      `AUDIT_INTERNAL_SECRET` env var.
//   2. Sends signature + timestamp + leadId + workspaceId as headers.
//   3. This handler validates the signature using the same secret and
//      a 5-minute freshness window (defends against replay).
//   4. ALSO loads the lead from the DB strictly scoped to the
//      claimed workspaceId — even if HMAC validation were bypassed,
//      the workspace boundary still applies.
//
// Behaviour:
//   - On success: writes the LLM-generated audit to Lead.auditJson +
//     assetsJson + intelligenceJson + generatedContextJson. Pending
//     marker is implicitly cleared because the new auditJson omits
//     it.
//   - On failure (LLM unavailable, schema validation fail, network
//     error): try/finally strips just the pending marker from the
//     existing auditJson + adds a one-line warning so the row
//     surfaces "audit regeneration failed; click Regenerate to try
//     again." The previous audit content is preserved so the user
//     doesn't lose work.
//
// Imports use the @/ alias path so esbuild resolves them through the
// project's tsconfig path mapping. The Background Function bundle
// includes Prisma + Anthropic SDK (configured in netlify.toml).
//
// CRITICAL: every import in this file MUST be runtime-agnostic.
// Standalone Netlify Functions do NOT include the Next.js runtime,
// so any transitive import of `next/headers` / `next/cookies` /
// `next/server` / `next/navigation` will crash the function at
// module-load with `ERR_MODULE_NOT_FOUND`. On 2026-05-19 ~12:43 PT
// this exact failure mode left the Mohka House lead stuck in
// "Generating..." for hours because the function imported
// `strictWorkspaceScope` from `@/lib/workspace`, which in turn
// imports `cookies` from `next/headers`. The fix moves the pure
// scope helpers into `@/lib/workspace-scope`. Pinned by
// `src/lib/workspace-runtime-isolation.test.ts`.

// Boot-time sentinel: prove module-load succeeded BEFORE the handler
// body runs. If this line never appears in Netlify function logs,
// the bundle is failing to load and a `next/*` import has crept
// back in (or some other top-level module-load error). Use this as
// the first signal in any "function silently dying" investigation.
console.log(
  JSON.stringify({ event: "bg_module_loaded", at: new Date().toISOString() }),
);

import { generateAudit } from "@/lib/audit-engine";
import {
  AUDIT_BACKGROUND_HEADERS,
  stripPendingMarker,
  verifyAuditBackgroundRequest,
} from "@/lib/audit/audit-async";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { strictWorkspaceScope } from "@/lib/workspace-scope";

export default async (req: Request): Promise<Response> => {
  const secret = process.env.AUDIT_INTERNAL_SECRET?.trim();
  if (!secret) {
    logger.error("audit_background_missing_secret", {});
    // Return 202 even when misconfigured so the caller (server action)
    // doesn't see a transient error in the response — it's
    // fire-and-forget on its end. The lead's pending marker will
    // simply expire after AUDIT_BACKGROUND_FRESHNESS_MS.
    return new Response(null, { status: 202 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const leadId = req.headers.get(AUDIT_BACKGROUND_HEADERS.leadId);
  const workspaceId = req.headers.get(AUDIT_BACKGROUND_HEADERS.workspaceId);
  const timestampRaw = req.headers.get(AUDIT_BACKGROUND_HEADERS.timestamp);
  const signature = req.headers.get(AUDIT_BACKGROUND_HEADERS.signature);
  const timestamp = Number(timestampRaw);

  if (!leadId || !workspaceId || !signature || !Number.isFinite(timestamp)) {
    logger.warn("audit_background_bad_request", {
      hasLeadId: Boolean(leadId),
      hasWorkspaceId: Boolean(workspaceId),
      hasSignature: Boolean(signature),
      timestampValid: Number.isFinite(timestamp),
    });
    return new Response("Bad request", { status: 400 });
  }

  const valid = verifyAuditBackgroundRequest(
    { leadId, workspaceId, timestamp },
    signature,
    secret,
  );
  if (!valid) {
    logger.warn("audit_background_signature_invalid", { leadId, workspaceId });
    return new Response("Forbidden", { status: 403 });
  }

  // Load the lead strictly scoped to the claimed workspace. If the
  // signed claim referenced a workspace the lead doesn't belong to
  // (e.g. via a tampered/replayed signature), the lookup returns
  // null and we exit cleanly.
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...strictWorkspaceScope(workspaceId) },
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      category: true,
      location: true,
      websiteUrl: true,
      googleProfileUrl: true,
      notes: true,
      auditJson: true,
    },
  });

  if (!lead) {
    logger.warn("audit_background_lead_not_found", { leadId, workspaceId });
    return new Response("Lead not found", { status: 404 });
  }

  logger.info("audit_background_started", { leadId, workspaceId });

  try {
    const audit = await generateAudit({
      businessName: lead.businessName,
      ownerName: lead.ownerName ?? undefined,
      category: lead.category ?? undefined,
      location: lead.location ?? undefined,
      websiteUrl: lead.websiteUrl ?? undefined,
      googleProfileUrl: lead.googleProfileUrl ?? undefined,
      notes: lead.notes ?? undefined,
      workspaceId,
    });

    // Replace Lead.auditJson + assetsJson with the freshly-generated
    // audit. The new auditJson omits `pending` and `requestedAt` so
    // the dashboard polling loop sees `audit.pending === false` and
    // stops polling automatically.
    await prisma.lead.updateMany({
      where: { id: leadId, ...strictWorkspaceScope(workspaceId) },
      data: {
        score: audit.assets.leadScore,
        packageName: audit.assets.recommendedPackage,
        painSummary: audit.assets.painPointSummary,
        auditJson: JSON.stringify({
          checks: audit.checks,
          websiteSignals: audit.websiteSignals,
          warnings: audit.warnings,
          source: audit.source,
          aiGenerated: audit.source === "claude",
          vertical: audit.generatedContext?.providerMetadata?.llmVertical ?? null,
          verticalDisplayName: audit.generatedContext?.providerMetadata?.llmVerticalDisplayName ?? null,
        }),
        assetsJson: JSON.stringify(audit.assets),
        intelligenceJson: JSON.stringify(audit.intelligence),
        generatedContextJson: audit.generatedContext ? JSON.stringify(audit.generatedContext) : null,
      },
    });

    logger.info("audit_background_succeeded", {
      leadId,
      workspaceId,
      source: audit.source,
      llmVertical: audit.generatedContext?.providerMetadata?.llmVertical ?? null,
    });
    return new Response(null, { status: 202 });
  } catch (err) {
    logger.error("audit_background_failed", {
      leadId,
      workspaceId,
      reason: err instanceof Error ? err.message.slice(0, 240) : "unknown",
    });

    // Best-effort cleanup: strip the pending marker + add a warning so
    // the dashboard doesn't show "Generating..." forever.
    try {
      const cleaned = stripPendingMarker(lead.auditJson);
      const parsed: Record<string, unknown> = (() => {
        try {
          const candidate = JSON.parse(cleaned);
          return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
        } catch {
          return {};
        }
      })();
      const warnings = Array.isArray(parsed.warnings) ? [...(parsed.warnings as unknown[])] : [];
      warnings.unshift("Last audit regeneration failed. Click Regenerate to try again.");
      parsed.warnings = warnings;
      await prisma.lead.updateMany({
        where: { id: leadId, ...strictWorkspaceScope(workspaceId) },
        data: { auditJson: JSON.stringify(parsed) },
      });
    } catch (cleanupErr) {
      logger.error("audit_background_cleanup_failed", {
        leadId,
        workspaceId,
        reason: cleanupErr instanceof Error ? cleanupErr.message.slice(0, 240) : "unknown",
      });
      // Even if cleanup failed, the pending marker will time out after
      // AUDIT_BACKGROUND_FRESHNESS_MS (5 minutes) via isAuditPending().
    }
    return new Response(null, { status: 202 });
  }
};

export const config = {
  // Per-function timeout. Background Functions allow up to 15 minutes;
  // we cap at 4 minutes since our LLM call is ~30-90s and we don't
  // want a runaway call to bill 15 minutes of compute.
  timeout: 240,
};
