import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/request-security";

/**
 * SECURITY note (tenant-scope audit, T10):
 *  - This endpoint is reachable from a customer's email/SMS unsubscribe
 *    link, so workspaceId is part of the URL by design. An attacker who
 *    guesses or learns a workspaceId can still cause forged suppressions
 *    in that tenant by posting a stream of (email, phone) pairs.
 *  - Mitigation here: per-IP rate-limit (60 / min) so forged-spam is
 *    throttled. The full fix is to sign the unsubscribe link with an
 *    HMAC over (workspaceId, email|phone, ts) similar to /audit/[id]
 *    links. That's a behavior-breaking change for emails already in
 *    flight, so it's documented in TENANT_SCOPE_AUDIT_REPORT.md and not
 *    shipped here without owner approval.
 */

const schema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function GET(request: Request) {
  const limited = await enforceRateLimit("communication-unsubscribe", 60, 60_000);
  if (limited) return limited;
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    workspaceId: url.searchParams.get("workspaceId"),
    email: url.searchParams.get("email") || undefined,
    phone: url.searchParams.get("phone") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid unsubscribe request." }, { status: 400 });
  }
  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json({ ok: false, error: "Email or phone is required." }, { status: 400 });
  }
  if (parsed.data.email) {
    await prisma.unsubscribedContact.upsert({
      where: {
        workspaceId_email: {
          workspaceId: parsed.data.workspaceId,
          email: parsed.data.email,
        },
      },
      update: {
        phone: parsed.data.phone ?? null,
        reason: "user_unsubscribe",
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        reason: "user_unsubscribe",
      },
    });
  } else if (parsed.data.phone) {
    await prisma.unsubscribedContact.upsert({
      where: {
        workspaceId_phone: {
          workspaceId: parsed.data.workspaceId,
          phone: parsed.data.phone,
        },
      },
      update: {
        reason: "user_unsubscribe",
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        phone: parsed.data.phone,
        reason: "user_unsubscribe",
      },
    });
  }
  return NextResponse.json({ ok: true, message: "You have been unsubscribed." });
}
