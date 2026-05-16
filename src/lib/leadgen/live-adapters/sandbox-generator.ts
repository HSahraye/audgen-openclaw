import { scoreLeadOpportunity } from "@/lib/leadgen/scoring";
import {
  MAX_SANDBOX_SEARCH_RESULTS,
  type LiveAdapterQuery,
} from "@/lib/leadgen/live-adapters/types";
import type { LeadOpportunity, LeadSourceType } from "@/lib/leadgen/types";

const BUSINESS_PREFIXES = [
  "Prime",
  "Golden",
  "Summit",
  "Urban",
  "BlueSky",
  "Civic",
  "Evergreen",
  "Mission",
  "Valley",
  "Apex",
  "Harbor",
  "NorthStar",
  "Downtown",
  "Landmark",
  "Atlas",
];

const BUSINESS_SUFFIXES = [
  "Studio",
  "Collective",
  "Group",
  "Experts",
  "Hub",
  "Center",
  "Pros",
  "Partners",
  "Works",
  "Solutions",
  "Care",
  "Services",
  "Network",
  "Team",
  "Lab",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sanitizeToken(value: string | undefined, fallback: string) {
  const normalized = (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s-]/gi, "");
  return normalized || fallback;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferStateFromCity(city: string) {
  const lowered = city.toLowerCase();
  if (lowered.includes("san ") || lowered.includes("oakland") || lowered.includes("fremont")) return "CA";
  if (lowered.includes("austin") || lowered.includes("houston") || lowered.includes("dallas")) return "TX";
  if (lowered.includes("miami") || lowered.includes("orlando") || lowered.includes("tampa")) return "FL";
  return "CA";
}

function buildBusinessName(city: string, category: string, index: number) {
  const prefix = BUSINESS_PREFIXES[index % BUSINESS_PREFIXES.length];
  const suffix = BUSINESS_SUFFIXES[(index * 3) % BUSINESS_SUFFIXES.length];
  if (index % 2 === 0) return `${city} ${category} ${suffix}`;
  return `${prefix} ${category} ${suffix}`;
}

export function generateSandboxLeads(
  source: LeadSourceType,
  query: LiveAdapterQuery = {},
): LeadOpportunity[] {
  const city = sanitizeToken(query.city, "San Jose");
  const category = sanitizeToken(query.category, "Local Services");
  const state = inferStateFromCity(city);
  const seedBase = `${source}:${city}:${category}:${query.textQuery ?? ""}`;
  const now = new Date().toISOString();
  const requestedLimit = query.limit ?? MAX_SANDBOX_SEARCH_RESULTS;
  const limit = clamp(requestedLimit, 1, MAX_SANDBOX_SEARCH_RESULTS);

  const generated: LeadOpportunity[] = [];
  for (let index = 0; index < limit; index += 1) {
    const seed = hashString(`${seedBase}:${index}`);
    const businessName = buildBusinessName(city, category, index);
    const hasWebsite = seed % 5 !== 0;
    const hasPhone = seed % 4 !== 0;
    const hasEmail = seed % 3 !== 0;
    const hasGoogleProfile = seed % 6 !== 0;
    const hasBooking = seed % 2 === 0;
    const hasContactForm = hasWebsite && seed % 3 !== 0;
    const hasSocialLinks = seed % 4 !== 1;
    const reviewCount = seed % 70;
    const rating = Number((3.1 + ((seed % 19) * 0.1)).toFixed(1));
    const websiteDomain = `${toSlug(businessName)}.example`;
    const id = `${source}-sandbox-${toSlug(city)}-${toSlug(category)}-${index}`;

    generated.push(
      scoreLeadOpportunity({
        id,
        businessName,
        category,
        city,
        state,
        phone: hasPhone ? `+1${String(4080000000 + (seed % 9999999)).padStart(10, "0")}` : null,
        email: hasEmail ? `hello@${websiteDomain}` : null,
        website: hasWebsite ? `https://${websiteDomain}` : null,
        googleProfileUrl: hasGoogleProfile
          ? `https://maps.google.com/?q=${encodeURIComponent(businessName)}`
          : null,
        address: `${100 + index} ${city} Ave`,
        rating,
        reviewCount,
        hasWebsite,
        hasGoogleBusinessProfile: hasGoogleProfile,
        hasBookingLink: hasBooking,
        hasContactForm,
        hasSocialLinks,
        websiteQuality: hasWebsite ? (seed % 2 === 0 ? "average" : "weak") : "none",
        responseSpeedSignal: seed % 3 === 0 ? "slow" : seed % 3 === 1 ? "average" : "fast",
        source,
        sourceUrl: source === "google_places"
          ? `https://maps.google.com/?q=${encodeURIComponent(businessName)}`
          : `https://www.yelp.com/search?find_desc=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(city)}`,
        status: "discovered",
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  return generated;
}
