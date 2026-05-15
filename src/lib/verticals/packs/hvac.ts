import type { VerticalPack } from "../types";

/**
 * HVAC pack.
 *
 * Why HVAC:
 *  - Emergency-driven search behaviour ('AC broken near me'); call
 *    volume from Google is the entire business.
 *  - Mid ACV ($2k-$5k presence packages).
 *  - Seasonal: April-June + Oct-Dec are when buyers buy.
 */
export const hvacPack: VerticalPack = {
  slug: "hvac",
  name: "HVAC contractors",
  description:
    "Local heating, ventilation, air-conditioning contractors. Owner-operator buyer.",
  matchCategories: [
    "hvac",
    "heating",
    "air conditioning",
    "hvac contractor",
    "ac repair",
    "heating and cooling",
    "furnace repair",
  ],
  criticalAuditChecks: [
    "phoneEasyToFind",
    "clearCta",
    "mobileFriendly",
    "reviewsVisible",
    "trustSection",
    "onlineBooking",
  ],
  scoringWeightOverrides: {
    conversion: 1.25,
    trust: 1.1,
  },
  pricing: {
    starterPackageUsd: 1500,
    standardPackageUsd: 3000,
    premiumPackageUsd: 5000,
    typicalCycleDays: 7,
  },
  outreachHints: {
    openingAngles: [
      "When somebody's AC dies on a 95-degree day, they're calling the first HVAC shop whose phone number they can find in under 5 seconds.",
      "Reviews on the site (not just on Google) are what tip an emergency caller toward you vs. the next listing.",
      "Online booking + a clear emergency number doubles call-to-booking ratio for HVAC.",
    ],
    painPoints: [
      "Phone number is too small / buried; emergency searchers leave.",
      "No online booking, so the 30% of customers who want to schedule non-emergency work go to a competitor.",
      "No reviews on the site, so first-time callers hesitate.",
      "Mobile-broken site loses the emergency caller in the first 3 seconds.",
    ],
    objectionResponses: [
      {
        objection: "We're booked solid \u2014 don't need more leads.",
        response:
          "Great problem. The audit also shows where you're leaving money on the table on the leads you DO take \u2014 upsells, financing visibility, maintenance plan signups. Worth 30 seconds?",
      },
      {
        objection: "Our truck wraps and yard signs do the work.",
        response:
          "They do. And every truck-wrap viewer Googles you 4 minutes later. The audit shows what they see when they do.",
      },
      {
        objection: "$3,000 is steep.",
        response:
          "One emergency AC install in summer pays it back 2x. The package is built so you can see the math month-by-month.",
      },
    ],
    proposalFraming:
      "Emergency-call capture framing. We commit to a measurable lift in phone calls and 'book service' form submissions, with a clear baseline.",
  },
  sellerNotes: [
    "Best call windows: 7-9am or 4-5pm. Mid-day they're on a truck.",
    "Seasonal pricing: avoid Jan and August discount asks; demand is low and they know it.",
    "Lead with maintenance plan visibility \u2014 that's where their recurring revenue lives.",
  ],
};
