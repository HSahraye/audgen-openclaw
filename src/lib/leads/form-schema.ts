import { z } from "zod";

/**
 * Shared zod schema for the manual lead-create form and any related ingest
 * paths. Lives outside the "use server" actions module so it can be:
 *   1. unit tested directly, and
 *   2. safely re-exported (server-actions files only allow async exports).
 *
 * Behavior:
 *  - businessName is required and trimmed; whitespace-only inputs are
 *    rejected with the same message as missing input.
 *  - all other text fields are optional and trimmed (undefined → "");
 *    callers continue to use `data.field || null` to coerce empty to null
 *    when storing.
 *  - email is additionally lowercased so case-only variants don't pollute
 *    duplicate detection downstream.
 *
 * We deliberately keep email/websiteUrl/googleProfileUrl as plain strings
 * rather than z.string().email()/.url(). The form is also an ingest
 * surface for legacy data and tightening format validation here would
 * reject rows that haven't been backfilled (see BUGS_FOUND.md B-19).
 */
const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim());

const optionalTrimmedLower = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().toLowerCase());

export const leadFormSchema = z.object({
  businessName: z
    .string()
    .min(1, "Business name is required.")
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message: "Business name is required." }),
  ownerName: optionalTrimmed,
  category: optionalTrimmed,
  location: optionalTrimmed,
  websiteUrl: optionalTrimmed,
  googleProfileUrl: optionalTrimmed,
  phone: optionalTrimmed,
  email: optionalTrimmedLower,
  notes: optionalTrimmed,
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
