import type Stripe from "stripe";
import type { PlanTier, SubscriptionStatus, WorkspaceStatus } from "@prisma/client";
import { getEnv } from "@/lib/env";

export function planTierToStripePriceId(tier: PlanTier) {
  const env = getEnv();
  const mapping: Record<PlanTier, string | undefined> = {
    free_trial: undefined,
    starter: env.STRIPE_SAAS_PRICE_STARTER,
    growth: env.STRIPE_SAAS_PRICE_GROWTH,
    agency: env.STRIPE_SAAS_PRICE_AGENCY,
    enterprise: env.STRIPE_SAAS_PRICE_ENTERPRISE,
  };
  return mapping[tier];
}

export function stripePriceIdToPlanTier(priceId: string | null | undefined): PlanTier | null {
  const env = getEnv();
  const mapping: Array<[string | undefined, PlanTier]> = [
    [env.STRIPE_SAAS_PRICE_STARTER, "starter"],
    [env.STRIPE_SAAS_PRICE_GROWTH, "growth"],
    [env.STRIPE_SAAS_PRICE_AGENCY, "agency"],
    [env.STRIPE_SAAS_PRICE_ENTERPRISE, "enterprise"],
  ];
  for (const [configured, tier] of mapping) {
    if (configured && configured === priceId) return tier;
  }
  return null;
}

export function stripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "incomplete") return "incomplete";
  if (status === "unpaid") return "unpaid";
  return "canceled";
}

export function workspaceStatusFromSubscription(input: {
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
}): WorkspaceStatus {
  if (input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing") {
    return input.cancelAtPeriodEnd ? "active" : "active";
  }
  if (input.subscriptionStatus === "past_due" || input.subscriptionStatus === "unpaid") {
    return "delinquent";
  }
  if (input.subscriptionStatus === "canceled") {
    return "canceled";
  }
  return "suspended";
}
