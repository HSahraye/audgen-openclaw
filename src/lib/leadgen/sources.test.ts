import { describe, expect, it, vi } from "vitest";
import { getLeadSourceAdapters } from "@/lib/leadgen/sources";

describe("leadgen source adapters", () => {
  it("mock provider returns local leads", async () => {
    const adapters = getLeadSourceAdapters();
    const mock = adapters.find((adapter) => adapter.id === "mock_local");
    expect(mock?.enabled).toBe(true);
    const leads = await mock?.fetchLeads();
    expect((leads ?? []).length).toBeGreaterThan(0);
  });

  it("disabled providers do not call external APIs", async () => {
    const adapters = getLeadSourceAdapters();
    const disabled = adapters.find((adapter) => adapter.id === "google_places");
    const spy = vi.fn(async () => disabled?.fetchLeads() ?? []);
    const leads = await spy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(disabled?.enabled).toBe(false);
    expect(leads).toEqual([]);
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
});
