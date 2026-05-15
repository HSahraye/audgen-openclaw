import { describe, it, expect } from "vitest";
import { classifyReplyBody, REPLY_CLASSIFICATIONS } from "./reply-classifier";

describe("classifyReplyBody", () => {
  it("returns NEEDS_MORE_INFO with confidence 0 for empty input", () => {
    expect(classifyReplyBody(null).classification).toBe("NEEDS_MORE_INFO");
    expect(classifyReplyBody(null).confidence).toBe(0);
    expect(classifyReplyBody("").classification).toBe("NEEDS_MORE_INFO");
    expect(classifyReplyBody("   ").confidence).toBe(0);
  });

  it("classifies an obviously positive reply as INTERESTED", () => {
    const r = classifyReplyBody("Yes, please send me the proposal!");
    expect(r.classification).toBe("INTERESTED");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("classifies a meeting confirmation as BOOKED_CALL", () => {
    const r = classifyReplyBody("Sounds good \u2014 booked a call for Thursday.");
    expect(r.classification).toBe("BOOKED_CALL");
  });

  it("classifies an undeliverable bounce as BOUNCED before any other rule fires", () => {
    const r = classifyReplyBody(
      "Mailbox full \u2014 message not delivered. Also let me know if interested.",
    );
    expect(r.classification).toBe("BOUNCED");
  });

  it("classifies wrong-contact reliably", () => {
    expect(
      classifyReplyBody("Wrong person \u2014 try Maria in marketing.").classification,
    ).toBe("WRONG_CONTACT");
    expect(
      classifyReplyBody("I no longer work here.").classification,
    ).toBe("WRONG_CONTACT");
  });

  it("classifies hostile replies as ANGRY", () => {
    const r = classifyReplyBody("STOP EMAILING ME. Do not contact us again.");
    expect(r.classification).toBe("ANGRY");
  });

  it("classifies pricing pushback as PRICING_OBJECTION", () => {
    const r = classifyReplyBody("Too expensive for us right now.");
    expect(r.classification).toBe("PRICING_OBJECTION");
  });

  it("classifies provider lock-in as ALREADY_HAS_PROVIDER", () => {
    const r = classifyReplyBody("We already have an agency we work with.");
    expect(r.classification).toBe("ALREADY_HAS_PROVIDER");
  });

  it("classifies 'check back later' as FOLLOW_UP_LATER", () => {
    const r = classifyReplyBody("Try me again next quarter.");
    expect(r.classification).toBe("FOLLOW_UP_LATER");
  });

  it("classifies polite refusal as NOT_INTERESTED", () => {
    const r = classifyReplyBody("No thanks, we're good.");
    expect(r.classification).toBe("NOT_INTERESTED");
  });

  it("classifies curiosity as NEEDS_MORE_INFO", () => {
    const r = classifyReplyBody("What is this exactly?");
    expect(r.classification).toBe("NEEDS_MORE_INFO");
  });

  it("falls back to NEEDS_MORE_INFO with low confidence for opaque text", () => {
    const r = classifyReplyBody("Hmm. Ok.");
    expect(r.classification).toBe("NEEDS_MORE_INFO");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("only returns canonical classifications", () => {
    const inputs = [
      "yes please",
      "stop emailing",
      "wrong person",
      "too expensive",
      "already locked in",
      "try me in 3 months",
      "no thanks",
      "what is this",
      "mailbox full",
      "calendly.com/me/15min",
    ];
    for (const t of inputs) {
      const r = classifyReplyBody(t);
      expect(REPLY_CLASSIFICATIONS).toContain(r.classification);
    }
  });
});
