import { scoreLeadOpportunity } from "@/lib/leadgen/scoring";
import { generateSandboxLeads } from "@/lib/leadgen/live-adapters/sandbox-generator";
import {
  MAX_LIVE_SEARCH_RESULTS,
  type LiveAdapterFetchResult,
  type LiveAdapterQuery,
} from "@/lib/leadgen/live-adapters/types";
import type { LeadOpportunity } from "@/lib/leadgen/types";

function isSandboxMode() {
  return process.env.LEADGEN_SANDBOX_MODE === "true";
}

function isLiveConnectorEnabled() {
  return process.env.LEADGEN_LIVE_CONNECTORS_ENABLED === "true";
}

function shouldRunLiveLookups() {
  return isLiveConnectorEnabled() && !isSandboxMode();
}

type YelpBusiness = {
  id?: string;
  name?: string;
  phone?: string;
  url?: string;
  rating?: number;
  review_count?: number;
  categories?: Array<{ title?: string }>;
  location?: {
    city?: string;
    state?: string;
    display_address?: string[];
  };
};

type YelpSearchResponse = {
  businesses?: YelpBusiness[];
};

function normalizeYelpBusinessToLead(
  business: YelpBusiness,
  query: LiveAdapterQuery,
  index: number,
) {
  const name = business.name?.trim() || `Yelp Business ${index + 1}`;
  const category = business.categories?.map((entry) => entry.title).filter(Boolean).join(", ")
    || query.category?.trim()
    || "Local Services";
  const city = business.location?.city?.trim() || query.city?.trim() || "Unknown";
  const state = business.location?.state?.trim() || "CA";
  const phone = business.phone?.trim() || null;
  const url = business.url?.trim() || null;
  const rating = typeof business.rating === "number" ? Number(business.rating.toFixed(1)) : null;
  const reviewCount = typeof business.review_count === "number" ? business.review_count : null;
  const displayAddress = business.location?.display_address?.join(", ").trim() || null;

  return scoreLeadOpportunity({
    id: business.id || `yelp-${index}`,
    businessName: name,
    category,
    city,
    state,
    phone,
    email: null,
    website: url,
    googleProfileUrl: null,
    address: displayAddress,
    rating,
    reviewCount,
    hasWebsite: Boolean(url),
    hasGoogleBusinessProfile: false,
    hasBookingLink: false,
    hasContactForm: Boolean(url),
    hasSocialLinks: false,
    websiteQuality: url ? "weak" : "none",
    responseSpeedSignal: phone ? "average" : "slow",
    source: "yelp_fusion",
    sourceUrl: url,
    status: "discovered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function mapYelpBusinessesToLeadOpportunities(
  businesses: YelpBusiness[],
  query: LiveAdapterQuery,
): Promise<LeadOpportunity[]> {
  return businesses
    .slice(0, MAX_LIVE_SEARCH_RESULTS)
    .map((business, index) => normalizeYelpBusinessToLead(business, query, index));
}

export class YelpAPIAdapter {
  readonly provider = "yelp_fusion";

  async fetchLeads(query: LiveAdapterQuery = {}): Promise<LiveAdapterFetchResult> {
    const apiKey = process.env.YELP_API_KEY?.trim();
    if (!apiKey) {
      return {
        status: "MISSING_ENV",
        leads: [],
        blocked: true,
        message: "YELP_API_KEY missing. Network calls are blocked.",
      };
    }

    if (!shouldRunLiveLookups()) {
      return {
        status: "SANDBOX_MODE",
        leads: generateSandboxLeads("yelp_fusion", query),
        blocked: false,
        message: isSandboxMode()
          ? "Sandbox mode enabled. Returning localized synthetic Yelp leads."
          : "Live connectors disabled by kill-switch. Falling back to sandbox lead synthesis.",
      };
    }

    const requestedLimit = query.limit ?? MAX_LIVE_SEARCH_RESULTS;
    const liveLimit = Math.max(1, Math.min(MAX_LIVE_SEARCH_RESULTS, requestedLimit));
    const searchUrl = new URL("https://api.yelp.com/v3/businesses/search");
    searchUrl.searchParams.set("location", query.city?.trim() || "San Jose, CA");
    searchUrl.searchParams.set("categories", (query.category || "").trim() || "localservices");
    searchUrl.searchParams.set("limit", String(liveLimit));
    if (query.textQuery?.trim()) {
      searchUrl.searchParams.set("term", query.textQuery.trim());
    }

    try {
      const response = await fetch(searchUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        return {
          status: "PROVIDER_ERROR",
          leads: [],
          blocked: false,
          message: `Yelp search failed with status ${response.status}.`,
          providerError: {
            error: "PROVIDER_ERROR",
            message: "Live lookup failed or quota exceeded. Falling back to sandbox simulation.",
          },
        };
      }
      const payload = (await response.json()) as YelpSearchResponse;
      const mapped = await mapYelpBusinessesToLeadOpportunities(
        (payload.businesses ?? []).slice(0, liveLimit),
        query,
      );
      return {
        status: "READY",
        leads: mapped.slice(0, MAX_LIVE_SEARCH_RESULTS),
        blocked: false,
        message: `Yelp returned ${mapped.length} mapped leads.`,
      };
    } catch {
      return {
        status: "PROVIDER_ERROR",
        leads: [],
        blocked: false,
        message: "Yelp request failed due to provider/network error.",
        providerError: {
          error: "PROVIDER_ERROR",
          message: "Live lookup failed or quota exceeded. Falling back to sandbox simulation.",
        },
      };
    }
  }
}
