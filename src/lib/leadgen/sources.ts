import { GooglePlacesAdapter } from "@/lib/leadgen/live-adapters/google-places-adapter";
import type { LiveAdapterQuery } from "@/lib/leadgen/live-adapters/types";
import { YelpAPIAdapter } from "@/lib/leadgen/live-adapters/yelp-api-adapter";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import type { LeadOpportunity, LeadSourceType } from "@/lib/leadgen/types";

type ConnectorEnvFlags = {
  googleSheetsConfigured?: boolean;
  googlePlacesConfigured?: boolean;
  yelpConfigured?: boolean;
};

export type LeadSourceAdapter = {
  id: LeadSourceType;
  label: string;
  description: string;
  enabled: boolean;
  requiresEnv: string[];
  safetyNotes: string;
  fetchLeads: (query?: LiveAdapterQuery) => Promise<LeadOpportunity[]>;
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
      return [];
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
      return getMockLeadOpportunities();
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
      return [];
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
      return [];
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
      const result = await googlePlacesAdapter.fetchLeads(query);
      return result.leads;
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
      const result = await yelpApiAdapter.fetchLeads(query);
      return result.leads;
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
