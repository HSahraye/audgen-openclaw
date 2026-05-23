import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { planTierToStripePriceId } from "@/lib/billing/subscriptions";
import { getStripeClient } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/url";

const schema = z.object({
  tier: z.enum(["starter", "growth", "agency"]),
});

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "Stripe is not configured." }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid billing tier." }, { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
  });
  if (!workspace) return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });

  const priceId = planTierToStripePriceId(parsed.data.tier);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "This plan is not available for self-serve checkout. Contact sales." },
      { status: 400 },
    );
  }

  let customerId = workspace.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: workspace.name,
      email: session.email || undefined,
      metadata: { workspaceId: workspace.id },
    });
    customerId = customer.id;
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appOrigin = getPublicBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appOrigin}/settings/billing?checkout=success`,
    cancel_url: `${appOrigin}/settings/billing?checkout=cancel`,
    allow_promotion_codes: true,
    metadata: {
      workspaceId: workspace.id,
      billingType: "saas_subscription",
      tier: parsed.data.tier,
    },
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}
