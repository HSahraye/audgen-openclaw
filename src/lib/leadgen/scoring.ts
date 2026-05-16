import type { LeadOpportunity, LeadOpportunitySeed, OpportunityLevel } from "@/lib/leadgen/types";

type CategoryWeight = {
  scoreBonus: number;
  revenueBase: number;
};

const CATEGORY_WEIGHTS: Record<string, CategoryWeight> = {
  dental: { scoreBonus: 9, revenueBase: 4200 },
  hvac: { scoreBonus: 10, revenueBase: 5200 },
  plumbing: { scoreBonus: 10, revenueBase: 5000 },
  roofing: { scoreBonus: 11, revenueBase: 5600 },
  landscaping: { scoreBonus: 8, revenueBase: 3600 },
  legal: { scoreBonus: 8, revenueBase: 4300 },
  medspa: { scoreBonus: 9, revenueBase: 4800 },
  auto: { scoreBonus: 7, revenueBase: 3200 },
  "home services": { scoreBonus: 8, revenueBase: 3900 },
  contractor: { scoreBonus: 9, revenueBase: 4500 },
  default: { scoreBonus: 4, revenueBase: 2500 },
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function categoryWeight(category: string): CategoryWeight {
  const normalized = category.trim().toLowerCase();
  for (const key of Object.keys(CATEGORY_WEIGHTS)) {
    if (key !== "default" && normalized.includes(key)) return CATEGORY_WEIGHTS[key];
  }
  return CATEGORY_WEIGHTS.default;
}

export function mapOpportunityLevel(score: number): OpportunityLevel {
  if (score >= 85) return "Critical";
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function inferRecommendedOffer(category: string, hasWebsite: boolean) {
  const normalized = category.toLowerCase();
  if (!hasWebsite) return "Website Launch + Local SEO Kickstart";
  if (normalized.includes("dental") || normalized.includes("medical")) return "Patient Booking Conversion System";
  if (normalized.includes("hvac") || normalized.includes("plumbing") || normalized.includes("roof")) {
    return "Local Service Conversion Upgrade";
  }
  return "Presence Labs Conversion Upgrade";
}

export function inferSuggestedPitch(
  businessName: string,
  city: string,
  needScore: number,
  gaps: string[],
) {
  const urgency = needScore >= 85 ? "urgent" : needScore >= 70 ? "high-impact" : "actionable";
  const topGap = gaps[0] ?? "online conversion friction";
  return `${businessName} shows ${urgency} opportunity in ${city}. We found ${topGap.toLowerCase()} and can ship a focused upgrade that should increase calls and booked jobs within 30 days.`;
}

export function scoreLeadOpportunity(seed: LeadOpportunitySeed): LeadOpportunity {
  let score = 18;
  const gaps: string[] = [];

  if (!seed.hasWebsite) {
    score += 30;
    gaps.push("No website found");
  } else if (seed.websiteQuality === "weak") {
    score += 15;
    gaps.push("Weak website quality");
  } else if (seed.websiteQuality === "average") {
    score += 6;
  }

  if (!seed.hasGoogleBusinessProfile) {
    score += 18;
    gaps.push("Missing Google Business Profile signal");
  }

  if (!seed.hasBookingLink) {
    score += 8;
    gaps.push("No clear booking flow");
  }

  if (!seed.hasContactForm) {
    score += 7;
    gaps.push("No visible contact form");
  }

  if (!seed.hasSocialLinks) {
    score += 5;
    gaps.push("No social proof links");
  }

  if ((seed.reviewCount ?? 0) < 10) {
    score += 10;
    gaps.push("Low review volume");
  } else if ((seed.reviewCount ?? 0) < 30) {
    score += 4;
  }

  if ((seed.rating ?? 5) < 3.8) {
    score += 9;
    gaps.push("Rating below local category benchmark");
  } else if ((seed.rating ?? 5) < 4.3) {
    score += 4;
  }

  if (seed.responseSpeedSignal === "slow") {
    score += 5;
    gaps.push("Slow response speed signals");
  }

  const category = categoryWeight(seed.category);
  score += category.scoreBonus;

  const estimatedNeedScore = clampScore(score);
  const opportunityLevel = mapOpportunityLevel(estimatedNeedScore);
  const estimatedRevenuePotential = Math.round(
    category.revenueBase * (0.75 + estimatedNeedScore / 100),
  );
  const recommendedOffer = inferRecommendedOffer(seed.category, seed.hasWebsite);
  const suggestedPitch = inferSuggestedPitch(
    seed.businessName,
    seed.city,
    estimatedNeedScore,
    gaps,
  );

  return {
    ...seed,
    estimatedNeedScore,
    estimatedRevenuePotential,
    opportunityLevel,
    presenceGaps: gaps.length ? gaps : ["General conversion optimization opportunity"],
    recommendedOffer,
    suggestedPitch,
  };
}
