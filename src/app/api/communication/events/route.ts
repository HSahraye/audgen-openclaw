import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { enforceRateLimit, verifyHmacSignature } from "@/lib/request-security";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { getEnv, isAuthEnabled } from "@/lib/env";

/**
 * SECURITY notes.
 *
 *  Before: POST /api/communication/events accepted {workspaceId, ...} from
 *  the request body and wrote CommunicationEvent + UnsubscribedContact
 *  rows into the named workspace. Any caller could forge unsubscribes,
 *  bounces, opens, and clicks for any tenant. The route was meant to be
 *  an inbound provider webhook (Resend / Postmark / Twilio).
 *
 *  After:
 *   - workspaceId is NEVER taken from the request body. It is resolved
 *     from the OutboundMessage the event references. If we sent the
 *     message, we know which workspace it belongs to.
 *   - Three acceptable caller paths, in order of preference:
 *       (a) HMAC-signed webhook: header `x-presencelabs-signature`
 *           contains hex(HMAC-SHA256(`${ts}.${rawBody}`, secret)) and the
 *           `x-presencelabs-ts` header is within 5 minutes of now.
 *           Mirrors the public-ingest webhook signing.
 *       (b) Authenticated workspace member (internal tooling).
 *       (c) Auth disabled (dev/test only).
 *   - Per-IP rate limit to discourage brute forcing.
 *   - 404 (not 401/403) when authz fails, to avoid enumeration.
 */

const schema = z.object({
  // workspaceId intentionally NOT accepted from input.
  outboundMessageId: z.string().optional(),
  leadId: z.string().optional(),
  eventType: z.string().min(1),
  provider: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

async function verifyProviderSignature(rawBody: string): Promise<boolean> {
  const env = getEnv();
  const secret = env.COMMUNICATION_WEBHOOK_SECRET;
  if (!secret) return false;
  const headerStore = await headers();
  const ts = headerStore.get("x-presencelabs-ts");
  const sig = headerStore.get("x-presencelabs-signature");
  if (!ts || !sig) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  // Webhook timestamps are in seconds (string) per the public-ingest
  // convention. Accept ms too if upstream sends ms.
  const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
  if (Math.abs(Date.now() - tsMs) > MAX_CLOCK_SKEW_MS) return false;
  return verifyHmacSignature({
    rawBody: `${ts}.${rawBody}`,
    providedSignature: sig,
    secret,
  });
}

export async function POST(request: Request) {
  // Read raw body once for HMAC + parse.
  const rawBody = await request.text();
  const limited = await enforceRateLimit("communication-events", 120, 60_000);
  if (limited) return limited;

  let parsedJson: unknown = null;
  try {
    parsedJson = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid communication event payload." }, { status: 400 });
  }

  // Resolve workspaceId server-side from the OutboundMessage. Without it
  // we have no trustworthy tenant binding, so we reject.
  let workspaceId: string | null = null;
  if (parsed.data.outboundMessageId) {
    const outbound = await prisma.outboundMessage.findUnique({
      where: { id: parsed.data.outboundMessageId },
      select: { id: true, workspaceId: true, leadId: true },
    });
    if (outbound?.workspaceId) {
      workspaceId = outbound.workspaceId;
    }
  }

  // Authorize the caller.
  let authorized = false;
  if (await verifyProviderSignature(rawBody)) {
    authorized = true;
  } else if (isAuthEnabled()) {
    const session = await assertApiSessionWorkspace();
    if (session?.workspaceId) {
      // Internal caller must own the workspace the event will be written to.
      if (workspaceId && workspaceId === session.workspaceId) {
        authorized = true;
      } else if (!workspaceId) {
        // No outboundMessageId provided; allow internal session-bound caller
        // and pin workspaceId to their session.
        workspaceId = session.workspaceId;
        authorized = true;
      }
    }
  } else {
    // Auth disabled (dev/test). Still require we have *some* workspaceId.
    authorized = Boolean(workspaceId);
  }
  if (!authorized || !workspaceId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // If a leadId was supplied, sanity-check it belongs to the resolved
  // workspace; otherwise null it out rather than trust it.
  let leadId: string | null = parsed.data.leadId ?? null;
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) leadId = null;
  }

  const event = await prisma.communicationEvent.create({
    data: {
      workspaceId,
      leadId,
      outboundMessageId: parsed.data.outboundMessageId ?? null,
      eventType: parsed.data.eventType,
      provider: parsed.data.provider ?? null,
      metadataJson: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
    },
  });

  if (
    parsed.data.outboundMessageId &&
    (parsed.data.eventType === "open" ||
      parsed.data.eventType === "click" ||
      parsed.data.eventType === "delivery")
  ) {
    await prisma.outboundMessage.updateMany({
      where: { id: parsed.data.outboundMessageId, workspaceId },
      data: { status: "sent" },
    });
  }

  if (parsed.data.eventType === "unsubscribe" || parsed.data.eventType === "bounce") {
    const email =
      typeof parsed.data.metadata?.email === "string"
        ? parsed.data.metadata.email.toLowerCase()
        : null;
    const phone =
      typeof parsed.data.metadata?.phone === "string" ? parsed.data.metadata.phone : null;
    if (email) {
      await prisma.unsubscribedContact.upsert({
        where: { workspaceId_email: { workspaceId, email } },
        update: { reason: parsed.data.eventType },
        create: { workspaceId, email, reason: parsed.data.eventType },
      });
    } else if (phone) {
      await prisma.unsubscribedContact.upsert({
        where: { workspaceId_phone: { workspaceId, phone } },
        update: { reason: parsed.data.eventType },
        create: { workspaceId, phone, reason: parsed.data.eventType },
      });
    }
  }

  await triggerWorkflows({
    workspaceId,
    leadId: leadId ?? undefined,
    eventType: `communication.${parsed.data.eventType}`,
    payload: parsed.data.metadata ?? {},
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
