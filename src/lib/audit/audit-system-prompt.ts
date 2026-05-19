// System prompt builder for the LLM audit engine. The prompt sets
// context once per call:
//   - WHO is generating this and WHO will read it
//   - WHAT vertical-specific signals to evaluate
//   - HOW to write findings that don't sound like a template
//   - The exact JSON schema the model MUST emit
//
// The output schema mirrors `GeneratedAssets` + the audit's `checks`
// + a top-level `findings` and `executiveSummary` so the audit body
// has dedicated narrative content. The engine's response validator
// (in llm-audit-engine.ts) accepts any superset of the required
// fields and discards the rest.

import { type VerticalIntelligence } from "./verticals";

export type AuditPromptContext = {
  vertical: VerticalIntelligence;
  brandName: string;
  senderIdentity: string;
  /** e.g. ["Local Trust Tune-Up", "Conversion Upgrade", "Launch Package"] */
  packageOptions: string[];
  /** Free-form workspace tone hint (e.g. "consultative", "premium", "aggressive"). */
  toneHint?: string;
};

export type AuditPromptInput = {
  businessName: string;
  category: string | null;
  location: string | null;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  reviewCount: number | null;
  scrapedHomepageText?: string | null;
  scrapedAboutText?: string | null;
  scrapedContactText?: string | null;
  scraperSignals?: Record<string, boolean | number> | null;
};

const OUTPUT_SCHEMA_DESCRIPTION = `Respond ONLY with a single valid JSON object that conforms to this schema (no markdown fences, no commentary):

{
  "executiveSummary": string  // 2-3 sentences. Names this business specifically. Avoids buzzwords. Sets up the findings.
  "findings": Array of 5-8 string  // Each finding 1-3 sentences. Each names a SPECIFIC, observable gap or strength keyed to the vertical's buyer behaviour and the actual data provided. NO generic phrasing like "page payload appears heavy" or "no clear booking flow" — every finding must reference SOMETHING SPECIFIC about this business or vertical.
  "checks": {            // 12 booleans, derived from the findings + the input data. Default to false when uncertain.
    "hasWebsite": boolean,
    "outdatedWebsite": boolean,
    "mobileFriendly": boolean,
    "clearCta": boolean,
    "phoneEasyToFind": boolean,
    "reviewsVisible": boolean,
    "onlineBooking": boolean,
    "trustSection": boolean,
    "gallery": boolean,
    "serviceList": boolean,
    "pricing": boolean,
    "faq": boolean
  },
  "openingPitch": string  // Single sentence. Names something specific about THIS business by name. The hook the agent uses to start a conversation.
  "painSummary": string  // 2-4 sentences synthesising the key gaps into a revenue-impact narrative. References the business by name + their vertical.
  "likelyMoneyLost": string  // 1-2 sentences with a concrete dollar range. References the vertical's typical lost-revenue patterns.
  "presenceLabsOffer": string  // 2-3 sentences pitching the recommended package. References the agency's brand name.
  "recommendedPackage": string  // Exactly one of the package options provided in the prompt context.
  "packagePrice": number  // Whole-dollar integer within the vertical's price range.
  "coldCallScript": string  // Conversational, 80-140 words. Opens with the openingPitch hook. Ends with a soft CTA (send the audit). Vertical-appropriate channel cue.
  "textMessageScript": string  // 30-70 words. Casual but professional. Mentions the SPECIFIC finding hook.
  "emailScript": string  // 120-220 words. Subject line + greeting + 2-3 specific findings + soft CTA. Plain text, no HTML.
  "thirtySecondPitch": string  // 60-120 words. The verbal pitch the agent gives in person or on a call. Natural cadence.
  "followUpMessage": string  // 40-80 words. Value-first follow-up after first outreach.
  "proposalOutline": Array of exactly 6 string  // Each item is one section of the deliverable proposal, in delivery order.
}

CRITICAL OUTPUT RULES:
- Output ONLY the JSON object. No prose before or after. No markdown code fences.
- Every string field is non-empty.
- "findings" has 5-8 items.
- "proposalOutline" has exactly 6 items.
- "checks" has all 12 boolean fields, no extras.
- "recommendedPackage" must match one of the provided package options exactly.
- "packagePrice" must be a whole-dollar integer in the vertical's priceRange (or within 30% of it).`;

export function buildAuditSystemPrompt(context: AuditPromptContext): string {
  const v = context.vertical;
  const tone = context.toneHint || "consultative, specific, founder-to-founder";
  return `You are an expert digital-marketing consultant generating an audit report that ${context.brandName} (a marketing agency) will send to a prospect as a lead-magnet pitch document. The audit will be read in 30 seconds by a busy local-business owner. It must demonstrate genuine insight about THEIR specific business and vertical, not regurgitate generic SEO advice.

The agency's outreach voice: ${tone}. Sender's first name: ${context.senderIdentity}.

Available service-package names you may recommend (pick the one that best matches the findings):
${context.packageOptions.map((p) => `  - ${p}`).join("\n")}

Recommended price range for this vertical: $${v.priceRange.min.toLocaleString()}–$${v.priceRange.max.toLocaleString()}.
Recommended outreach channel for this vertical: ${v.outreachChannel}.

The prospect's vertical: ${v.displayName} (${v.key}).

Buyer-behaviour notes for this vertical (use these to ground every finding):
${v.buyerBehaviour.map((b) => `  - ${b}`).join("\n")}

Concrete signals to LOOK FOR in the prospect's data (use these as a checklist when describing what they're missing or doing well):
${v.signalsToCheck.map((s) => `  - ${s}`).join("\n")}

Style exemplars (do NOT copy verbatim — these are templates for how a finding should READ):
${v.exampleFindings.map((e) => `  - ${e}`).join("\n")}

OUTPUT REQUIREMENTS:
${OUTPUT_SCHEMA_DESCRIPTION}

ABSOLUTE RULES:
1. Every finding MUST reference something specific to THIS business (its name, rating, review count, missing-vs-present signal, scraped content) or to vertical-specific buyer behaviour. NEVER use generic phrases like "page payload appears heavy", "no clear booking flow", "missing trust signals" without a concrete vertical-keyed elaboration.
2. NEVER fabricate data. If you don't know whether the business has X, derive it from the input. If unknown, prefer the more conservative "missing" framing — but explicitly note "based on the publicly visible data" so the agent doesn't get caught misrepresenting facts.
3. The pitch must be HONEST. The audit is a lead magnet; misrepresentation kills the agent's credibility. Findings should be DIRECT but not alarmist.
4. Match the vertical's outreach channel: ${v.outreachChannel === "phone" ? "the cold-call script is the primary outreach; email is supplementary" : v.outreachChannel === "email" ? "the email script is the primary outreach; cold call is supplementary" : "LinkedIn outreach (which uses the email script template) is primary; cold call is supplementary"}.
5. The opening pitch is the SINGLE sentence the agent uses to break the ice. It must name THIS business and ONE specific observation. Example for HVAC: "Hey [name], I noticed [specific business] has 1200 reviews but no 24/7 emergency banner — that mismatch costs you the after-hours calls competitors are quietly catching." NOT "I help HVAC contractors grow their online presence."

Return only the JSON object.`;
}

/**
 * Smaller prompt for the cheap haiku-class classifier used when no
 * category alias matches in the registry. Asks the model to pick a
 * vertical KEY from the provided list. Falls back to
 * `generic_local_services` on any malformed response.
 */
export function buildVerticalClassifierPrompt(allVerticalKeys: string[]): string {
  return `Classify the following business into exactly one of these vertical keys: ${allVerticalKeys.join(", ")}.

Respond with ONLY the key (one word). No prose, no quotes, no JSON.`;
}

/**
 * The user-message portion of the audit-generation call. Carries the
 * specific data about the prospect that the model needs to ground
 * its findings. Kept separate from the system prompt so the system
 * prompt can be cached aggressively (Anthropic prompt-caching) on
 * subsequent calls within the same vertical.
 */
export function buildAuditUserMessage(input: AuditPromptInput): string {
  const lines: string[] = [];
  lines.push(`Business name: ${input.businessName}`);
  if (input.category) lines.push(`Stated category: ${input.category}`);
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.websiteUrl) lines.push(`Website: ${input.websiteUrl}`);
  if (input.phone) lines.push(`Phone: ${input.phone}`);
  if (input.email) lines.push(`Email: ${input.email}`);
  if (typeof input.rating === "number") lines.push(`Google rating: ${input.rating}`);
  if (typeof input.reviewCount === "number") lines.push(`Google review count: ${input.reviewCount}`);
  if (input.scraperSignals && Object.keys(input.scraperSignals).length > 0) {
    lines.push("");
    lines.push("Scraped page signals (true = present on the prospect's site, false = not detected):");
    for (const [k, v] of Object.entries(input.scraperSignals)) {
      lines.push(`  - ${k}: ${typeof v === "number" ? v : String(Boolean(v))}`);
    }
  }
  if (input.scrapedHomepageText) {
    lines.push("");
    lines.push("Homepage text (first 2000 chars, public site copy):");
    lines.push(input.scrapedHomepageText.slice(0, 2000));
  }
  if (input.scrapedAboutText) {
    lines.push("");
    lines.push("About-page text (first 1500 chars, public site copy):");
    lines.push(input.scrapedAboutText.slice(0, 1500));
  }
  if (input.scrapedContactText) {
    lines.push("");
    lines.push("Contact-page text (first 1000 chars, public site copy):");
    lines.push(input.scrapedContactText.slice(0, 1000));
  }
  lines.push("");
  lines.push("Generate the audit JSON now.");
  return lines.join("\n");
}
