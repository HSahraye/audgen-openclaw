import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadgenOpportunity, ResearchQueueItem } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  leadgenOpportunityCount: vi.fn(),
  leadgenOpportunityFindMany: vi.fn(),
  researchQueueItemFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadgenOpportunity: {
      count: mocks.leadgenOpportunityCount,
      findMany: mocks.leadgenOpportunityFindMany,
    },
    researchQueueItem: {
      findMany: mocks.researchQueueItemFindMany,
    },
  },
}));

import {
  deserializeLeadgenViewFilters,
  getPresetLeadgenSavedViews,
  listLeadgenOpportunities,
  mapDedicatedRecordToLeadOpportunity,
  mapLegacyQueueItemToLeadOpportunity,
  serializeLeadgenViewFilters,
} from "@/lib/leadgen/persistence";

describe("leadgen persistence helpers", () => {
  beforeEach(() => {
    mocks.leadgenOpportunityCount.mockReset();
    mocks.leadgenOpportunityFindMany.mockReset();
    mocks.researchQueueItemFindMany.mockReset();
  });

  it("serializes and deserializes saved view filters stably", () => {
    const filters = { city: "San Jose", minNeedScore: 70, status: "reviewed" as const };
    const serialized = serializeLeadgenViewFilters(filters);
    const parsed = deserializeLeadgenViewFilters(serialized);
    expect(parsed).toEqual(filters);
  });

  it("falls back to empty filters when deserialization fails", () => {
    expect(deserializeLeadgenViewFilters("not-json")).toEqual({});
  });

  it("returns required preset saved views", () => {
    const names = getPresetLeadgenSavedViews().map((item) => item.name);
    expect(names).toContain("Missing Website");
    expect(names).toContain("High Opportunity");
    expect(names).toContain("Queued");
  });

  it("maps legacy queue items with serialized metadata", () => {
    const queueItem = {
      id: "legacy_1",
      businessName: "Acme Dental",
      websiteUrl: "https://acme.example",
      location: "San Jose, CA",
      category: "Dental",
      phone: null,
      email: null,
      source: "leadgen:manual_csv",
      status: "reviewed",
      notes: `__leadgen_meta__:${JSON.stringify({
        city: "San Jose",
        state: "CA",
        address: "1 Main St",
        rating: 4.3,
        reviewCount: 18,
        hasWebsite: true,
        hasGoogleBusinessProfile: false,
        hasBookingLink: false,
        hasContactForm: true,
        hasSocialLinks: false,
        websiteQuality: "average",
        responseSpeedSignal: "slow",
        source: "manual_csv",
        sourceUrl: null,
        estimatedNeedScore: 72,
        estimatedRevenuePotential: 4200,
        opportunityLevel: "High",
        presenceGaps: ["No booking link"],
        recommendedOffer: "Conversion package",
        suggestedPitch: "Improve appointment conversion",
        lastActionAt: "2026-05-16T00:00:00.000Z",
      })}`,
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    } as const;

    const mapped = mapLegacyQueueItemToLeadOpportunity(queueItem as unknown as ResearchQueueItem);
    expect(mapped.businessName).toBe("Acme Dental");
    expect(mapped.city).toBe("San Jose");
    expect(mapped.estimatedNeedScore).toBe(72);
    expect(mapped.presenceGaps).toEqual(["No booking link"]);
  });

  it("maps dedicated records and parses array fields", () => {
    const record = {
      id: "db_1",
      externalId: "lead_123",
      businessName: "Noble HVAC",
      category: "Contractor",
      city: "Austin",
      state: "TX",
      address: null,
      websiteUrl: null,
      googleProfileUrl: null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: null,
      hasWebsite: false,
      hasGoogleBusinessProfile: false,
      hasBookingLink: false,
      hasContactForm: false,
      hasSocialLinks: false,
      websiteQuality: "none",
      responseSpeedSignal: "unknown",
      source: "manual_csv",
      sourceUrl: null,
      status: "discovered",
      estimatedNeedScore: 55,
      estimatedRevenuePotential: 1800,
      opportunityLevel: "Medium",
      presenceGapsJson: JSON.stringify(["No website", "No GBP"]),
      pitchAnglesJson: JSON.stringify(["Modernize your local lead capture"]),
      recommendedOffer: "Starter web package",
      suggestedPitch: "Fallback pitch",
      sourceMetricsJson: null,
      lastActionAt: null,
      workspaceId: "ws_1",
      legacyQueueItemId: null,
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    } as const;

    const mapped = mapDedicatedRecordToLeadOpportunity(record as unknown as LeadgenOpportunity);
    expect(mapped.id).toBe("lead_123");
    expect(mapped.presenceGaps).toEqual(["No website", "No GBP"]);
    expect(mapped.suggestedPitch).toBe("Modernize your local lead capture");
  });

  it("falls back to legacy query path when dedicated tables are unavailable", async () => {
    mocks.leadgenOpportunityCount.mockRejectedValue({ code: "P2021" });
    mocks.researchQueueItemFindMany.mockResolvedValue([
      {
        id: "legacy_fallback_1",
        businessName: "Fallback Plumbing",
        websiteUrl: null,
        location: "Denver, CO",
        category: "Plumber",
        phone: null,
        email: null,
        source: "leadgen:manual_csv",
        status: "discovered",
        notes: null,
        createdAt: new Date("2026-05-15T00:00:00.000Z"),
        updatedAt: new Date("2026-05-16T00:00:00.000Z"),
      },
    ]);

    const results = await listLeadgenOpportunities("ws_legacy");
    expect(results).toHaveLength(1);
    expect(results[0]?.businessName).toBe("Fallback Plumbing");
    expect(mocks.researchQueueItemFindMany).toHaveBeenCalledTimes(1);
  });
});
