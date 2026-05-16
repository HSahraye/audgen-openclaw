import { describe, it, expect } from "vitest";
import {
  buildMailtoHref,
  buildSmsHref,
  buildWhatsAppHref,
  buildWhatsappHref,
  normalizePhoneForHref,
} from "./links";

describe("normalizePhoneForHref", () => {
  it("strips all non-digits", () => {
    expect(normalizePhoneForHref("(510) 555-0199")).toBe("5105550199");
    expect(normalizePhoneForHref("+1 510-555-0199 ext.4")).toBe("151055501994");
    expect(normalizePhoneForHref("510.555.0199")).toBe("5105550199");
  });

  it("returns empty for falsy/empty input", () => {
    expect(normalizePhoneForHref("")).toBe("");
    expect(normalizePhoneForHref(undefined as unknown as string)).toBe("");
    expect(normalizePhoneForHref("not a phone")).toBe("");
  });
});

describe("buildSmsHref", () => {
  it("encodes body as a URI component", () => {
    expect(buildSmsHref("(510) 555-0199", "Hi! Got a sec?")).toBe(
      "sms:5105550199?body=Hi!%20Got%20a%20sec%3F",
    );
  });

  it("returns empty string when no phone is present", () => {
    expect(buildSmsHref("", "hello")).toBe("");
    expect(buildSmsHref("not a phone", "hello")).toBe("");
  });

  it("tolerates empty/missing body", () => {
    expect(buildSmsHref("5105550199", "")).toBe("sms:5105550199?body=");
    expect(buildSmsHref("5105550199", undefined as unknown as string)).toBe(
      "sms:5105550199?body=",
    );
  });
});

describe("buildWhatsAppHref + buildWhatsappHref (alias)", () => {
  it("builds a wa.me link with normalized phone + encoded text", () => {
    expect(buildWhatsAppHref("+1-510-555-0199", "👋 hello")).toBe(
      `https://wa.me/15105550199?text=${encodeURIComponent("👋 hello")}`,
    );
  });

  it("returns empty string when no phone is present", () => {
    expect(buildWhatsAppHref("", "anything")).toBe("");
  });

  it("lowercase alias delegates to the canonical helper", () => {
    expect(buildWhatsappHref("5105550199", "hi")).toBe(
      buildWhatsAppHref("5105550199", "hi"),
    );
  });
});

describe("buildMailtoHref", () => {
  it("encodes subject and body separately", () => {
    expect(buildMailtoHref("Hello Acme!", "Quick question — got 5 min?")).toBe(
      "mailto:?subject=Hello%20Acme!&body=Quick%20question%20%E2%80%94%20got%205%20min%3F",
    );
  });

  it("handles empty inputs without throwing", () => {
    expect(buildMailtoHref("", "")).toBe("mailto:?subject=&body=");
    expect(
      buildMailtoHref(
        undefined as unknown as string,
        undefined as unknown as string,
      ),
    ).toBe("mailto:?subject=&body=");
  });

  it("does not include a recipient (drafts open in user's chosen client)", () => {
    expect(buildMailtoHref("Hi", "Body")).toContain("mailto:?");
    expect(buildMailtoHref("Hi", "Body")).not.toMatch(/mailto:\w/);
  });
});
