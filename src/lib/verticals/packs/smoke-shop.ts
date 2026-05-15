import type { VerticalPack } from "../types";

/**
 * Smoke shop pack \u2014 the original wedge vertical.
 *
 * Why smoke shops:
 *  - The audit signals are unusually unfair: most smoke shops have no
 *    mobile site at all. Easy "show your work" moment on a call.
 *  - Cash-rich, time-poor owner.
 *  - One owner per location; no committee.
 *
 * Note: regulated category. We never claim conversion uplift on
 * regulated product sales; we focus on call-volume + foot-traffic
 * signals.
 */
export const smokeShopPack: VerticalPack = {
  slug: "smoke-shop",
  name: "Smoke shops",
  description:
    "Tobacco / vape / glass retail. Single-location owner buyer; cash-led.",
  matchCategories: [
    "smoke shop",
    "tobacco shop",
    "vape shop",
    "cigar shop",
    "headshop",
    "glass shop",
    "hookah lounge",
  ],
  criticalAuditChecks: [
    "mobileFriendly",
    "phoneEasyToFind",
    "reviewsVisible",
    "clearCta",
    "gallery",
  ],
  scoringWeightOverrides: {
    conversion: 1.2,
    trust: 1.05,
  },
  pricing: {
    starterPackageUsd: 1000,
    standardPackageUsd: 1500,
    premiumPackageUsd: 2500,
    typicalCycleDays: 5,
  },
  outreachHints: {
    openingAngles: [
      "Most smoke shop searches happen on a phone, often inside another store. Your mobile site is your first impression.",
      "Google reviews and a real product gallery are the two highest-leverage things you can fix in a week.",
      "Foot traffic + phone calls are the only conversions that matter; the audit shows where those leak.",
    ],
    painPoints: [
      "No mobile site means people searching 'smoke shop near me' bounce to a competitor.",
      "Phone number is hard to find, and that's the single most-clicked thing on a smoke shop site.",
      "No product gallery, so price-shoppers go elsewhere.",
      "Reviews are not visible on the site, even when the shop has dozens of 5-stars on Google.",
    ],
    objectionResponses: [
      {
        objection: "We mostly walk-in.",
        response:
          "Yeah \u2014 and walk-ins Googled you first. The audit shows what they saw 30 seconds before walking in. If you fix that, foot traffic goes up the same week.",
      },
      {
        objection: "We have a Facebook page.",
        response:
          "Facebook is one channel. Most local searches go through Google, and the Google result links to your website. If the website is broken, the Google traffic isn't worth much.",
      },
      {
        objection: "We can't afford $1,500.",
        response:
          "Starter is $1,000. Even half a missed customer a week pays for it in two months.",
      },
    ],
    proposalFraming:
      "Foot-traffic + call-volume framing. We commit to a measurable lift in 'Get directions' clicks and phone calls per month from Google over a 30-day baseline.",
  },
  sellerNotes: [
    "Owners are skeptical of agencies and respond well to concrete proof.",
    "Show, don't tell: run an audit on a competitor on the same street.",
    "Regulated category. Never claim revenue lift on tobacco/vape sales themselves; focus on foot traffic + call volume.",
    "Cash discount? Sometimes asked. Stripe charge is fine; do not invoice cash.",
  ],
};
