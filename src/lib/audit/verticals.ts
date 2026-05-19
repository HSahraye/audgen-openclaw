// Vertical-specific intelligence the LLM audit engine consumes when
// generating per-business audit reports. Each entry is dense with
// signals to look for, buyer-behaviour notes, and finding-style
// exemplars. The system prompt iterates over the matching vertical's
// `signalsToCheck` + `buyerBehaviour` + `exampleFindings` to ground
// the model's output in vertical-appropriate territory rather than
// the generic "page payload appears heavy" template the previous
// engine produced.
//
// Coverage today: 11 entries spanning the high-volume local-services
// + professional-services categories the agency targets. Adding a
// new vertical is a copy-paste-edit; the registry is the only place
// to update.

export type OutreachChannel = "phone" | "email" | "linkedin";

export type VerticalIntelligence = {
  /** Stable lookup key used in env, telemetry, and the badge UI. */
  key: string;
  /** Display name for the dashboard `AI-generated · {displayName} vertical` badge. */
  displayName: string;
  /**
   * Free-text category aliases that map to this vertical when an
   * explicit `vertical` is not supplied. The LLM classifier only
   * runs when no alias matches.
   */
  categoryAliases: string[];
  /**
   * Channel the agency should use for outreach to a prospect in this
   * vertical. Drives which script the agent emphasises in their
   * pitch.
   */
  outreachChannel: OutreachChannel;
  /**
   * Recommended package price band for this vertical. The LLM may
   * choose any value within (or just outside) the band based on the
   * findings it surfaces.
   */
  priceRange: { min: number; max: number };
  /**
   * 4-8 buyer-behaviour notes the LLM uses to anchor findings. Each
   * is a short, vertical-specific observation about how prospects
   * choose between competing local businesses.
   */
  buyerBehaviour: string[];
  /**
   * Concrete signals the audit should LOOK FOR on the prospect's
   * website / GBP. The LLM uses these as a checklist when describing
   * what the prospect is missing or doing well.
   */
  signalsToCheck: string[];
  /**
   * 2-3 example findings worded the way a good audit should sound.
   * The LLM uses these as style exemplars (NOT to copy verbatim) so
   * the output reads like a real consultant wrote it, not a template.
   */
  exampleFindings: string[];
};

const HVAC: VerticalIntelligence = {
  key: "hvac",
  displayName: "HVAC",
  categoryAliases: ["hvac", "heating", "cooling", "air conditioning", "ac repair", "furnace"],
  outreachChannel: "phone",
  priceRange: { min: 1200, max: 4500 },
  buyerBehaviour: [
    "HVAC calls are emergencies (no heat in winter, no AC in summer). Buyer intent peaks within 30 minutes.",
    "Buyers compare 2-3 contractors via Google maps, choose by reviews + same-day availability, almost never click past page 1.",
    "Financing visibility (e.g. 0% APR) converts disproportionately well — replacement systems run $5-15K.",
    "Trust signals matter: NATE certification, BBB, manufacturer dealer badges (Lennox, Trane, Carrier).",
    "Service-area maps win on \"do they cover my zip\" — buyers bounce when this is unclear.",
  ],
  signalsToCheck: [
    "Click-to-call phone visible above the fold on mobile",
    "24/7 emergency service banner / dedicated emergency phone",
    "Financing options or partnership badges (Synchrony, Greensky, Wells Fargo)",
    "Service-area map or city list",
    "NATE / EPA / manufacturer-dealer trust badges",
    "Recent reviews (within last 90 days) and review count > 50",
    "Before/after photos or maintenance-tip blog content",
    "Online booking / form for non-emergency tune-ups",
    "Schema markup for LocalBusiness + HVACBusiness",
  ],
  exampleFindings: [
    "No 24/7 emergency phone surfaced above the fold — competitors with this banner capture 30%+ more after-hours calls during the heating season.",
    "Financing options not visible — replacement systems running $8-12K convert better with 0% APR or monthly-payment language pinned to the hero.",
    "Service-area map missing — buyers searching from neighbouring zip codes can't tell if you cover them and bounce to the next listing.",
  ],
};

const DENTAL: VerticalIntelligence = {
  key: "dental",
  displayName: "Dental",
  categoryAliases: ["dental", "dentist", "orthodontist", "dental clinic", "pediatric dentist", "cosmetic dentist"],
  outreachChannel: "phone",
  priceRange: { min: 1500, max: 5000 },
  buyerBehaviour: [
    "New-patient acquisition is the metric — most practices price growth at $200-500 per new patient lifetime.",
    "Buyers research by reading recent reviews + checking insurance + photos of the office (cleanliness signal).",
    "Online booking widget converts 3-5x better than \"call us\" CTAs for non-emergency new patients.",
    "Specialty practices (cosmetic, orthodontics) lean on before/after galleries; family practices lean on staff photos + new-patient specials.",
    "Insurance carrier badges (Delta, Cigna, MetLife) are the #1 trust signal for first-time bookers.",
  ],
  signalsToCheck: [
    "Online booking widget (Zocdoc, NexHealth, native form) on the home page",
    "Insurance carriers list / accepted plans page",
    "Office photos showing cleanliness and modern equipment",
    "New-patient special / first-visit pricing offer",
    "Staff bios with credentials (DDS, DMD, specialty board certs)",
    "Before/after gallery (specialty practices) OR family-friendly photos (general)",
    "Recent reviews count > 100 + 4.5+ rating + responses to negative reviews",
    "After-hours emergency contact + new-patient phone CTA",
  ],
  exampleFindings: [
    "Online booking is buried in the contact page — adding a booking widget to the hero typically lifts new-patient bookings 40-60% within 8 weeks.",
    "Insurance carrier list not visible — the #1 question new patients ask before booking is \"do they take my insurance?\" Hiding the answer costs first-call drop-offs.",
    "Recent reviews stop in 2024 — stale review streams signal a low-activity practice and depress conversion vs. competitors with reviews from this month.",
  ],
};

const ROOFING: VerticalIntelligence = {
  key: "roofing",
  displayName: "Roofing",
  categoryAliases: ["roofing", "roofer", "roof repair", "roof replacement", "shingle"],
  outreachChannel: "phone",
  priceRange: { min: 1500, max: 5000 },
  buyerBehaviour: [
    "Average ticket $8-25K, so trust signals are paramount — buyers vet 3-5 contractors before choosing.",
    "Storm-damage moments (post-hail, post-wind) drive 60% of leads; speed of response matters most.",
    "Insurance-claim assistance is a differentiator that wins jobs over price-only bids.",
    "Before/after galleries with specific addresses (city-level, for privacy) outperform generic stock photos.",
    "Manufacturer certifications (GAF Master Elite, Owens Corning Platinum) are the trust shortcut.",
  ],
  signalsToCheck: [
    "Storm-damage / insurance-claim help banner",
    "Manufacturer certification badges (GAF, Owens Corning, CertainTeed, Atlas)",
    "Before/after gallery with at least 8-12 jobs",
    "Free inspection CTA + same-day scheduling",
    "Warranty terms surfaced (lifetime, 30-yr labour, etc.)",
    "Service-area cities listed",
    "Customer review count > 75 + recent (last 60 days)",
    "Financing partnership badges",
  ],
  exampleFindings: [
    "No insurance-claim assistance language — competitors offering \"we work directly with your adjuster\" win the post-storm leads almost by default.",
    "Manufacturer certifications missing from the hero — GAF Master Elite or Owens Corning Platinum is the #1 reason a homeowner picks one quote over another at the $15K+ price point.",
    "Before/after gallery is 4 photos and 3 are stock — buyers expect 10+ real jobs from this neighbourhood as proof.",
  ],
};

const MED_SPA: VerticalIntelligence = {
  key: "med_spa",
  displayName: "Med Spa",
  categoryAliases: ["med spa", "medspa", "medical spa", "aesthetic", "botox", "laser hair removal", "coolsculpting"],
  outreachChannel: "phone",
  priceRange: { min: 2000, max: 5000 },
  buyerBehaviour: [
    "Aesthetic services are discretionary — visual proof + provider credentials drive booking decisions.",
    "Instagram is often the #1 traffic source; the website is for credibility and booking conversion.",
    "Treatments are bundled (e.g. \"3-session laser package\") and priced — transparent pricing converts 2x better than \"call for pricing\".",
    "Memberships / loyalty programs drive 30%+ of revenue; visible enrolment CTA matters.",
    "Before/after photos (with consent disclosure) and provider credentials (RN, NP, MD oversight) are non-negotiable.",
  ],
  signalsToCheck: [
    "Online booking widget (Vagaro, Mindbody, GlossGenius)",
    "Treatment menu with pricing or pricing ranges",
    "Before/after gallery per treatment category",
    "Provider credentials (RN, NP, MD oversight + state license)",
    "Membership / loyalty program enrolment CTA",
    "Instagram feed embed or Reels gallery",
    "First-time-client special / consultation offer",
    "HIPAA + medical-spa compliance language",
  ],
  exampleFindings: [
    "Treatment pricing is hidden behind a \"book consultation\" form — transparent per-session pricing converts ~2x better at this aesthetic-services price band.",
    "Before/after gallery is mixed across all treatments — buyers researching one specific service (e.g. CoolSculpting) need to see results for THAT treatment, not a generic mosaic.",
    "Medical oversight not surfaced (\"under the supervision of Dr. _\") — a critical trust signal at this regulatory boundary that competitors lead with.",
  ],
};

const RESTAURANT: VerticalIntelligence = {
  key: "restaurant",
  displayName: "Restaurant",
  categoryAliases: ["restaurant", "cafe", "bistro", "eatery", "diner", "food", "kitchen", "grill"],
  outreachChannel: "phone",
  priceRange: { min: 800, max: 2500 },
  buyerBehaviour: [
    "Decision window is minutes — a hungry visitor wants menu, hours, address, and a way to act in 8 seconds or less.",
    "Online ordering / reservations are table stakes; missing them sends customers to the next listing.",
    "Photos of food matter more than copy — visual menu drives 2x more orders than text-only.",
    "Hours visibility is the #1 mobile use case; outdated holiday hours kill walk-ins.",
    "Reviews + review-photo carousel act as a virtual storefront.",
  ],
  signalsToCheck: [
    "Online ordering link (Toast, ChowNow, native) above the fold",
    "Reservations link (OpenTable, Resy, native) above the fold",
    "Menu page with food photos (not just text)",
    "Current hours including holidays + a \"closed today\" override capability",
    "Address + map embed + parking info",
    "Recent food photos in GBP + on-site",
    "Review count > 100 + 4.3+ rating",
    "Schema markup for Restaurant + Menu",
  ],
  exampleFindings: [
    "Menu is a PDF download — mobile users on a 3-second decision window won't wait for a 4MB PDF; converting to an HTML menu lifts orders ~30%.",
    "Online ordering buried two clicks deep — Toast/ChowNow widgets typically belong in the hero on mobile, not in the footer.",
    "Holiday hours not configured for the next 30 days — outdated hours are the #1 cause of \"closed sign\" 1-star reviews.",
  ],
};

const FITNESS: VerticalIntelligence = {
  key: "fitness",
  displayName: "Fitness",
  categoryAliases: ["fitness", "gym", "yoga", "pilates", "crossfit", "personal training", "studio"],
  outreachChannel: "email",
  priceRange: { min: 1000, max: 3500 },
  buyerBehaviour: [
    "Free-trial / first-class-free is the universal lead magnet — site without it converts ~40% worse.",
    "Class schedule visibility drives sign-ups; outdated schedules signal an inactive studio.",
    "Membership pricing transparency (or at least a \"starting at\" anchor) reduces drop-off.",
    "Trainer / instructor bios humanise the studio and are top-3 most-visited pages.",
    "Beginner-friendly language matters — most prospects are intimidated by serious gym aesthetics.",
  ],
  signalsToCheck: [
    "First-class-free or 7-day-trial CTA in the hero",
    "Live class schedule (Mindbody, GymMaster, Glofox embed)",
    "Membership pricing tiers (or \"starting at $X\" anchor)",
    "Trainer / instructor bios with photos + credentials",
    "Member testimonials / transformation stories",
    "Studio photos (not stock) showing equipment + space",
    "Beginner-friendly language ('all levels welcome')",
    "Social proof (Instagram embed, member-of-the-month)",
  ],
  exampleFindings: [
    "No free-trial CTA on the home page — the universal fitness lead magnet is missing; competitors offering \"first class free\" capture 2-3x more email sign-ups.",
    "Class schedule appears static (no embedded live calendar) — prospects can't tell if classes still run on the times listed; this is the #1 reason new visitors don't book.",
    "Membership pricing not anchored anywhere — even a \"starting at $99/mo\" line reduces 40% of pricing-driven bounce.",
  ],
};

const AUTO_REPAIR: VerticalIntelligence = {
  key: "auto_repair",
  displayName: "Auto Repair",
  categoryAliases: ["auto repair", "auto", "mechanic", "car repair", "tire", "brake", "oil change"],
  outreachChannel: "phone",
  priceRange: { min: 800, max: 2500 },
  buyerBehaviour: [
    "Buyers compare 2-3 shops based on reviews + estimated wait time — \"we can see you today\" wins.",
    "ASE certification + manufacturer specialisation (e.g. \"BMW specialist\") are key trust signals.",
    "Photos of the bay / equipment matter — buyers visually verify a real shop, not a strip-mall storefront.",
    "Online estimate / quote forms outperform \"call us\" by 30%+ for non-emergency work.",
    "Reviews specifically about honest pricing convert; \"didn't get upsold\" is the magic phrase.",
  ],
  signalsToCheck: [
    "ASE certification badge + state inspection licence",
    "Manufacturer specialisations (Honda, BMW, Toyota, etc.) clearly listed",
    "Online estimate / quote form",
    "Photos of the shop bay + equipment",
    "Service list with rough price ranges",
    "Same-day / walk-in availability indicator",
    "Reviews mentioning honest pricing + no upsell",
    "Loaner-car or shuttle-service mention",
  ],
  exampleFindings: [
    "ASE certification not surfaced anywhere — this is the #1 mechanic-trust shortcut and the absence drops perceived legitimacy vs. shops that lead with the badge.",
    "No online estimate form — competitors offering \"upload a photo of your dashboard light, we'll quote\" are pulling 30-40% more leads from mobile searches.",
    "Photo gallery is stock-only — buyers verifying a real, equipped shop prefer 8-12 photos of YOUR bay over generic mechanic clip-art.",
  ],
};

const BEAUTY_SALON: VerticalIntelligence = {
  key: "beauty_salon",
  displayName: "Beauty Salon",
  categoryAliases: ["salon", "barber", "barbershop", "hair", "nail", "lashes", "brows", "spa"],
  outreachChannel: "phone",
  priceRange: { min: 800, max: 2500 },
  buyerBehaviour: [
    "Visual portfolio is everything — Instagram-style gallery converts; text-heavy site loses to a 3-photo competitor.",
    "Online booking is table stakes; phone-only-booking salons lose ~50% of prospects under 35.",
    "Stylist / service-provider bios with their own portfolios drive direct bookings.",
    "Pricing transparency (per service, not \"call for quote\") improves first-visit conversion.",
    "Recent reviews + photo replies build trust faster than copy.",
  ],
  signalsToCheck: [
    "Online booking widget (Vagaro, GlossGenius, Booksy, Square Appointments)",
    "Service menu with prices (cuts, colour, extensions, etc.)",
    "Stylist bios with individual portfolios",
    "Instagram feed embed or recent gallery (last 30 days)",
    "First-time-client special",
    "Salon photos (not stock) showing space + chairs",
    "Recent reviews count > 60 + 4.5+ rating",
    "Walk-in availability indicator",
  ],
  exampleFindings: [
    "Online booking missing or burying — phone-only booking is a hard filter for under-35 prospects who book everything via app or web.",
    "Service pricing hidden behind \"contact us\" — visible per-service pricing converts ~2x more first-time clients.",
    "Stylist portfolios not segmented per provider — clients want to book a SPECIFIC stylist whose work matches what they want, not a generic salon.",
  ],
};

const LEGAL: VerticalIntelligence = {
  key: "legal",
  displayName: "Legal",
  categoryAliases: ["legal", "law", "lawyer", "attorney", "law firm", "personal injury", "family law"],
  outreachChannel: "email",
  priceRange: { min: 2500, max: 5000 },
  buyerBehaviour: [
    "Average client value is $5-50K — trust + perceived expertise matter more than visual polish.",
    "Practice-area specialisation pages drive most organic traffic; generic firms lose to specialists.",
    "Free-consultation CTA is universal; phrasing matters (\"no fee unless we win\" for personal injury).",
    "Case-results pages with settlement amounts (where ethically allowed) build credibility.",
    "Bar admissions + super-lawyer / Avvo / Martindale-Hubbell ratings are quick-trust shortcuts.",
  ],
  signalsToCheck: [
    "Free-consultation CTA above the fold",
    "Practice-area pages with depth (not just bullet lists)",
    "Attorney bios with bar admissions + photos + credentials",
    "Case results / settlement amounts (where allowed)",
    "Super Lawyers / Avvo / Martindale ratings",
    "Recent reviews count > 30 + responses + 4.7+ rating",
    "FAQ pages addressing common case questions",
    "Live chat or 24/7 intake (personal injury especially)",
  ],
  exampleFindings: [
    "Practice-area pages are 100-word descriptions — competitors with 1500-word pillar pages on the same areas dominate Google for the high-intent queries.",
    "Free consultation phrasing is generic — personal injury benchmarks show \"no fee unless we win\" outperforms \"free consultation\" by 30%+ in click-through.",
    "Attorney bios missing super-lawyer badges + bar admissions — these are the visual trust shortcuts buyers scan for in 10 seconds.",
  ],
};

const ACCOUNTING: VerticalIntelligence = {
  key: "accounting",
  displayName: "Accounting",
  categoryAliases: ["accounting", "accountant", "cpa", "bookkeeping", "tax", "financial advisor"],
  outreachChannel: "linkedin",
  priceRange: { min: 1500, max: 4000 },
  buyerBehaviour: [
    "B2B clients (small business owners) compare on credentials + niche expertise + service-package transparency.",
    "Industry specialisation (e.g. \"CPA for restaurants\") wins against generalists at the small-business price point.",
    "QuickBooks / Xero certifications are quick-trust signals.",
    "Service packages (Bronze/Silver/Gold) with pricing reduce first-call hesitation.",
    "Tax-season landing pages drive 60%+ of organic traffic Q1.",
  ],
  signalsToCheck: [
    "Service packages with pricing tiers",
    "CPA + state licence + niche certifications (QuickBooks ProAdvisor, Xero Certified)",
    "Industry specialisation pages (restaurants, dentists, e-comm, etc.)",
    "Free-consultation booking widget (Calendly embed)",
    "Owner / partner bios with photos + credentials",
    "Tax-season landing page (visible Jan-Apr)",
    "Client testimonials (B2B, with company names)",
    "Resources / blog showing expertise",
  ],
  exampleFindings: [
    "Generic services list with no industry specialisation — \"CPA for restaurants\" or \"bookkeeping for dental practices\" out-converts a generalist by 3-5x for those niches.",
    "No service packages with pricing — small-business owners want to see Bronze/Silver/Gold tiers up front, not \"contact us for a quote\".",
    "QuickBooks ProAdvisor certification not visible — this is the #1 trust shortcut for cloud-accounting buyers.",
  ],
};

const GENERIC_LOCAL_SERVICES: VerticalIntelligence = {
  key: "generic_local_services",
  displayName: "Local Services",
  categoryAliases: [],
  outreachChannel: "phone",
  priceRange: { min: 800, max: 2500 },
  buyerBehaviour: [
    "Local-services buyers compare 2-3 options via Google, choose by reviews + ease of contact + visible service area.",
    "Mobile experience matters most — over 70% of local searches happen on mobile.",
    "Click-to-call from the hero converts better than form-fills for service-based businesses.",
    "Trust signals (licence, insurance, certifications) are non-negotiable for any business invited into a home.",
  ],
  signalsToCheck: [
    "Click-to-call phone visible above the fold",
    "Service area map or city list",
    "Service list with descriptions (not just bullet titles)",
    "Trust signals (licensed + insured + certifications)",
    "Recent reviews + 4.3+ rating",
    "Photos of work performed",
    "Pricing guidance or \"starting at\" anchor",
    "Online booking or quick-quote form",
  ],
  exampleFindings: [
    "Click-to-call missing on mobile — over 70% of local-services searches happen on mobile and want to call within 10 seconds; missing this is a flat ~40% conversion penalty.",
    "Service area not visible — buyers can't tell if you cover their zip code and bounce to the next listing.",
    "License + insurance not surfaced — for any in-home service this is the #1 trust signal and absence reduces booked jobs vs. competitors that lead with it.",
  ],
};

const REGISTRY: VerticalIntelligence[] = [
  HVAC,
  DENTAL,
  ROOFING,
  MED_SPA,
  RESTAURANT,
  FITNESS,
  AUTO_REPAIR,
  BEAUTY_SALON,
  LEGAL,
  ACCOUNTING,
  GENERIC_LOCAL_SERVICES,
];

const REGISTRY_BY_KEY: Map<string, VerticalIntelligence> = new Map(REGISTRY.map((v) => [v.key, v]));

export function getVerticalIntelligence(verticalKey: string): VerticalIntelligence {
  return REGISTRY_BY_KEY.get(verticalKey) ?? GENERIC_LOCAL_SERVICES;
}

export function listVerticalKeys(): string[] {
  return REGISTRY.map((v) => v.key);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cheap, deterministic pre-classifier used BEFORE the LLM classifier
 * is invoked. Matches a free-text category (e.g. "HVAC contractor",
 * "dental clinic", "med spa") against the registry's `categoryAliases`.
 * Uses word-boundary matching so e.g. "Spaceship dealership" does
 * not false-positive against the "spa" alias.
 * Returns the matched key or null if none match — caller may then
 * fall back to the LLM classifier or to the generic vertical.
 */
export function inferVerticalFromCategory(categoryText: string | null | undefined): string | null {
  if (!categoryText) return null;
  const lower = categoryText.toLowerCase().trim();
  if (!lower) return null;
  for (const vertical of REGISTRY) {
    for (const alias of vertical.categoryAliases) {
      const aliasLower = alias.toLowerCase();
      const pattern = new RegExp(`\\b${escapeRegex(aliasLower)}\\b`);
      if (pattern.test(lower)) return vertical.key;
    }
  }
  return null;
}

export const ALL_VERTICALS = REGISTRY;
