import { NextResponse } from "next/server";
import { z } from "zod";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { prisma } from "@/lib/prisma";
import { trackSalesOsEvent } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/events";
import { enforceRateLimit, getClientRequestMeta } from "@/lib/request-security";
import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";

/**
 * SECURITY notes for this route.
 *
 *  - This endpoint records a "prospect viewed the audit" signal. It is
 *    triggered from the audit page (`/audit/[id]` or `/a/[slug]`) which is
 *    itself signed-link gated via verifyAuditAccessToken.
 *  - Two valid callers:
 *      1. An anonymous prospect with a valid signed audit token bound to
 *         the same leadId. We DO NOT trust the leadId alone \u2014 the token
 *         binds the request to a specific lead.
 *      2. An authenticated workspace member who owns the lead's workspace
 *         (e.g. seller previewing their own audit).
 *  - We never fall back to the platform Default Workspace. The audit-view
 *    is written to the lead's actual workspaceId so cross-tenant counters
 *    cannot be poisoned by an anonymous caller.
 *  - Rate limit per leadId (and IP) to make the endpoint unattractive for
 *    pipeline-noise / engagement-spike spoofing.
 */

const schema = z.object({
  leadId: z.string().min(1),
  token: z.string().min(1).optional(),
});

async function authorize(parsed: z.infer<typeof schema>): Promise<
  | { ok: true; viewerKind: "prospect" | "owner" }
  | { ok: false; status: number }
> {
  // Path 1: signed audit token, if provided.
  if (parsed.token && verifyAuditAccessToken(parsed.token, parsed.leadId)) {
    return { ok: true, viewerKind: "prospect" };
  }

  // Path 2: authenticated workspace member who owns this lead.
  if (isAuthEnabled()) {
    const session = await assertApiSessionWorkspace();
    if (session?.workspaceId) {
      const lead = await prisma.lead.findFirst({
        where: { id: parsed.leadId, workspaceId: session.workspaceId },
        select: { id: true },
      });
      if (lead) return { ok: true, viewerKind: "owner" };
    }
  } else {
    // Auth disabled (dev/test): allow but still verify lead exists below.
    return { ok: true, viewerKind: "owner" };
  }

  return { ok: false, status: 404 };
}

export async function POST(request: Request) {
  const parsedJson = await request.json().catch(() => null);
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const limited = await enforceRateLimit("audit-view", 90, 60_000, parsed.data.leadId);
  if (limited) return limited;

  const authz = await authorize(parsed.data);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: authz.status });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.leadId },
    select: { id: true, workspaceId: true },
  });
  if (!lead || !lead.workspaceId) {
    // Either the lead is gone or has no workspace; refuse rather than fall
    // back to the platform default workspace.
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const { userAgent, ip } = await getClientRequestMeta();
  const workspaceId = lead.workspaceId;

  await prisma.viewLog.create({
    data: {
      workspaceId,
      leadId: parsed.data.leadId,
      ip,
      userAgent,
    },
  });

  await trackEvent(
    "audit_viewed",
    { leadId: parsed.data.leadId, ip: ip ?? "unknown", viewerKind: authz.viewerKind },
    parsed.data.leadId,
    workspaceId,
  );

  const recentViews = await prisma.viewLog.count({
    where: {
      leadId: parsed.data.leadId,
      workspaceId,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });

  if (recentViews >= 3) {
    await trackSalesOsEvent({
      eventType: "engagement_spike_detected",
      workspaceId,
      leadId: parsed.data.leadId,
      payload: { recentViews, viewerKind: authz.viewerKind },
    });
    await applyPipelineAutomation({
      workspaceId,
      leadId: parsed.data.leadId,
      trigger: "repeated_opens",
    });
  }

  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.leadId,
    eventType: "audit_viewed",
    payload: { recentViews, viewerKind: authz.viewerKind },
  });

  return NextResponse.json({ ok: true });
}
