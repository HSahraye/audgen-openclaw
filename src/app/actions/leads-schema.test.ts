import { describe, expect, it } from "vitest";
import { leadFormSchema } from "@/app/actions/leads-schema";

// SECURITY/UX regression: FormData.get() returns null for missing fields.
// Bare z.string().optional() rejects null with
// "Invalid input: expected string, received null" and crashes the lead
// audit form on the dashboard. Each of these cases must now succeed.

const OPTIONAL_FIELDS = [
  "ownerName",
  "category",
  "location",
  "websiteUrl",
  "googleProfileUrl",
  "phone",
  "email",
  "notes",
] as const;

describe("leadFormSchema null/undefined coercion", () => {
  it("accepts null for every optional field and coerces to empty string", () => {
    const payload: Record<string, unknown> = {
      businessName: "Acme HVAC",
    };
    for (const field of OPTIONAL_FIELDS) {
      payload[field] = null;
    }
    const result = leadFormSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const field of OPTIONAL_FIELDS) {
      expect(result.data[field]).toBe("");
    }
  });

  it("accepts undefined for every optional field and coerces to empty string", () => {
    const payload: Record<string, unknown> = {
      businessName: "Acme HVAC",
    };
    for (const field of OPTIONAL_FIELDS) {
      payload[field] = undefined;
    }
    const result = leadFormSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const field of OPTIONAL_FIELDS) {
      expect(result.data[field]).toBe("");
    }
  });

  it("preserves provided string values for optional fields", () => {
    const result = leadFormSchema.safeParse({
      businessName: "Acme HVAC",
      ownerName: "Sam",
      category: "hvac",
      location: "Austin",
      websiteUrl: "https://acme.example",
      googleProfileUrl: "https://maps.google.com/?cid=1",
      phone: "+15125550100",
      email: "sam@acme.example",
      notes: "  needs site refresh  ",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ownerName).toBe("Sam");
    expect(result.data.category).toBe("hvac");
    expect(result.data.websiteUrl).toBe("https://acme.example");
  });

  it("still rejects missing required businessName", () => {
    const result = leadFormSchema.safeParse({
      businessName: "",
      ownerName: null,
    });
    expect(result.success).toBe(false);
  });
});
