import { describe, it, expect } from "vitest";
import { resolvePublicSenderName, sanitizePublicBrandCopy } from "./branding";

describe("resolvePublicSenderName", () => {
  it("prefers publicCompanyName over other fields", () => {
    expect(
      resolvePublicSenderName({
        publicCompanyName: "Bright Local",
        senderCompanyName: "Bright Local Sender",
        agencyName: "Bright Local Agency",
        brandName: "Bright Brand",
      }),
    ).toBe("Bright Local");
  });

  it("falls through fields in documented priority order", () => {
    expect(
      resolvePublicSenderName({
        senderCompanyName: "Sender",
        agencyName: "Agency",
        brandName: "Brand",
      }),
    ).toBe("Sender");
    expect(
      resolvePublicSenderName({ agencyName: "Agency", brandName: "Brand" }),
    ).toBe("Agency");
    expect(resolvePublicSenderName({ brandName: "Brand" })).toBe("Brand");
  });

  it("trims whitespace and ignores empty strings", () => {
    expect(
      resolvePublicSenderName({
        publicCompanyName: "   ",
        senderCompanyName: "  Sender  ",
      }),
    ).toBe("Sender");
  });

  it("skips internal placeholder names (case-insensitive)", () => {
    expect(
      resolvePublicSenderName({
        publicCompanyName: "Default Workspace",
        senderCompanyName: "Real Sender",
      }),
    ).toBe("Real Sender");
    expect(resolvePublicSenderName({ publicCompanyName: "workspace" })).toBe(
      "Presence Labs",
    );
    expect(resolvePublicSenderName({ publicCompanyName: "DEFAULT" })).toBe(
      "Presence Labs",
    );
  });

  it("falls back to 'Presence Labs' when no field is usable", () => {
    expect(resolvePublicSenderName()).toBe("Presence Labs");
    expect(resolvePublicSenderName(null)).toBe("Presence Labs");
    expect(resolvePublicSenderName({})).toBe("Presence Labs");
    expect(
      resolvePublicSenderName({
        publicCompanyName: "",
        senderCompanyName: null,
      }),
    ).toBe("Presence Labs");
  });
});

describe("sanitizePublicBrandCopy", () => {
  it("rewrites 'from Default Workspace' to 'from Presence Labs'", () => {
    expect(sanitizePublicBrandCopy("Sent from Default Workspace today")).toBe(
      "Sent from Presence Labs today",
    );
    expect(sanitizePublicBrandCopy("FROM DEFAULT WORKSPACE")).toBe(
      "from Presence Labs",
    );
  });

  it("rewrites bare 'Default Workspace' mentions", () => {
    expect(sanitizePublicBrandCopy("Welcome to Default Workspace!")).toBe(
      "Welcome to Presence Labs!",
    );
  });

  it("leaves unrelated copy untouched", () => {
    expect(sanitizePublicBrandCopy("Welcome to Acme HVAC")).toBe(
      "Welcome to Acme HVAC",
    );
    expect(sanitizePublicBrandCopy("")).toBe("");
  });
});
