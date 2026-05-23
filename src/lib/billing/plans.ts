import type { PlanTier } from "@prisma/client";

export type PlanLimits = {
  auditsPerMonth: number;
  importsPerMonth: number;
  activeLeads: number;
  templates: number;
  seats: number;
  outreachGenerations: number;
  proposalGenerations: number;
};

/** Customer-facing labels mapped onto Prisma PlanTier enum values (no schema change). */
export const PLAN_CUSTOMER_LABELS: Record<PlanTier, string> = {
  free_trial: "Trial",
  starter: "Starter",
  growth: "Pro",
  agency: "Scale",
  enterprise: "Custom",
};

/** Self-serve tiers only — Custom/enterprise is contact-sales. */
export const SAAS_CHECKOUT_TIERS = ["starter", "growth", "agency"] as const satisfies readonly PlanTier[];

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free_trial: {
    auditsPerMonth: 10,
    importsPerMonth: 300,
    activeLeads: 500,
    templates: 8,
    seats: 2,
    outreachGenerations: 120,
    proposalGenerations: 60,
  },
  starter: {
    auditsPerMonth: 25,
    importsPerMonth: 1200,
    activeLeads: 2500,
    templates: 25,
    seats: 5,
    outreachGenerations: 600,
    proposalGenerations: 240,
  },
  growth: {
    auditsPerMonth: 100,
    importsPerMonth: 4500,
    activeLeads: 10000,
    templates: 80,
    seats: 15,
    outreachGenerations: 2500,
    proposalGenerations: 800,
  },
  agency: {
    auditsPerMonth: 300,
    importsPerMonth: 14000,
    activeLeads: 35000,
    templates: 200,
    seats: 40,
    outreachGenerations: 9000,
    proposalGenerations: 3000,
  },
  enterprise: {
    auditsPerMonth: 1000000,
    importsPerMonth: 1000000,
    activeLeads: 1000000,
    templates: 10000,
    seats: 10000,
    outreachGenerations: 1000000,
    proposalGenerations: 1000000,
  },
};

export const PLAN_DISPLAY: Record<PlanTier, { label: string; monthlyPriceCents: number }> = {
  free_trial: { label: "Trial", monthlyPriceCents: 0 },
  starter: { label: "Starter", monthlyPriceCents: 7900 },
  growth: { label: "Pro", monthlyPriceCents: 19900 },
  agency: { label: "Scale", monthlyPriceCents: 39900 },
  enterprise: { label: "Custom", monthlyPriceCents: 0 },
};

export function formatPlanPrice(monthlyPriceCents: number): string {
  if (monthlyPriceCents <= 0) return "Contact sales";
  return `$${monthlyPriceCents / 100}/mo`;
}
