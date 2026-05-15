import type { VerticalPack } from "../types";

/**
 * Dental practice vertical pack.
 *
 * Why dental first:
 *  - High ACV ($1.5k-$5k presence packages).
 *  - Stable category (recession-resilient).
 *  - Buyer pattern: owner-dentist makes the call, decides in one week.
 *  - Audit signals are unusually crisp: mobile site, online booking,
 *    reviews, before/after gallery. Each missing signal = real lost
 *    revenue you can quantify.
 */
export const dentalPack: VerticalPack = {
  slug: "dental",
  name: "Dental practices",
  description:
    "Local dental offices: general, cosmetic, pediatric. Owner-dentist buyer.",
  matchCategories: [
    "dental",
    "dentist",
    "dental office",
    "dental practice",
    "dental clinic",
    "cosmetic dentistry",
    "pediatric dentistry",
    "orthodontist",
  ],
  criticalAuditChecks: [
    "mobileFriendly",
    "onlineBooking",
    "reviewsVisible",
    "gallery",
    "phoneEasyToFind",
    "trustSection",
  ],
  scoringWeightOverrides: {
    conversion: 1.15,
    trust: 1.2,
  },
  pricing: {
    starterPackageUsd: 1500,
    standardPackageUsd: 2500,
    premiumPackageUsd: 4500,
    typicalCycleDays: 9,
  },
  outreachHints: {
    openingAngles: [
      "Online booking is the biggest revenue lever for a dental practice in 2026 \u2014 it removes the phone-tag step new patients hate.",
      "Reviews + a before/after gallery are doing more for new-patient conversion than ad spend right now.",
      "Mobile-first audit: 73% of new-patient searches for dental are on phones.",
    ],
    painPoints: [
      "No online booking forces phone calls during the only hours new patients are calling other offices too.",
      "Reviews are buried below the fold, so the trust proof your existing patients gave you isn't doing its job.",
      "Mobile experience is broken \u2014 new patients bounce before they reach the contact form.",
      "Before/after gallery is missing or buried; cosmetic procedures sell on visual proof.",
    ],
    objectionResponses: [
      {
        objection: "We already have a website and it's fine.",
        response:
          "Fine is the floor. We measure two things: time-to-first-appointment from a new patient's first visit, and review-collection cadence. Want me to send you those numbers for your site?",
      },
      {
        objection: "Our patients come from referrals.",
        response:
          "Most do. The other 30% Google you and judge in 8 seconds. The audit shows what they see in those 8 seconds.",
      },
      {
        objection: "$2,500 is a lot.",
        response:
          "One new high-value patient (implants, ortho, full mouth) covers it 2-3x in the first 90 days. We can show the math on your site.",
      },
    ],
    proposalFraming:
      "Outcome-oriented: one new high-value patient pays for the package in the first 90 days. Guarantee against a baseline of measurable conversion lifts (online booking conversion, reviews per month, mobile bounce rate).",
  },
  sellerNotes: [
    "Owner-dentists are time-poor. 90 seconds of demo, then propose.",
    "Most decisions happen between patients (lunchtime, end of day).",
    "HIPAA is not in scope for the audit \u2014 we never ingest patient data \u2014 but lead with that fact unprompted to remove the objection.",
    "Avoid jargon. Say 'website' not 'web presence platform'.",
  ],
};
