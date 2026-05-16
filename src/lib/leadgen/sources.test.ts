import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverLeadgenOpportunities,
  getLeadSourceAdapters,
  parseDiscoveryQuery,
} from "@/lib/leadgen/sources";

const ORIGINAL_ENV = {
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  YELP_API_KEY: process.env.YELP_API_KEY,
  LEADGEN_SANDBOX_MODE: process.env.LEADGEN_SANDBOX_MODE,
  LEADGEN_LIVE_CONNECTORS_ENABLED: process.env.LEADGEN_LIVE_CONNECTORS_ENABLED,
};

afterEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_ENV.GOOGLE_PLACES_API_KEY;
  process.env.YELP_API_KEY = ORIGINAL_ENV.YELP_API_KEY;
  process.env.LEADGEN_SANDBOX_MODE = ORIGINAL_ENV.LEADGEN_SANDBOX_MODE;
  process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = ORIGINAL_ENV.LEADGEN_LIVE_CONNECTORS_ENABLED;
});

describe("leadgen source adapters", () => {
  it("mock provider returns local leads", async () => {
    const adapters = getLeadSourceAdapters();
    const mock = adapters.find((adapter) => adapter.id === "mock_local");
    expect(mock?.enabled).toBe(true);
    const leads = await mock?.fetchLeads();
    expect((leads ?? []).length).toBeGreaterThan(0);
  });

  it("disabled providers do not call external APIs", async () => {
    process.env.LEADGEN_SANDBOX_MODE = "true";
    process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = "false";
    const adapters = getLeadSourceAdapters({ googlePlacesConfigured: false });
    const disabled = adapters.find((adapter) => adapter.id === "google_places");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const spy = vi.fn(async () => disabled?.fetchLeads() ?? []);
    const leads = await spy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(disabled?.enabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Array.isArray(leads)).toBe(true);
  });

  it("missing env vars fail gracefully via disabled metadata", () => {
    const adapters = getLeadSourceAdapters({ googleSheetsConfigured: false });
    const sheets = adapters.find((adapter) => adapter.id === "google_sheets");
    expect(sheets?.enabled).toBe(false);
    expect(sheets?.requiresEnv).toContain("GOOGLE_SHEETS_CLIENT_EMAIL");
  });

  it("includes scaffolded Yelp adapter with env requirements", () => {
    const adapters = getLeadSourceAdapters({ yelpConfigured: false });
    const yelp = adapters.find((adapter) => adapter.id === "yelp_fusion");
    expect(yelp).toBeDefined();
    expect(yelp?.enabled).toBe(false);
    expect(yelp?.requiresEnv).toContain("YELP_API_KEY");
  });

  it("parses category and city from discovery query input", () => {
    const query = parseDiscoveryQuery("Dentists in San Jose");
    expect(query.category).toBe("Dentists");
    expect(query.city).toBe("San Jose");
    expect(query.textQuery).toBe("Dentists in San Jose");
  });

  it("runs discovery dispatcher through sandbox adapters", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.YELP_API_KEY = "test-key";
    process.env.LEADGEN_SANDBOX_MODE = "true";
    process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = "false";

    const result = await discoverLeadgenOpportunities("Roofers in Miami");
    expect(result.query.category).toBe("Roofers");
    expect(result.query.city).toBe("Miami");
    expect(result.leads.length).toBeGreaterThan(0);
    expect(result.leads.some((lead) => lead.businessName.toLowerCase().includes("miami"))).toBe(true);
  });
});
