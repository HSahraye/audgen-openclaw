import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import type { LeadOpportunity, LeadSourceType } from "@/lib/leadgen/types";

type LiveProvider = "google_places" | "yelp_fusion";

const LOCAL_PROVIDER_CACHE: Record<LiveProvider, LeadOpportunity[]> = {
  google_places: getMockLeadOpportunities().map((lead) => ({
    ...lead,
    source: "google_places" satisfies LeadSourceType,
  })),
  yelp_fusion: getMockLeadOpportunities().map((lead) => ({
    ...lead,
    source: "yelp_fusion" satisfies LeadSourceType,
  })),
};

export function getLocalCachedConnectorLeads(provider: LiveProvider): LeadOpportunity[] {
  return LOCAL_PROVIDER_CACHE[provider].map((lead) => ({ ...lead }));
}
