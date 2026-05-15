import { describe, it, expect } from "vitest";
import {
  isOutreachPersonalized,
  validatePersonalization,
} from "./personalization";

const goodCtx = {
  businessName: "420 Smoke Shop",
  ownerName: "Maria",
  location: "Santa Clara",
  category: "smoke shop",
  failedAuditChecks: ["mobileFriendly", "reviewsVisible"],
  signals: { reviewCount: 38, googleRank: 7, competitorCount: 6 },
};

describe("validatePersonalization", () => {
  it("rejects empty text", () => {
    const r = validatePersonalization({ text: "" });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("AUDIT_SPECIFIC_ISSUE");
    expect(r.missing).toContain("BUSINESS_SPECIFIC_DETAIL");
    expect(r.missing).toContain("LOCAL_OR_COMPETITOR_SIGNAL");
    expect(r.missing).toContain("CLEAR_NEXT_ACTION");
  });

  it("rejects the classic templated pitch (no business name, no city, no audit specifics, no CTA)", () => {
    const r = validatePersonalization({
      ...goodCtx,
      text: "Hi there, I help local businesses grow. Let's hop on a quick chat sometime.",
    });
    // text contains "businesses" but no specific name, no audit kw, no city, no time-bound CTA.
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("AUDIT_SPECIFIC_ISSUE");
    expect(r.missing).toContain("BUSINESS_SPECIFIC_DETAIL");
    expect(r.missing).toContain("LOCAL_OR_COMPETITOR_SIGNAL");
    expect(r.missing).toContain("CLEAR_NEXT_ACTION");
  });

  it("passes a fully personalised outreach piece", () => {
    const r = validatePersonalization({
      ...goodCtx,
      text:
        "Hey Maria \u2014 quick note: 420 Smoke Shop's site isn't mobile friendly, " +
        "which is hurting calls from Santa Clara searches. With 38 reviews you " +
        "already have great trust signals, but visitors bounce on phones. " +
        "Want a 15-min call this week? I'll walk you through the audit.",
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.found).toEqual(
      expect.arrayContaining([
        "AUDIT_SPECIFIC_ISSUE",
        "BUSINESS_SPECIFIC_DETAIL",
        "LOCAL_OR_COMPETITOR_SIGNAL",
        "CLEAR_NEXT_ACTION",
      ]),
    );
  });

  it("flags missing CTA only when copy mentions everything else but no next step", () => {
    const r = validatePersonalization({
      ...goodCtx,
      text:
        "Hey Maria, 420 Smoke Shop's mobile site is hurting calls from Santa Clara, " +
        "and your competitors rank above you on Google.",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["CLEAR_NEXT_ACTION"]);
  });

  it("flags missing business detail when the name is absent", () => {
    const r = validatePersonalization({
      ...goodCtx,
      text:
        "Hi! Your mobile site is broken, your Santa Clara competitors are ranking " +
        "above you on Google. Book a 15-min call this week.",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["BUSINESS_SPECIFIC_DETAIL"]);
  });

  it("flags missing audit signal when no audit keyword is present", () => {
    const r = validatePersonalization({
      ...goodCtx,
      text:
        "Hey Maria from 420 Smoke Shop \u2014 a few of your Santa Clara competitors are " +
        "ranking on Google. Book a 15-min call this week.",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["AUDIT_SPECIFIC_ISSUE"]);
  });

  it("flags missing local signal when no city/review/competitor info present", () => {
    const r = validatePersonalization({
      // No location, no signals, no local hints in text.
      text:
        "Hey Maria from 420 Smoke Shop \u2014 your mobile site is hurting calls. " +
        "Want a 15-min chat this week?",
      businessName: "420 Smoke Shop",
      ownerName: "Maria",
      failedAuditChecks: ["mobileFriendly"],
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["LOCAL_OR_COMPETITOR_SIGNAL"]);
  });

  it("category alone is not enough business specificity", () => {
    const r = validatePersonalization({
      // No business name, no owner name; only the category "smoke shop".
      text:
        "Hey, your smoke shop's mobile experience is hurting Santa Clara calls. " +
        "Book a 15-min call this week.",
      category: "smoke shop",
      location: "Santa Clara",
      failedAuditChecks: ["mobileFriendly"],
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("BUSINESS_SPECIFIC_DETAIL");
  });

  it("isOutreachPersonalized convenience returns boolean", () => {
    expect(
      isOutreachPersonalized({
        ...goodCtx,
        text: "Hey Maria \u2014 420 Smoke Shop site is not mobile friendly in Santa Clara. Book a 15-min call.",
      }),
    ).toBe(true);
    expect(isOutreachPersonalized({ text: "" })).toBe(false);
  });
});
