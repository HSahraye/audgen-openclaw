import type { LeadIntelligence } from "@/lib/intelligence/types";
import type { ResolvedTemplate } from "@/lib/templates";

export type AuditInput = {
  businessName: string;
  ownerName?: string;
  category?: string;
  location?: string;
  websiteUrl?: string;
  googleProfileUrl?: string;
  notes?: string;
  workspaceId?: string;
};

export type AuditChecks = {
  hasWebsite: boolean;
  outdatedWebsite: boolean;
  mobileFriendly: boolean;
  clearCta: boolean;
  phoneEasyToFind: boolean;
  reviewsVisible: boolean;
  onlineBooking: boolean;
  trustSection: boolean;
  gallery: boolean;
  serviceList: boolean;
  pricing: boolean;
  faq: boolean;
};

export type GeneratedAssets = {
  leadScore: number;
  painPointSummary: string;
  recommendedPackage: string;
  likelyMoneyLost: string;
  presenceLabsOffer: string;
  estimatedAnnualLoss?: number;
  coldCallScript: string;
  textMessageScript: string;
  emailScript: string;
  thirtySecondPitch: string;
  followUpMessage: string;
  proposalOutline: string[];
};

export type AuditResult = {
  checks: AuditChecks;
  assets: GeneratedAssets;
  intelligence: LeadIntelligence;
  websiteSignals: string[];
  warnings: string[];
  source: "claude" | "gemini" | "local-fallback" | "intelligence-gemini" | "intelligence-local";
  generatedContext?: GenerationContextSnapshot;
};

export type GenerationContextSnapshot = {
  generationVersion: string;
  workspaceId: string | null;
  workspaceName: string | null;
  branding: {
    brandName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    typography: string | null;
    senderIdentity: string | null;
    footerContent: string | null;
    ctaLabelPrimary: string | null;
    ctaLabelSecondary: string | null;
    auditIntroCopy: string | null;
    auditOutroCopy: string | null;
  };
  templates: {
    audit: Pick<ResolvedTemplate, "id" | "name" | "source" | "version" | "category">;
    outreach: Pick<ResolvedTemplate, "id" | "name" | "source" | "version" | "category">;
    offer: Pick<ResolvedTemplate, "id" | "name" | "source" | "version" | "category">;
  };
  templateSnapshot: {
    audit: ResolvedTemplate;
    outreach: ResolvedTemplate;
    offer: ResolvedTemplate;
  };
  scoringSummary: {
    closeProbability: number;
    urgencyScore: number;
    momentumScore: number | null;
  };
  providerMetadata: {
    source: string;
    /** Set when the LLM audit engine produced (or attempted to produce) the assets. */
    llmSource?: "llm" | "llm-fallback";
    llmVertical?: string;
    llmVerticalDisplayName?: string;
    llmModel?: string;
    llmInputTokens?: number;
    llmOutputTokens?: number;
    llmEstimatedCostUsd?: number;
    llmDurationMs?: number;
    llmFallbackReason?: string;
  };
};
