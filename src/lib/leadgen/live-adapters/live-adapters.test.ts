import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GooglePlacesAdapter,
  mapGooglePlacesToLeadOpportunities,
} from "@/lib/leadgen/live-adapters/google-places-adapter";
import { MAX_LIVE_SEARCH_RESULTS } from "@/lib/leadgen/live-adapters/types";
import {
  mapYelpBusinessesToLeadOpportunities,
  YelpAPIAdapter,
} from "@/lib/leadgen/live-adapters/yelp-api-adapter";

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
  vi.restoreAllMocks();
});

describe("live connector adapters", () => {
  it("returns MISSING_ENV for Google Places when API key is absent", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const adapter = new GooglePlacesAdapter();
    const result = await adapter.fetchLeads();
    expect(result.status).toBe("MISSING_ENV");
    expect(result.blocked).toBe(true);
    expect(result.leads).toEqual([]);
  });

  it("returns MISSING_ENV for Yelp when API key is absent", async () => {
    delete process.env.YELP_API_KEY;
    const adapter = new YelpAPIAdapter();
    const result = await adapter.fetchLeads();
    expect(result.status).toBe("MISSING_ENV");
    expect(result.blocked).toBe(true);
    expect(result.leads).toEqual([]);
  });

  it("uses sandbox synthesized leads with city/category context", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.LEADGEN_SANDBOX_MODE = "true";
    const adapter = new GooglePlacesAdapter();
    const result = await adapter.fetchLeads({ city: "San Jose", category: "Dentists" });
    expect(result.status).toBe("SANDBOX_MODE");
    expect(result.leads.length).toBeGreaterThan(0);
    expect(result.leads.length).toBeLessThanOrEqual(MAX_LIVE_SEARCH_RESULTS);
    expect(result.leads.every((lead) => lead.source === "google_places")).toBe(true);
    expect(result.leads.some((lead) => lead.businessName.toLowerCase().includes("san jose"))).toBe(true);
    expect(result.leads.some((lead) => lead.category.toLowerCase().includes("dentists"))).toBe(true);
  });

  it("kill-switch falls back to sandbox synthesis when live env is configured", async () => {
    process.env.YELP_API_KEY = "test-key";
    process.env.LEADGEN_SANDBOX_MODE = "false";
    process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = "false";
    const adapter = new YelpAPIAdapter();
    const result = await adapter.fetchLeads({ city: "Austin", category: "Plumbers" });
    expect(result.status).toBe("SANDBOX_MODE");
    expect(result.blocked).toBe(false);
    expect(result.leads.length).toBeGreaterThan(0);
  });

  it("normalizes raw Google place properties into lead opportunities", async () => {
    const mapped = await mapGooglePlacesToLeadOpportunities(
      [
        {
          id: "place-123",
          displayName: { text: "Silverline Dental Care" },
          formattedAddress: "100 Main St, San Jose, CA 95113",
          nationalPhoneNumber: "+1 408-555-1212",
          websiteUri: "https://silverlinedental.example",
          rating: 4.2,
          userRatingCount: 71,
          googleMapsUri: "https://maps.google.com/?cid=abc",
          primaryTypeDisplayName: { text: "Dentists" },
        },
      ],
      { city: "San Jose", category: "Dentists" },
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      businessName: "Silverline Dental Care",
      city: "San Jose",
      state: "CA",
      phone: "+1 408-555-1212",
      website: "https://silverlinedental.example",
      rating: 4.2,
      reviewCount: 71,
      source: "google_places",
    });
    expect(mapped[0].presenceGaps.length).toBeGreaterThan(0);
  });

  it("normalizes raw Yelp search properties into lead opportunities", async () => {
    const mapped = await mapYelpBusinessesToLeadOpportunities(
      [
        {
          id: "yelp-1",
          name: "Downtown Smile Studio",
          phone: "+14085553333",
          url: "https://www.yelp.com/biz/downtown-smile-studio",
          rating: 3.9,
          review_count: 42,
          categories: [{ title: "Dentists" }, { title: "Cosmetic Dentists" }],
          location: {
            city: "San Jose",
            state: "CA",
            display_address: ["100 Main St", "San Jose, CA 95113"],
          },
        },
      ],
      { city: "San Jose", category: "Dentists" },
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      businessName: "Downtown Smile Studio",
      city: "San Jose",
      state: "CA",
      phone: "+14085553333",
      website: "https://www.yelp.com/biz/downtown-smile-studio",
      rating: 3.9,
      reviewCount: 42,
      source: "yelp_fusion",
    });
    expect(mapped[0].category).toContain("Dentists");
  });

  it("maps live Google API fetch payloads without making real network requests", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.LEADGEN_SANDBOX_MODE = "false";
    process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = "true";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ places: [{ name: "places/abc123" }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "abc123",
          displayName: { text: "San Jose Dental Care" },
          formattedAddress: "100 Main St, San Jose, CA 95113",
          nationalPhoneNumber: "+1 408-555-1212",
          websiteUri: "https://sjdental.example",
          rating: 4.1,
          userRatingCount: 33,
          googleMapsUri: "https://maps.google.com/?cid=abc123",
          primaryTypeDisplayName: { text: "Dentists" },
        }),
      } as Response);

    const adapter = new GooglePlacesAdapter();
    const result = await adapter.fetchLeads({ city: "San Jose", category: "Dentists", limit: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("READY");
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].businessName).toBe("San Jose Dental Care");
  });

  it("maps live Yelp API fetch payloads without making real network requests", async () => {
    process.env.YELP_API_KEY = "test-key";
    process.env.LEADGEN_SANDBOX_MODE = "false";
    process.env.LEADGEN_LIVE_CONNECTORS_ENABLED = "true";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        businesses: [
          {
            id: "yelp-a",
            name: "Silicon Valley Smile Studio",
            phone: "+14085550000",
            url: "https://www.yelp.com/biz/sv-smile-studio",
            rating: 4.4,
            review_count: 90,
            categories: [{ title: "Dentists" }],
            location: {
              city: "San Jose",
              state: "CA",
              display_address: ["200 Market St", "San Jose, CA 95113"],
            },
          },
        ],
      }),
    } as Response);

    const adapter = new YelpAPIAdapter();
    const result = await adapter.fetchLeads({ city: "San Jose", category: "Dentists", limit: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("READY");
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].businessName).toBe("Silicon Valley Smile Studio");
  });
});
