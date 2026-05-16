import type { CsvRow } from "@/lib/csv";
import { pick } from "@/lib/csv";

export const LEADGEN_CSV_ALIASES = {
  businessName: [
    "business name",
    "business",
    "company",
    "company name",
    "name",
    "title",
    "store name",
    "legal name",
  ],
  website: ["website", "website url", "url", "site", "web address", "domain"],
  phone: ["phone", "phone number", "telephone", "ph", "cell", "mobile"],
  location: ["city", "location", "area"],
  ownerName: ["owner", "owner name", "contact", "contact name"],
  category: ["industry/category", "industry", "category", "type"],
  email: ["email", "email address"],
  notes: ["notes", "note", "description"],
  state: ["state"],
  googleProfileUrl: ["google profile", "google profile url", "google business profile"],
  rating: ["rating"],
  reviewCount: ["review count", "reviews"],
  address: ["address"],
} as const;

export type LeadgenCsvAliasField = keyof typeof LEADGEN_CSV_ALIASES;

export function pickLeadgenCsvField(row: CsvRow, field: LeadgenCsvAliasField) {
  return pick(row, LEADGEN_CSV_ALIASES[field]);
}
