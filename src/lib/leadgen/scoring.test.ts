import { describe, expect, it } from "vitest";
import { mapOpportunityLevel, scoreLeadOpportunity } from "@/lib/leadgen/scoring";
import type { LeadOpportunitySeed } from "@/lib/leadgen/types";

const baseSeed: LeadOpportunitySeed = {
  id: "seed-a",
  businessName: "Test Plumbing Co",
  category: "Plumbing",
  city: "San Jose",
  state: "CA",
  phone: null,
  email: null,
  website: "https://example.com",
  googleProfileUrl: "https://maps.google.com/?cid=test",
  address: null,
  rating: 4.2,
  reviewCount: 40,
  hasWebsite: true,
  hasGoogleBusinessProfile: true,
  hasBookingLink: true,
  hasContactForm: true,
  hasSocialLinks: true,
  websiteQuality: "average",
  responseSpeedSignal: "average",
  source: "mock_local",
  sourceUrl: null,
  status: "new",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("leadgen scoring", () => {
  it("no website increases score", () => {
    const withWebsite = scoreLeadOpportunity(baseSeed);
    const withoutWebsite = scoreLeadOpportunity({
      ...baseSeed,
      hasWebsite: false,
      website: null,
      websiteQuality: "none",
    });
    expect(withoutWebsite.estimatedNeedScore).toBeGreaterThan(withWebsite.estimatedNeedScore);
  });

  it("missing GBP increases score", () => {
    const withGbp = scoreLeadOpportunity(baseSeed);
    const withoutGbp = scoreLeadOpportunity({
      ...baseSeed,
      hasGoogleBusinessProfile: false,
      googleProfileUrl: null,
    });
    expect(withoutGbp.estimatedNeedScore).toBeGreaterThan(withGbp.estimatedNeedScore);
  });

  it("low review count increases score", () => {
    const highReviews = scoreLeadOpportunity({ ...baseSeed, reviewCount: 120, rating: 4.7 });
    const lowReviews = scoreLeadOpportunity({ ...baseSeed, reviewCount: 3, rating: 3.8 });
    expect(lowReviews.estimatedNeedScore).toBeGreaterThan(highReviews.estimatedNeedScore);
  });

  it("high-opportunity categories score higher than default", () => {
    const generic = scoreLeadOpportunity({ ...baseSeed, category: "Retail" });
    const hvac = scoreLeadOpportunity({ ...baseSeed, category: "HVAC Services" });
    expect(hvac.estimatedNeedScore).toBeGreaterThan(generic.estimatedNeedScore);
  });

  it("score stays between 0 and 100", () => {
    const extreme = scoreLeadOpportunity({
      ...baseSeed,
      hasWebsite: false,
      website: null,
      websiteQuality: "none",
      hasGoogleBusinessProfile: false,
      googleProfileUrl: null,
      hasBookingLink: false,
      hasContactForm: false,
      hasSocialLinks: false,
      reviewCount: 0,
      rating: 1.2,
      responseSpeedSignal: "slow",
    });
    expect(extreme.estimatedNeedScore).toBeGreaterThanOrEqual(0);
    expect(extreme.estimatedNeedScore).toBeLessThanOrEqual(100);
  });

  it("maps opportunity levels correctly", () => {
    expect(mapOpportunityLevel(10)).toBe("Low");
    expect(mapOpportunityLevel(46)).toBe("Medium");
    expect(mapOpportunityLevel(71)).toBe("High");
    expect(mapOpportunityLevel(90)).toBe("Critical");
  });
});
