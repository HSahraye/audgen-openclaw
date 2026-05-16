import type { LeadOpportunity } from "@/lib/leadgen/types";

export const MAX_LIVE_SEARCH_RESULTS = 20;
export const MAX_SANDBOX_SEARCH_RESULTS = 15;

export type LiveAdapterQuery = {
  city?: string;
  category?: string;
  textQuery?: string;
  limit?: number;
};

export type LiveAdapterRuntimeStatus =
  | "READY"
  | "MISSING_ENV"
  | "SANDBOX_MODE"
  | "DISABLED_BY_KILL_SWITCH";

export type LiveAdapterFetchResult = {
  status: LiveAdapterRuntimeStatus;
  leads: LeadOpportunity[];
  blocked: boolean;
  message: string;
};
