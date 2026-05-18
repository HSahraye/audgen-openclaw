import { scoreLeadOpportunity } from "@/lib/leadgen/scoring";
import { generateSandboxLeads } from "@/lib/leadgen/live-adapters/sandbox-generator";
import {
  MAX_LIVE_SEARCH_RESULTS,
  type LiveAdapterFetchResult,
  type LiveAdapterQuery,
} from "@/lib/leadgen/live-adapters/types";
import type { LeadOpportunity } from "@/lib/leadgen/types";
import { logger } from "@/lib/logger";

function isSandboxMode() {
  return process.env.LEADGEN_SANDBOX_MODE === "true";
}

function isLiveConnectorEnabled() {
  return process.env.LEADGEN_LIVE_CONNECTORS_ENABLED === "true";
}

function shouldRunLiveLookups() {
  return isLiveConnectorEnabled() && !isSandboxMode();
}

type GooglePlaceTextSearchResult = {
  places?: GooglePlaceDetails[];
};

type GooglePlaceDetails = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

function extractCityState(address: string | undefined, fallbackCity: string) {
  if (!address?.trim()) return { city: fallbackCity, state: "CA" };
  const chunks = address.split(",").map((part) => part.trim()).filter(Boolean);
  const city = chunks.length >= 2 ? chunks[chunks.length - 2] : fallbackCity;
  const stateToken = chunks[chunks.length - 1] ?? "CA";
  const stateMatch = stateToken.match(/\b([A-Z]{2})\b/);
  return {
    city: city || fallbackCity,
    state: stateMatch?.[1] ?? "CA",
  };
}

function normalizeGooglePlaceToLead(
  place: GooglePlaceDetails,
  query: LiveAdapterQuery,
  index: number,
): LeadOpportunity {
  const cityFromQuery = query.city?.trim() || "Unknown";
  const category = query.category?.trim() || "Local Services";
  const name = place.displayName?.text?.trim() || `Google Place ${index + 1}`;
  const { city, state } = extractCityState(place.formattedAddress, cityFromQuery);
  const website = place.websiteUri?.trim() || null;
  const phone = place.nationalPhoneNumber?.trim() || null;
  const rating = typeof place.rating === "number" ? Number(place.rating.toFixed(1)) : null;
  const reviewCount = typeof place.userRatingCount === "number" ? place.userRatingCount : null;
  const hasWebsite = Boolean(website);
  const hasPhone = Boolean(phone);

  return scoreLeadOpportunity({
    id: place.id || place.googleMapsUri || `google-place-${index}`,
    businessName: name,
    category,
    city,
    state,
    phone,
    email: null,
    website,
    googleProfileUrl: place.googleMapsUri || null,
    address: place.formattedAddress || null,
    rating,
    reviewCount,
    hasWebsite,
    hasGoogleBusinessProfile: Boolean(place.googleMapsUri),
    hasBookingLink: false,
    hasContactForm: hasWebsite,
    hasSocialLinks: false,
    websiteQuality: hasWebsite ? "average" : "none",
    responseSpeedSignal: hasPhone ? "average" : "slow",
    source: "google_places",
    sourceUrl: place.googleMapsUri || null,
    status: "discovered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function mapGooglePlacesToLeadOpportunities(
  places: GooglePlaceDetails[],
  query: LiveAdapterQuery,
) {
  return places
    .slice(0, MAX_LIVE_SEARCH_RESULTS)
    .map((place, index) => normalizeGooglePlaceToLead(place, query, index));
}

export class GooglePlacesAdapter {
  readonly provider = "google_places";

  async fetchLeads(query: LiveAdapterQuery = {}): Promise<LiveAdapterFetchResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

    if (!apiKey) {
      return {
        status: "MISSING_ENV",
        leads: [],
        blocked: true,
        message: "GOOGLE_PLACES_API_KEY missing. Network calls are blocked.",
      };
    }

    if (!shouldRunLiveLookups()) {
      return {
        status: "SANDBOX_MODE",
        leads: generateSandboxLeads("google_places", query),
        blocked: false,
        message: isSandboxMode()
          ? "Sandbox mode enabled. Returning localized synthetic Google Places leads."
          : "Live connectors disabled by kill-switch. Falling back to sandbox lead synthesis.",
      };
    }

    const textQuery = [query.category, query.city, query.textQuery].filter(Boolean).join(" ").trim() || "local business";
    const requestedLimit = query.limit ?? MAX_LIVE_SEARCH_RESULTS;
    const liveLimit = Math.max(1, Math.min(MAX_LIVE_SEARCH_RESULTS, requestedLimit));
    try {
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: liveLimit,
        }),
      });
      if (!searchRes.ok) {
        // Capture the provider response body (truncated) so the operator can
        // diagnose the actual rejection reason — billing-not-enabled, key
        // restricted to a different referrer, Places API not enabled in GCP,
        // etc. The logger scrubs known secret patterns automatically.
        const bodySnippet = await searchRes.text().catch(() => "");
        const truncatedBody = bodySnippet.slice(0, 256);
        logger.error("googlePlaces.fetchLeads.providerError", {
          status: searchRes.status,
          statusText: searchRes.statusText,
          bodySnippet: truncatedBody,
          textQuery,
        });
        const fallbackLeads = generateSandboxLeads("google_places", query);
        return {
          status: "PROVIDER_ERROR",
          leads: fallbackLeads.slice(0, MAX_LIVE_SEARCH_RESULTS),
          blocked: false,
          message: `Google Places search failed with status ${searchRes.status}.`,
          providerError: {
            error: "PROVIDER_ERROR",
            message: "Live lookup failed or quota exceeded. Falling back to sandbox simulation.",
          },
        };
      }
      const searchPayload = (await searchRes.json()) as GooglePlaceTextSearchResult;
      const mapped = await mapGooglePlacesToLeadOpportunities(
        (searchPayload.places ?? []).slice(0, liveLimit),
        query,
      );
      return {
        status: "READY",
        leads: mapped.slice(0, MAX_LIVE_SEARCH_RESULTS),
        blocked: false,
        message: `Google Places returned ${mapped.length} mapped leads.`,
      };
    } catch (err) {
      logger.error("googlePlaces.fetchLeads.networkError", {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
        textQuery,
      });
      const fallbackLeads = generateSandboxLeads("google_places", query);
      return {
        status: "PROVIDER_ERROR",
        leads: fallbackLeads.slice(0, MAX_LIVE_SEARCH_RESULTS),
        blocked: false,
        message: "Google Places request failed due to provider/network error.",
        providerError: {
          error: "PROVIDER_ERROR",
          message: "Live lookup failed or quota exceeded. Falling back to sandbox simulation.",
        },
      };
    }
  }
}
