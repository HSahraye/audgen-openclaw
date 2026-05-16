export const LEAD_SOURCES = [
  "manual_csv",
  "google_sheets",
  "google_places",
  "domain_list",
  "mock_local",
  "future_connector",
] as const;

export type LeadSourceType = (typeof LEAD_SOURCES)[number];

export const OPPORTUNITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export type OpportunityLevel = (typeof OPPORTUNITY_LEVELS)[number];

export const LEAD_OPPORTUNITY_STATUSES = ["new", "reviewed", "exported", "queued"] as const;
export type LeadOpportunityStatus = (typeof LEAD_OPPORTUNITY_STATUSES)[number];

export type WebsiteQuality = "none" | "weak" | "average" | "strong";
export type ResponseSpeedSignal = "unknown" | "slow" | "average" | "fast";
export type PresenceSignal = "missing" | "limited" | "good";

export type LeadOpportunity = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleProfileUrl: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  hasGoogleBusinessProfile: boolean;
  hasBookingLink: boolean;
  hasContactForm: boolean;
  hasSocialLinks: boolean;
  websiteQuality: WebsiteQuality;
  responseSpeedSignal: ResponseSpeedSignal;
  source: LeadSourceType;
  sourceUrl: string | null;
  status: LeadOpportunityStatus;
  estimatedNeedScore: number;
  estimatedRevenuePotential: number;
  opportunityLevel: OpportunityLevel;
  presenceGaps: string[];
  recommendedOffer: string;
  suggestedPitch: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadOpportunitySeed = Omit<
  LeadOpportunity,
  | "estimatedNeedScore"
  | "estimatedRevenuePotential"
  | "opportunityLevel"
  | "presenceGaps"
  | "recommendedOffer"
  | "suggestedPitch"
>;

export type LeadOpportunityFilters = {
  textQuery?: string;
  city?: string;
  category?: string;
  source?: LeadSourceType | "all";
  minNeedScore?: number;
  websiteStatus?: "all" | "missing" | "present";
  googleProfileStatus?: "all" | "missing" | "present";
  minReviewCount?: number | null;
  maxReviewCount?: number | null;
  minRating?: number | null;
  maxRating?: number | null;
  opportunityLevel?: OpportunityLevel | "all";
  status?: LeadOpportunityStatus | "all";
};
