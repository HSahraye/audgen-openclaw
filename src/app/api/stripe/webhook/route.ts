import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { PlanTier } from "@prisma/client";
import { incrementUsageMetric } from "@/lib/billing/usage";
import {
  stripePriceIdToPlanTier,
  stripeSubscriptionStatus,
  workspaceStatusFromSubscription,
} from "@/lib/billing/subscriptions";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/events";
import { getWorkspaceContext } from "@/lib/workspace";

async function resolveWorkspaceForStripeEvent(event: Stripe.Event, defaultWorkspaceId: string) {
  const objectData = event.data.object as unknown as Record<string, unknown>;
  const metadata = (objectData.metadata || {}) as Record<string, string>;
  const workspaceIdFromMetadata = typeof metadata.workspaceId === "string" ? metadata.workspaceId : null;
  if (workspaceIdFromMetadata) return workspaceIdFromMetadata;

  const customerId = typeof objectData.customer === "string" ? objectData.customer : null;
  if (customerId) {
    const workspace = await prisma.workspace.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (workspace) return workspace.id;
  }
  return defaultWorkspaceId;
}

async function upsertSaasSubscriptionFromStripe(input: {
  workspaceId: string;
  stripeCustomerId?: string | null;
  stripeSubscription: Stripe.Subscription;
}) {
  const subscriptionData = input.stripeSubscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const priceId = input.stripeSubscription.items.data[0]?.price?.id || null;
  const planTier = stripePriceIdToPlanTier(priceId);
  if (!planTier) {
    logger.warn("stripe_unmapped_price_id", {
      priceId,
      stripeSubscriptionId: input.stripeSubscription.id,
      workspaceId: input.workspaceId,
    });
    return;
  }
  const status = stripeSubscriptionStatus(input.stripeSubscription.status);
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: input.stripeSubscription.id },
    update: {
      workspaceId: input.workspaceId,
      stripeCustomerId: input.stripeCustomerId || null,
      stripePriceId: priceId,
      planTier,
      status,
      currentPeriodStart: subscriptionData.current_period_start ? new Date(subscriptionData.current_period_start * 1000) : null,
      currentPeriodEnd: subscriptionData.current_period_end ? new Date(subscriptionData.current_period_end * 1000) : null,
      cancelAtPeriodEnd: input.stripeSubscription.cancel_at_period_end,
      canceledAt: input.stripeSubscription.canceled_at ? new Date(input.stripeSubscription.canceled_at * 1000) : null,
      trialEndsAt: input.stripeSubscription.trial_end ? new Date(input.stripeSubscription.trial_end * 1000) : null,
      metadataJson: JSON.stringify(input.stripeSubscription.metadata || {}),
    },
    create: {
      workspaceId: input.workspaceId,
      stripeCustomerId: input.stripeCustomerId || null,
      stripeSubscriptionId: input.stripeSubscription.id,
      stripePriceId: priceId,
      planTier,
      status,
      currentPeriodStart: subscriptionData.current_period_start ? new Date(subscriptionData.current_period_start * 1000) : null,
      currentPeriodEnd: subscriptionData.current_period_end ? new Date(subscriptionData.current_period_end * 1000) : null,
      cancelAtPeriodEnd: input.stripeSubscription.cancel_at_period_end,
      canceledAt: input.stripeSubscription.canceled_at ? new Date(input.stripeSubscription.canceled_at * 1000) : null,
      trialEndsAt: input.stripeSubscription.trial_end ? new Date(input.stripeSubscription.trial_end * 1000) : null,
      metadataJson: JSON.stringify(input.stripeSubscription.metadata || {}),
    },
  });
  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      stripeCustomerId: input.stripeCustomerId || undefined,
      planTier,
      status: workspaceStatusFromSubscription({ subscriptionStatus: status, cancelAtPeriodEnd: input.stripeSubscription.cancel_at_period_end }),
      trialEndsAt: input.stripeSubscription.trial_end ? new Date(input.stripeSubscription.trial_end * 1000) : undefined,
    },
  });
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false, error: "Missing stripe signature." }, { status: 400 });

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logger.warn("stripe_webhook_signature_invalid", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, error: "Invalid stripe signature." }, { status: 400 });
  }

  const defaultWorkspace = await getWorkspaceContext();
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
  });
  if (existing) return NextResponse.json({ ok: true, deduped: true });

  const workspaceId = await resolveWorkspaceForStripeEvent(event, defaultWorkspace.workspaceId);

  await prisma.webhookEvent.create({
    data: {
      workspaceId,
      provider: "stripe",
      eventId: event.id,
      payloadJson: rawBody,
    },
  });

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await upsertSaasSubscriptionFromStripe({
      workspaceId,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
      stripeSubscription: subscription,
    });
    await trackEvent(
      "saas_subscription_changed",
      {
        workspaceId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
      },
      undefined,
      workspaceId,
    );
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    await trackEvent(
      "saas_invoice_paid",
      { workspaceId, invoiceId: invoice.id, customerId: invoice.customer, amountPaid: invoice.amount_paid },
      undefined,
      workspaceId,
    );
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: "delinquent" },
    });
    await trackEvent(
      "saas_invoice_failed",
      { workspaceId, invoiceId: invoice.id, customerId: invoice.customer },
      undefined,
      workspaceId,
    );
  }

  if (event.type === "customer.subscription.trial_will_end") {
    await trackEvent(
      "saas_trial_will_end",
      { workspaceId, stripeEventId: event.id },
      undefined,
      workspaceId,
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const billingType = typeof session.metadata?.billingType === "string" ? session.metadata.billingType : null;
    if (billingType === "saas_subscription") {
      await trackEvent("saas_checkout_completed", { workspaceId, checkoutSessionId: session.id }, undefined, workspaceId);
      return NextResponse.json({ ok: true });
    }
    const leadId = typeof session.metadata?.leadId === "string" ? session.metadata.leadId : "";
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, workspaceId: true },
      });
      if (!lead) return NextResponse.json({ ok: true, skipped: true });
      const workspaceId = lead.workspaceId ?? defaultWorkspace.workspaceId;
      await prisma.paymentLog.create({
        data: {
          workspaceId,
          leadId,
          eventType: "paid",
          provider: "stripe",
          externalId: session.id,
          ip: null,
          userAgent: null,
        },
      });
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          paymentStatus: "paid",
          lastPaymentAt: new Date(),
        },
      });
      await incrementUsageMetric({
        workspaceId,
        metric: "proposal_generations",
        amount: 1,
        metadata: { source: "payment_paid" },
      });
      await trackEvent("payment_paid", { leadId, checkoutSessionId: session.id }, leadId, workspaceId);
    }
  }

  return NextResponse.json({ ok: true });
}
