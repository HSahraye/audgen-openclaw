import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { prisma } from "@/lib/prisma";
import { trackSalesOsEvent } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/events";
import { enforceRateLimit, getClientRequestMeta } from "@/lib/request-security";
import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";

/**
 * SECURITY notes.
 *
 *  POST /api/payment-intent records a "prospect clicked checkout" signal.
 *  It mutates the Lead (paymentStatus = checkout_started) and drives
 *  pipeline automation. That makes it a privileged side-effect endpoint,
 *  not a passive log.
 *
 *  Acceptable callers:
 *   1. A prospect arriving from a signed audit link (same model as the
 *      audit page). They MUST present a valid signed token bound to the
 *      same leadId.
 *   2. An authenticated workspace member who owns the lead's workspace
 *      (e.g. seller previewing the flow).
 *
 *  We never fall back to the platform Default Workspace. If the lead has
 *  no workspaceId we refuse the request rather than write to a shared
 *  default.
 */

const schema = z.object({
  leadId: z.string().min(1),
  token: z.string().min(1).optional(),
});

async function authorize(parsed: z.infer<typeof schema>): Promise<
  | { ok: true; viewerKind: "prospect" | "owner" }
  | { ok: false; status: number }
> {
  if (parsed.token && verifyAuditAccessToken(parsed.token, parsed.leadId)) {
    return { ok: true, viewerKind: "prospect" };
  }
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

  const limited = await enforceRateLimit("payment-intent", 90, 60_000, parsed.data.leadId);
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
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const workspaceId = lead.workspaceId;

  const { userAgent, ip } = await getClientRequestMeta();

  await prisma.paymentLog.create({
    data: {
      workspaceId,
      leadId: parsed.data.leadId,
      eventType: "clicked",
      provider: "manual-link",
      ip,
      userAgent,
    },
  });
  await prisma.lead.update({
    where: { id: parsed.data.leadId },
    data: { paymentStatus: "checkout_started" },
  });
  await trackEvent(
    "payment_clicked",
    { leadId: parsed.data.leadId, viewerKind: authz.viewerKind },
    parsed.data.leadId,
    workspaceId,
  );
  await trackSalesOsEvent({
    eventType: "payment_intent_recorded",
    workspaceId,
    leadId: parsed.data.leadId,
    payload: { viewerKind: authz.viewerKind },
  });
  await applyPipelineAutomation({
    workspaceId,
    leadId: parsed.data.leadId,
    trigger: "payment_clicked",
  });
  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.leadId,
    eventType: "payment_intent_clicked",
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
