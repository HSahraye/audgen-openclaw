import { toCsv } from "@/lib/csv";
import type { LeadOpportunity } from "@/lib/leadgen/types";

export const LEADGEN_EXPORT_HEADERS = [
  "Business Name",
  "Category",
  "City",
  "State",
  "Phone",
  "Email",
  "Website",
  "Google Profile URL",
  "Rating",
  "Review Count",
  "Need Score",
  "Opportunity Level",
  "Revenue Potential",
  "Presence Gaps",
  "Recommended Offer",
  "Suggested Pitch",
  "Source",
  "Status",
] as const;

function mapExportRow(lead: LeadOpportunity) {
  return {
    "Business Name": lead.businessName,
    Category: lead.category,
    City: lead.city,
    State: lead.state,
    Phone: lead.phone ?? "",
    Email: lead.email ?? "",
    Website: lead.website ?? "",
    "Google Profile URL": lead.googleProfileUrl ?? "",
    Rating: lead.rating == null ? "" : lead.rating.toFixed(1),
    "Review Count": lead.reviewCount == null ? "" : String(lead.reviewCount),
    "Need Score": String(lead.estimatedNeedScore),
    "Opportunity Level": lead.opportunityLevel,
    "Revenue Potential": String(lead.estimatedRevenuePotential),
    "Presence Gaps": lead.presenceGaps.join("; "),
    "Recommended Offer": lead.recommendedOffer,
    "Suggested Pitch": lead.suggestedPitch,
    Source: lead.source,
    Status: lead.status,
  };
}

export function toLeadGenCsv(leads: LeadOpportunity[]) {
  const rows = leads.map(mapExportRow);
  return toCsv(rows, [...LEADGEN_EXPORT_HEADERS]);
}

export function toGoogleSheetsReadyCsv(leads: LeadOpportunity[]) {
  const rows = leads.map(mapExportRow);
  return toCsv(rows, [...LEADGEN_EXPORT_HEADERS]);
}
