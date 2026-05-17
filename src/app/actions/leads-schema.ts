import { z } from "zod";

// SECURITY/UX: FormData.get() returns string | File | null. Bare
// z.string().optional() rejects null with "Invalid input: expected string,
// received null" and crashes the audit form when optional inputs are blank.
// optionalString() coerces null/undefined to "" so optional means optional.
export const optionalString = (max?: number) => {
  let inner = z.string();
  if (typeof max === "number") inner = inner.max(max);
  return z.preprocess((value) => (value == null ? "" : value), inner.optional());
};

// NOTE: this module is intentionally NOT a "use server" file. Next.js's
// strict server-actions compiler refuses to load a "use server" module that
// exports anything other than async functions. The lead audit form schema
// must be importable from both server actions (src/app/actions/leads.ts)
// and from unit tests, so it lives here.
export const leadFormSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),
  ownerName: optionalString(),
  category: optionalString(),
  location: optionalString(),
  websiteUrl: optionalString(),
  googleProfileUrl: optionalString(),
  phone: optionalString(),
  email: optionalString(),
  notes: optionalString(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
