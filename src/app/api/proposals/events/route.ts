import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";
import { enforceRateLimit } from "@/lib/request-security";

/**
 * SECURITY notes.
 *
 *  Before: this route accepted `workspaceId` from the request body and
 *  wrote ProposalDelivery + Activity rows into whatever workspaceId the
 *  caller named. That is a textbook IDOR \u2014 anyone could pollute any
 *  tenant's pipeline with `proposal.accepted` activities.
 *
 *  After:
 *   - workspaceId is REMOVED from the request body. It is derived from the
 *     Lead's actual workspaceId on the server side.
 *   - Acceptable callers:
 *       1. A prospect arriving from a signed audit/proposal link (token
 *          binds the request to the leadId).
 *       2. An authenticated workspace member who owns the lead's workspace.
 *   - ProposalDelivery updates are scoped to (id, leadId, lead.workspaceId)
 *     so cross-tenant id-collision cannot mutate someone else's row.
 *   - Rate-limited per leadId.
 *   - 404 (not 401/403) on auth failure to avoid enumeration.
 */

const schema = z.object({
  leadId: z.string().min(1),
  proposalDeliveryId: z.string().optional(),
  eventType: z.enum(["opened", "reopened", "accepted"]),
  token: z.string().min(1).optional(),
});

type ParsedBody = z.infer<typeof schema>;

async function authorize(parsed: ParsedBody): Promise<
  | { ok: true; viewerKind: "prospect" | "owner"; workspaceId: string }
  | { ok: false; status: number }
> {
  // First, look up the lead so we know its workspace before deciding access.
  const lead = await prisma.lead.findUnique({
    where: { id: parsed.leadId },
    select: { id: true, workspaceId: true },
  });
  if (!lead || !lead.workspaceId) return { ok: false, status: 404 };

  if (parsed.token && verifyAuditAccessToken(parsed.token, parsed.leadId)) {
    return { ok: true, viewerKind: "prospect", workspaceId: lead.workspaceId };
  }
  if (isAuthEnabled()) {
    const session = await assertApiSessionWorkspace();
    if (session?.workspaceId === lead.workspaceId) {
      return { ok: true, viewerKind: "owner", workspaceId: lead.workspaceId };
    }
  } else {
    return { ok: true, viewerKind: "owner", workspaceId: lead.workspaceId };
  }
  return { ok: false, status: 404 };
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const limited = await enforceRateLimit("proposals-events", 60, 60_000, parsed.data.leadId);
  if (limited) return limited;

  const authz = await authorize(parsed.data);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: authz.status });
  }
  const workspaceId = authz.workspaceId;

  if (parsed.data.proposalDeliveryId) {
    await prisma.proposalDelivery.updateMany({
      where: {
        id: parsed.data.proposalDeliveryId,
        workspaceId,
        leadId: parsed.data.leadId,
      },
      data: {
        openedAt:
          parsed.data.eventType === "opened" || parsed.data.eventType === "reopened"
            ? new Date()
            : undefined,
        acceptedAt: parsed.data.eventType === "accepted" ? new Date() : undefined,
      },
    });
  }

  await prisma.activity.create({
    data: {
      workspaceId,
      leadId: parsed.data.leadId,
      type: `proposal.${parsed.data.eventType}`,
      source: "tracking",
    },
  });

  await triggerWorkflows({
    workspaceId,
    leadId: parsed.data.leadId,
    eventType: `proposal_${parsed.data.eventType}`,
    payload: {},
  });

  if (parsed.data.eventType === "opened" || parsed.data.eventType === "reopened") {
    await applyPipelineAutomation({
      workspaceId,
      leadId: parsed.data.leadId,
      trigger: "proposal_viewed",
    });
  }

  return NextResponse.json({ ok: true });
}
