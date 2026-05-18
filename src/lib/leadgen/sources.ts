import { GooglePlacesAdapter } from "@/lib/leadgen/live-adapters/google-places-adapter";
import type { LiveAdapterFetchResult, LiveAdapterProviderError, LiveAdapterQuery } from "@/lib/leadgen/live-adapters/types";
import { YelpAPIAdapter } from "@/lib/leadgen/live-adapters/yelp-api-adapter";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import type { LeadOpportunity, LeadSourceType } from "@/lib/leadgen/types";
import { logger } from "@/lib/logger";

type ConnectorEnvFlags = {
  googleSheetsConfigured?: boolean;
  googlePlacesConfigured?: boolean;
  yelpConfigured?: boolean;
};

const DISCOVERY_SOURCES: LeadSourceType[] = ["google_places", "yelp_fusion"];

export type LeadSourceAdapter = {
  id: LeadSourceType;
  label: string;
  description: string;
  enabled: boolean;
  requiresEnv: string[];
  safetyNotes: string;
  fetchLeads: (query?: LiveAdapterQuery) => Promise<LiveAdapterFetchResult>;
};

function disabledAdapter(
  id: LeadSourceType,
  label: string,
  description: string,
  requiresEnv: string[],
  safetyNotes: string,
): LeadSourceAdapter {
  return {
    id,
    label,
    description,
    enabled: false,
    requiresEnv,
    safetyNotes,
    async fetchLeads() {
      return {
        status: "READY",
        leads: [],
        blocked: false,
        message: `${label} is disabled.`,
      };
    },
  };
}

export function getLeadSourceAdapters(flags: ConnectorEnvFlags = {}): LeadSourceAdapter[] {
  const googlePlacesAdapter = new GooglePlacesAdapter();
  const yelpApiAdapter = new YelpAPIAdapter();
  const googlePlacesConfigured =
    flags.googlePlacesConfigured ?? Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
  const yelpConfigured = flags.yelpConfigured ?? Boolean(process.env.YELP_API_KEY?.trim());

  const mockAdapter: LeadSourceAdapter = {
    id: "mock_local",
    label: "Mock Local Dataset",
    description: "Curated mock opportunities for safe phase-1 product development.",
    enabled: true,
    requiresEnv: [],
    safetyNotes: "No external calls. Deterministic local data only.",
    async fetchLeads() {
      return {
        status: "READY",
        leads: getMockLeadOpportunities(),
        blocked: false,
        message: "Mock local leads loaded.",
      };
    },
  };

  const manualCsvAdapter: LeadSourceAdapter = {
    id: "manual_csv",
    label: "Manual CSV Upload",
    description: "Upload your own list and score locally in the browser.",
    enabled: true,
    requiresEnv: [],
    safetyNotes: "No network call required. Browser-side parsing only.",
    async fetchLeads() {
      return {
        status: "READY",
        leads: [],
        blocked: false,
        message: "Manual CSV adapter is ingest-only.",
      };
    },
  };

  const domainListAdapter: LeadSourceAdapter = {
    id: "domain_list",
    label: "Website / Domain List",
    description: "Paste or import domain lists for qualification.",
    enabled: true,
    requiresEnv: [],
    safetyNotes: "No live crawling in phase 1.",
    async fetchLeads() {
      return {
        status: "READY",
        leads: [],
        blocked: false,
        message: "Domain list adapter is ingest-only.",
      };
    },
  };

  const googleSheets = flags.googleSheetsConfigured
    ? disabledAdapter(
        "google_sheets",
        "Google Sheets Sync",
        "Read/write to Google Sheets lead tracking docs.",
        ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"],
        "Connector scaffolded but intentionally disabled in phase 1.",
      )
    : disabledAdapter(
        "google_sheets",
        "Google Sheets Sync",
        "Read/write to Google Sheets lead tracking docs.",
        ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"],
        "Missing environment variables. No external calls executed.",
      );

  const googlePlaces: LeadSourceAdapter = {
    id: "google_places",
    label: "Google Places Discovery",
    description: "Discover local businesses from city + category terms.",
    enabled: googlePlacesConfigured,
    requiresEnv: ["GOOGLE_PLACES_API_KEY"],
    safetyNotes:
      "Phase-4 scaffold. Blocks without env key, honors LEADGEN_SANDBOX_MODE cache bypass, and enforces kill-switch + result caps.",
    async fetchLeads(query) {
      return googlePlacesAdapter.fetchLeads(query);
    },
  };

  const yelpFusion: LeadSourceAdapter = {
    id: "yelp_fusion",
    label: "Yelp Fusion Discovery",
    description: "Find local opportunities via Yelp categories and geographies.",
    enabled: yelpConfigured,
    requiresEnv: ["YELP_API_KEY"],
    safetyNotes:
      "Phase-4 scaffold. Blocks without env key, honors LEADGEN_SANDBOX_MODE cache bypass, and enforces kill-switch + result caps.",
    async fetchLeads(query) {
      return yelpApiAdapter.fetchLeads(query);
    },
  };

  const futureConnector = disabledAdapter(
    "future_connector",
    "Local Category Search",
    "Future connector placeholder for provider-based search.",
    ["TBD_PROVIDER_KEY"],
    "Feature-flagged placeholder only.",
  );

  return [
    mockAdapter,
    manualCsvAdapter,
    domainListAdapter,
    googleSheets,
    googlePlaces,
    yelpFusion,
    futureConnector,
  ];
}

export function parseDiscoveryQuery(input: string): LiveAdapterQuery {
  const textQuery = input.trim().replace(/\s+/g, " ");
  if (!textQuery) return { city: "San Jose", category: "Local Services", textQuery: "" };
  const inMatch = textQuery.match(/^(.+?)\s+in\s+(.+)$/i);
  const category = inMatch?.[1]?.trim() || "Local Services";
  const city = inMatch?.[2]?.trim() || "San Jose";
  return { city, category, textQuery };
}

export async function discoverLeadgenOpportunities(queryText: string) {
  const adapters = getLeadSourceAdapters();
  const query = parseDiscoveryQuery(queryText);
  const discoveryAdapters = adapters.filter(
    (adapter) =>
      DISCOVERY_SOURCES.includes(adapter.id) && adapter.fetchLeads,
  );

  const buckets = await Promise.all(discoveryAdapters.map((adapter) => adapter.fetchLeads(query)));
  const providerWarnings: LiveAdapterProviderError[] = [];
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const adapter = discoveryAdapters[i];
    if (bucket.providerError) {
      providerWarnings.push(bucket.providerError);
      // Surface the underlying adapter message (which carries the HTTP status
      // for !response.ok paths) so the operator can correlate the UI banner
      // with the actual provider rejection.
      logger.error("leadgen.discovery.providerFallback", {
        source: adapter?.id ?? "unknown",
        message: bucket.message,
        textQuery: query.textQuery ?? "",
      });
    }
  }
  const seen = new Set<string>();
  const merged: LeadOpportunity[] = [];
  for (const lead of buckets.flatMap((bucket) => bucket.leads)) {
    const dedupeKey = `${lead.businessName.toLowerCase()}|${lead.city.toLowerCase()}|${lead.website?.toLowerCase() ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(lead);
  }

  return {
    query,
    leads: merged,
    providerWarnings,
  };
}
