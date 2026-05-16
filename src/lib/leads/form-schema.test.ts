import { describe, it, expect } from "vitest";
import { leadFormSchema } from "./form-schema";

describe("leadFormSchema", () => {
  it("rejects an empty businessName", () => {
    const result = leadFormSchema.safeParse({ businessName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Business name is required.");
    }
  });

  it("rejects whitespace-only businessName after the trim transform", () => {
    const result = leadFormSchema.safeParse({ businessName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Business name is required.");
    }
  });

  it("trims businessName and accepts the trimmed value", () => {
    const result = leadFormSchema.safeParse({ businessName: "  Acme HVAC  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBe("Acme HVAC");
    }
  });

  it("normalizes optional string fields to trimmed strings", () => {
    const result = leadFormSchema.safeParse({
      businessName: "Acme",
      ownerName: "   Alice   ",
      location: " Austin, TX ",
      websiteUrl: "  https://acme.test  ",
      googleProfileUrl: "  https://g.page/acme  ",
      phone: " (510) 555-0199 ",
      notes: "  hot lead  ",
      category: "  hvac  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownerName).toBe("Alice");
      expect(result.data.location).toBe("Austin, TX");
      expect(result.data.websiteUrl).toBe("https://acme.test");
      expect(result.data.googleProfileUrl).toBe("https://g.page/acme");
      expect(result.data.phone).toBe("(510) 555-0199");
      expect(result.data.notes).toBe("hot lead");
      expect(result.data.category).toBe("hvac");
    }
  });

  it("lowercases email and trims whitespace", () => {
    const result = leadFormSchema.safeParse({
      businessName: "Acme",
      email: "  ALICE@Example.com  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  it("turns missing optional fields into empty strings (callers coerce with `|| null`)", () => {
    const result = leadFormSchema.safeParse({ businessName: "Acme" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownerName).toBe("");
      expect(result.data.email).toBe("");
      expect(result.data.notes).toBe("");
      // `"" || null` === null, which is what the action stores.
      expect(result.data.ownerName || null).toBeNull();
    }
  });

  it("does not enforce email format (legacy data tolerance)", () => {
    // Intentional behaviour documented in BUGS_FOUND.md B-19. If this
    // assertion ever starts failing because someone added .email() to the
    // schema, double-check the legacy-data migration story before merging.
    const result = leadFormSchema.safeParse({
      businessName: "Acme",
      email: "definitely-not-an-email",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("definitely-not-an-email");
    }
  });

  it("does not enforce URL format on websiteUrl (legacy data tolerance)", () => {
    const result = leadFormSchema.safeParse({
      businessName: "Acme",
      websiteUrl: "acme.test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.websiteUrl).toBe("acme.test");
    }
  });
});
