import type { LeadSourceType } from "@/lib/leadgen/types";

export type ConnectorDiagnosticStatus =
  | "ready"
  | "mock"
  | "disabled"
  | "missing_env"
  | "requires_approval";

export type ConnectorDiagnostic = {
  id: string;
  label: string;
  sourceType: LeadSourceType | "google_sheets_import" | "google_sheets_export";
  status: ConnectorDiagnosticStatus;
  requiredEnv: string[];
  hasExternalCalls: boolean;
  safeNow: boolean;
  lastCheckedAt: string;
  safetyNote: string;
};

type ConnectorEnvState = {
  GOOGLE_SHEETS_CLIENT_EMAIL?: string;
  GOOGLE_SHEETS_PRIVATE_KEY?: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_PLACES_API_KEY?: string;
  YELP_API_KEY?: string;
  LEADGEN_LIVE_CONNECTORS_ENABLED?: string;
  LEADGEN_SANDBOX_MODE?: string;
};

function hasAllEnv(values: Array<string | undefined>) {
  return values.every((value) => Boolean(value && value.trim()));
}

export function buildConnectorDiagnostics(env: ConnectorEnvState): ConnectorDiagnostic[] {
  const now = new Date().toISOString();
  const sheetsEnv = hasAllEnv([
    env.GOOGLE_SHEETS_CLIENT_EMAIL,
    env.GOOGLE_SHEETS_PRIVATE_KEY,
    env.GOOGLE_SHEETS_SPREADSHEET_ID,
  ]);
  const placesEnv = hasAllEnv([env.GOOGLE_PLACES_API_KEY]);
  const yelpEnv = hasAllEnv([env.YELP_API_KEY]);
  const liveEnabled = env.LEADGEN_LIVE_CONNECTORS_ENABLED === "true";
  const sandboxMode = env.LEADGEN_SANDBOX_MODE === "true";
  const liveActive = liveEnabled && !sandboxMode;

  return [
    {
      id: "diag-mock-local",
      label: "Mock Local Leads",
      sourceType: "mock_local",
      status: "mock",
      requiredEnv: [],
      hasExternalCalls: false,
      safeNow: true,
      lastCheckedAt: now,
      safetyNote: "Deterministic local dataset only.",
    },
    {
      id: "diag-manual-csv",
      label: "Manual CSV Import",
      sourceType: "manual_csv",
      status: "ready",
      requiredEnv: [],
      hasExternalCalls: false,
      safeNow: true,
      lastCheckedAt: now,
      safetyNote: "Client-side parsing only. No remote calls.",
    },
    {
      id: "diag-sheets-export",
      label: "Google Sheets Export",
      sourceType: "google_sheets_export",
      status: sheetsEnv ? "requires_approval" : "missing_env",
      requiredEnv: ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"],
      hasExternalCalls: true,
      safeNow: false,
      lastCheckedAt: now,
      safetyNote: sheetsEnv
        ? "Connector scaffolded but requires Hamid approval before external API calls."
        : "Missing required env vars.",
    },
    {
      id: "diag-sheets-import",
      label: "Google Sheets Import",
      sourceType: "google_sheets_import",
      status: sheetsEnv ? "requires_approval" : "missing_env",
      requiredEnv: ["GOOGLE_SHEETS_CLIENT_EMAIL", "GOOGLE_SHEETS_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"],
      hasExternalCalls: true,
      safeNow: false,
      lastCheckedAt: now,
      safetyNote: sheetsEnv
        ? "Connector scaffolded but requires Hamid approval before external API calls."
        : "Missing required env vars.",
    },
    {
      id: "diag-google-places",
      label: "Google Places",
      sourceType: "google_places",
      status: placesEnv ? (liveActive ? "ready" : "requires_approval") : "missing_env",
      requiredEnv: ["GOOGLE_PLACES_API_KEY"],
      hasExternalCalls: true,
      safeNow: placesEnv && liveActive,
      lastCheckedAt: now,
      safetyNote: placesEnv
        ? liveActive
          ? "Live connector enabled. Runtime lookups execute against Google Places."
          : "API key detected, but live lookups are disabled by sandbox or kill-switch."
        : "Missing API key and approval gate.",
    },
    {
      id: "diag-domain-list",
      label: "Website/Domain List",
      sourceType: "domain_list",
      status: "ready",
      requiredEnv: [],
      hasExternalCalls: false,
      safeNow: true,
      lastCheckedAt: now,
      safetyNote: "Manual import only. No crawling or scraping.",
    },
    {
      id: "diag-yelp-fusion",
      label: "Yelp Fusion",
      sourceType: "yelp_fusion",
      status: yelpEnv ? (liveActive ? "ready" : "requires_approval") : "missing_env",
      requiredEnv: ["YELP_API_KEY"],
      hasExternalCalls: true,
      safeNow: yelpEnv && liveActive,
      lastCheckedAt: now,
      safetyNote: yelpEnv
        ? liveActive
          ? "Live connector enabled. Runtime lookups execute against Yelp Fusion."
          : "API key detected, but live lookups are disabled by sandbox or kill-switch."
        : "Missing API key and approval gate.",
    },
    {
      id: "diag-future-scraper",
      label: "Future Scraper Connector",
      sourceType: "future_connector",
      status: "disabled",
      requiredEnv: ["TBD_PROVIDER_KEY"],
      hasExternalCalls: true,
      safeNow: false,
      lastCheckedAt: now,
      safetyNote: "Intentionally disabled. Scraping is not enabled.",
    },
  ];
}
