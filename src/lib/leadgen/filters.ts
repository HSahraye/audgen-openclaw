import type { LeadOpportunity, LeadOpportunityFilters } from "@/lib/leadgen/types";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function withinRange(value: number | null, min: number | null | undefined, max: number | null | undefined) {
  if (value == null) return min == null && max == null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function applyLeadOpportunityFilters(
  leads: LeadOpportunity[],
  filters: LeadOpportunityFilters,
) {
  const textQuery = normalize(filters.textQuery);
  const city = normalize(filters.city);
  const category = normalize(filters.category);

  return leads.filter((lead) => {
    if (textQuery) {
      const searchable = [
        lead.businessName,
        lead.category,
        lead.city,
        lead.state,
        lead.phone,
        lead.email,
        lead.website,
        lead.googleProfileUrl,
        lead.recommendedOffer,
        lead.suggestedPitch,
        lead.presenceGaps.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(textQuery)) return false;
    }

    if (city && !normalize(lead.city).includes(city)) return false;
    if (category && !normalize(lead.category).includes(category)) return false;

    if (filters.source && filters.source !== "all" && lead.source !== filters.source) return false;
    if (filters.minNeedScore != null && lead.estimatedNeedScore < filters.minNeedScore) return false;
    if (filters.websiteStatus === "missing" && lead.hasWebsite) return false;
    if (filters.websiteStatus === "present" && !lead.hasWebsite) return false;
    if (filters.googleProfileStatus === "missing" && lead.hasGoogleBusinessProfile) return false;
    if (filters.googleProfileStatus === "present" && !lead.hasGoogleBusinessProfile) return false;
    if (!withinRange(lead.reviewCount, filters.minReviewCount, filters.maxReviewCount)) return false;
    if (!withinRange(lead.rating, filters.minRating, filters.maxRating)) return false;
    if (filters.opportunityLevel && filters.opportunityLevel !== "all" && lead.opportunityLevel !== filters.opportunityLevel) return false;
    if (filters.status && filters.status !== "all" && lead.status !== filters.status) return false;

    return true;
  });
}
