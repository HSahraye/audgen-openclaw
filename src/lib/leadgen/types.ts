export const LEAD_SOURCES = [
  "manual_csv",
  "google_sheets",
  "google_places",
  "yelp_fusion",
  "domain_list",
  "mock_local",
  "future_connector",
] as const;

export type LeadSourceType = (typeof LEAD_SOURCES)[number];

export const OPPORTUNITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export type OpportunityLevel = (typeof OPPORTUNITY_LEVELS)[number];

export const LEAD_OPPORTUNITY_WORKFLOW_STATUSES = [
  "discovered",
  "reviewed",
  "exported",
  "queued",
  "audit_generated",
  "contacted",
  "follow_up",
  "won",
  "lost",
  "archived",
] as const;
export type LeadOpportunityWorkflowStatus =
  (typeof LEAD_OPPORTUNITY_WORKFLOW_STATUSES)[number];

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
  status: LeadOpportunityWorkflowStatus;
  estimatedNeedScore: number;
  estimatedRevenuePotential: number;
  opportunityLevel: OpportunityLevel;
  presenceGaps: string[];
  recommendedOffer: string;
  suggestedPitch: string;
  lastActionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadgenSavedView = {
  id: string;
  name: string;
  filters: LeadOpportunityFilters;
  columnOrder?: string[];
  sorting?: string;
  isPreset: boolean;
};

export type LeadgenActivityEventType =
  | "discovered"
  | "score_calculated"
  | "exported_csv"
  | "added_to_audgen_queue"
  | "status_changed"
  | "audit_generation_requested"
  | "audit_generation_requires_approval"
  | "note_added";

export type LeadgenActivityEvent = {
  id: string;
  opportunityId: string;
  eventType: LeadgenActivityEventType;
  detail: string;
  createdAt: string;
};

export type LeadOpportunitySeed = Omit<
  LeadOpportunity,
  | "estimatedNeedScore"
  | "estimatedRevenuePotential"
  | "opportunityLevel"
  | "presenceGaps"
  | "recommendedOffer"
  | "suggestedPitch"
  | "lastActionAt"
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
  status?: LeadOpportunityWorkflowStatus | "all";
};
