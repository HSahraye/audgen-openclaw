import { z } from "zod";
import type { AuditChecks, AuditInput, AuditResult, GeneratedAssets } from "./types";
import { enforceAuditGeneration, ensureWorkspaceOperational } from "@/lib/billing/entitlements";
import { generateLeadIntelligence } from "@/lib/intelligence/engine";
import { resolveGenerationContext } from "@/lib/generation/context";
import { resolvePublicSenderName } from "@/lib/branding";
import { generateLlmAudit, type LlmAuditPayload } from "@/lib/audit/llm-audit-engine";
import { scrapeBusinessWebsite } from "@/lib/audit/scrape-website";
import { logger } from "@/lib/logger";

// SECURITY/UX: null inputs (e.g. propagated from FormData.get()) used to
// crash with "Invalid input: expected string, received null". Preprocess
// coerces null/undefined to "" so optional fields stay optional.
const optionalAuditString = (max: number) =>
  z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().max(max).optional(),
  );

const inputSchema = z.object({
  businessName: z.string().min(1).max(140),
  category: optionalAuditString(80),
  location: optionalAuditString(120),
  websiteUrl: optionalAuditString(300),
  googleProfileUrl: optionalAuditString(500),
  notes: optionalAuditString(4000),
});

const businessCategoryDefaults: Record<string, string> = {
  contractor: "Home service businesses lose high-intent quote requests when visitors cannot quickly trust the work, see proof, and call from mobile.",
  mechanic: "Auto customers compare trust, reviews, and speed. A weak site loses repair calls to cleaner competitors with booking and service pages.",
  cleaner: "Cleaning leads often convert from mobile. Missing proof, pricing guidance, and booking makes the business look smaller than it is.",
  barber: "Barber prospects want photos, reviews, pricing, and booking. If those are missing, they choose a shop with instant confidence.",
  landscaper: "Landscaping customers need visual proof and fast quote CTAs. Missing galleries and service areas reduce estimate requests.",
  detailer: "Mobile detailing buyers need packages, before/after photos, and booking. Weak pages leak premium jobs.",
  restaurant: "Restaurant visitors expect menu, hours, reviews, photos, directions, and ordering/reservations. Missing basics loses immediate visits.",
  plumber: "Plumbing calls are urgent. If a customer can't find a phone number in under 5 seconds, they call the next result.",
  electrician: "Electrical leads need trust signals fast — license info, reviews, and a clear call button are table stakes.",
  roofer: "Roofing is high-ticket and high-trust. Weak proof, no gallery, and poor mobile experience send quotes to competitors.",
  dentist: "Dental practices lose new patients to competitors with visible reviews, easy booking, and service pages that answer common questions.",
  salon: "Beauty clients choose based on photos, reviews, and pricing. Missing any of these sends them to the next Instagram-friendly competitor.",
  gym: "Fitness businesses convert on class schedules, pricing, and free trial CTAs. A static page with no clear action leaks memberships.",
  realestate: "Real estate leads expect listings, agent bios, and instant contact. Generic sites lose trust in the first 8 seconds.",
  lawyer: "Legal clients need trust signals immediately: bar number, practice areas, testimonials, and a free consultation CTA.",
  accountant: "Accounting prospects compare credibility. A thin web presence with no service list or proof loses them before the first call.",
  hvac: "HVAC calls spike seasonally and urgently. A weak mobile presence and no booking option loses jobs to competitors on the same Google page.",
};

function scoreLead(checks: AuditChecks, input: AuditInput) {
  let score = 55;
  if (!checks.hasWebsite) score += 25;
  if (checks.outdatedWebsite) score += 14;
  if (!checks.mobileFriendly) score += 10;
  if (!checks.clearCta) score += 10;
  if (!checks.phoneEasyToFind) score += 8;
  if (!checks.reviewsVisible) score += 6;
  if (!checks.onlineBooking) score += 7;
  if (!checks.gallery) score += 4;
  if (!checks.serviceList) score += 4;
  if (!checks.trustSection) score += 4;
  if (!checks.pricing) score += 3;
  if (!checks.faq) score += 2;
  if (input.googleProfileUrl?.trim()) score += 3;
  return Math.max(1, Math.min(100, score));
}

function packageName(score: number, checks: AuditChecks, packageLabels?: Record<string, string>) {
  const fallback = "Presence Labs Local Trust Tune-Up";
  if (!packageLabels) {
    if (!checks.hasWebsite || score >= 86) return "Presence Labs Launch Package";
    if (score >= 72) return "Presence Labs Conversion Upgrade";
    return fallback;
  }
  if (!checks.hasWebsite || score >= 86) return packageLabels.launch || "Presence Labs Launch Package";
  if (score >= 72) return packageLabels.conversion || "Presence Labs Conversion Upgrade";
  return packageLabels.trust || fallback;
}

function estimateAnnualLoss(category: string) {
  const lower = category.toLowerCase();
  if (/restaurant|food/.test(lower)) return 20_000;
  if (/contractor|roof|plumb|electric|hvac|home/.test(lower)) return 15_000;
  if (/mechanic|auto|repair/.test(lower)) return 12_000;
  if (/landscap|lawn/.test(lower)) return 10_000;
  if (/clean/.test(lower)) return 8_000;
  if (/detail/.test(lower)) return 5_000;
  if (/barber|salon/.test(lower)) return 4_000;
  return 7_500;
}

function localAssets(
  input: AuditInput,
  checks: AuditChecks,
  score: number,
  config: {
    brandName: string;
    senderIdentity: string;
    offerTemplateName: string;
    proposalSections: string[];
    packageLabels?: Record<string, string>;
    outreachStyle: string;
    urgencyStyle: string;
  },
): GeneratedAssets {
  const category = input.category?.trim() || "local business";
  const location = input.location?.trim() || "the Bay Area";
  const name = input.businessName.trim();
  const ownerFirst = input.ownerName?.trim().split(" ")[0] ?? "";

  // Build specific gap list with impact language
  const gapDetails: Array<{ short: string; impact: string }> = [
    !checks.hasWebsite && { short: "no website", impact: "customers searching online can't find or trust the business" },
    checks.outdatedWebsite && { short: "outdated site", impact: "poor first impression on mobile — visitors bounce before calling" },
    !checks.mobileFriendly && { short: "not mobile-optimized", impact: "over 70% of local searches are mobile; a broken mobile experience kills calls" },
    !checks.clearCta && { short: "no clear call-to-action", impact: "visitors don't know what to do next so they leave" },
    !checks.phoneEasyToFind && { short: "phone number hard to find", impact: "high-intent customers give up and call a competitor" },
    !checks.reviewsVisible && { short: "no visible reviews", impact: "no social proof means lower trust and fewer conversions" },
    !checks.onlineBooking && { short: "no booking option", impact: "customers who want to act now can't, so they move on" },
    !checks.gallery && { short: "no photo gallery", impact: "without visual proof, customers can't picture the work quality" },
    !checks.serviceList && { short: "services not listed", impact: "confused visitors don't convert — they need to know exactly what you offer" },
    !checks.trustSection && { short: "missing trust signals", impact: "no license, guarantee, or credentials visible to reduce buyer hesitation" },
    !checks.pricing && { short: "no pricing guidance", impact: "buyers who can't estimate cost often don't bother asking" },
  ].filter(Boolean) as Array<{ short: string; impact: string }>;

  const topGaps = gapDetails.slice(0, 4);
  const topShort = topGaps.map((g) => g.short);
  const topImpact = topGaps.slice(0, 2).map((g) => g.impact);

  const annualLoss = estimateAnnualLoss(category);
  const monthlyLoss = Math.round(annualLoss / 12);
  const offer = packageName(score, checks, config.packageLabels);

  const callGreeting = ownerFirst ? `Hey ${ownerFirst}` : `Hey, is this the owner of ${name}`;
  const writtenGreeting = ownerFirst ? `Hi ${ownerFirst}` : "Hi";

  // Pain summary: specific, punchy, consultative
  const pain = topGaps.length > 0
    ? `${name} has ${topGaps.length} key online-presence gaps: ${topShort.join(", ")}. The biggest revenue risks: ${topImpact.slice(0, 2).join("; ")}. For a ${category} business in ${location}, these gaps likely cost $${monthlyLoss.toLocaleString()}+ per month in missed calls and lost quotes.`
    : `${name} has a solid online foundation but conversion gaps in the final 20% that turn visitors into paying customers. Small fixes to trust signals and CTAs could meaningfully increase call volume.`;

  // Cold call: short, punchy, specific observation
  const callObservation = topShort[0] ? `one thing that jumped out was ${topShort[0]}` : "a few conversion gaps that may be costing calls";
  const tonePrefix = config.outreachStyle === "aggressive" ? "quick one" : config.outreachStyle === "premium" ? "brief strategic note" : "quick note";
  const coldCallScript = `${callGreeting}? This is ${config.senderIdentity} with ${config.brandName} — ${tonePrefix} for ${category} businesses in ${location}. I was reviewing ${name} and ${callObservation}${topShort[1] ? ` and ${topShort[1]}` : ""}. That kind of thing can quietly bleed calls every week. I put together a quick 1-page audit — would it be okay if I texted it over? Takes 2 minutes to look at and it's free.`;

  // SMS: ultra short, curiosity hook
  const textMessageScript = `${ownerFirst ? `Hey ${ownerFirst}` : "Hey"} — ${config.senderIdentity} here from ${config.brandName}. I checked ${name}'s online presence and spotted ${topShort[0] ?? "a few quick wins"} that could turn more Google visitors into calls. Mind if I send a free 1-pager? Takes 2 min to read.`;

  // Email: professional, specific, low-pressure
  const bulletGaps = topGaps.slice(0, 4).map((g) => `• ${g.short} — ${g.impact}`).join("\n");
  const urgencySentence = config.urgencyStyle === "urgent"
    ? "These should be prioritized this week while buyer intent is still recoverable."
    : "These are fixable in a focused sprint.";
  const emailScript = `Subject: Found a few quick wins for ${name}\n\n${writtenGreeting},\n\nI was researching local ${category} businesses in ${location} and looked at ${name}'s online presence. A few things stood out that may be costing you calls:\n\n${bulletGaps || "• Conversion gaps that reduce how many visitors become customers"}\n\n${urgencySentence} The upside for a ${category} business in ${location} is typically $${monthlyLoss.toLocaleString()}/month+ in recovered leads.\n\n${config.brandName} builds local business websites that fix exactly these issues: mobile-first, fast, with clear CTAs, trust sections, service pages, and review proof.\n\nI put together a quick audit for ${name}. Want me to send it over?\n\nBest,\n${config.senderIdentity}\n${config.brandName}`;

  // 30-second pitch: specific to the gaps found
  const thirtySecondPitch = topGaps.length > 0
    ? `${name} already gets local search traffic, but ${topShort.slice(0, 2).join(" and ")} is likely causing visitors to leave before calling. ${config.brandName} fixes those exact gaps — clean mobile site, visible trust proof, clear CTAs — so the traffic ${name} already gets actually converts into calls and booked jobs. Most clients recover the investment in the first 4-6 weeks.`
    : `${name} has a solid presence but the final conversion layer — trust signals, clear CTAs, social proof — can be tightened. ${config.brandName} handles that refresh so more of the traffic you already get actually calls.`;

  // Follow-up: value-first, not pushy
  const followUpMessage = `${ownerFirst ? `Hey ${ownerFirst}` : "Hey"} — quick follow-up. I finished the audit for ${name} and found ${topGaps.length > 0 ? `${topGaps.length} specific gaps including ${topShort[0]}` : "a few conversion improvements worth making"}. I can walk you through it in 10 minutes. Want me to send it over?`;

  return {
    leadScore: score,
    painPointSummary: pain,
    recommendedPackage: offer,
    likelyMoneyLost: `${name} is likely losing $${monthlyLoss.toLocaleString()}–$${(monthlyLoss * 2).toLocaleString()}/month in missed calls and lost quote requests. ${category.charAt(0).toUpperCase() + category.slice(1)} businesses in ${location} compete heavily on first impression, trust, and ease of contact. Customers comparing 2-3 options choose the business that looks most credible and makes it easiest to act — that's often not ${name} right now.`,
    presenceLabsOffer: `${offer}: a complete local business web presence built to convert — mobile-first design, service pages, gallery, review proof, trust section, FAQ, click-to-call, and Google-optimized structure. Delivered in 2–3 weeks, built for ${category} businesses in ${location} by ${config.brandName}.`,
    estimatedAnnualLoss: annualLoss,
    coldCallScript,
    textMessageScript,
    emailScript,
    thirtySecondPitch,
    followUpMessage,
    proposalOutline: [
      `Current online presence snapshot for ${name}`,
      `Top ${topGaps.length > 0 ? topGaps.length : "4"} conversion gaps and estimated revenue impact`,
      `Recommended solution: ${offer}`,
      `Deliverables (${config.offerTemplateName}): mobile site, service pages, gallery, trust section, CTAs, review proof`,
      `Proposal sections: ${config.proposalSections.join(", ")}`,
      "Timeline: 2–3 weeks to launch | Investment & next steps",
    ],
  };
}

function toLegacyChecks(input: AuditInput, intelligence: AuditResult["intelligence"]): AuditChecks {
  const painText = intelligence.painPoints.join(" ").toLowerCase();
  const strengthText = intelligence.strengths.join(" ").toLowerCase();
  const hasWebsite = Boolean(input.websiteUrl?.trim());
  return {
    hasWebsite,
    outdatedWebsite: /missing|weak|outdated|heavy|broken/.test(painText),
    mobileFriendly: /mobile/.test(strengthText) && !/mobile/.test(painText),
    clearCta: !/call to action|cta/.test(painText),
    phoneEasyToFind: !/contact|phone/.test(painText),
    reviewsVisible: /review/.test(strengthText),
    onlineBooking: /booking|schedule|appointment/.test(strengthText),
    trustSection: /trust|https|badge|review/.test(strengthText),
    gallery: /gallery|photo|portfolio/.test(strengthText),
    serviceList: /service/.test(strengthText),
    pricing: !/pricing/.test(painText),
    faq: /faq/.test(strengthText),
  };
}

export async function generateAudit(rawInput: AuditInput): Promise<AuditResult> {
  const input = inputSchema.parse(rawInput);
  if (rawInput.workspaceId) {
    const workspaceState = await ensureWorkspaceOperational(rawInput.workspaceId);
    if (!workspaceState.ok) {
      throw new Error(workspaceState.reason || "Workspace is not operational.");
    }
    const entitlement = await enforceAuditGeneration(rawInput.workspaceId);
    if (!entitlement.allowed) {
      throw new Error(entitlement.reason || "Audit generation limit reached.");
    }
  }
  const generationContext = await resolveGenerationContext(rawInput.workspaceId, rawInput.category);
  const brandName = resolvePublicSenderName(
    generationContext.workspaceSettings
      ? {
          senderCompanyName: (generationContext.workspaceSettings as { senderCompanyName?: string | null }).senderCompanyName ?? null,
          brandName: generationContext.workspaceSettings.brandName ?? null,
          agencyName: (generationContext.workspaceSettings as { agencyName?: string | null }).agencyName ?? null,
          publicCompanyName: (generationContext.workspaceSettings as { publicCompanyName?: string | null }).publicCompanyName ?? null,
        }
      : null,
  );
  const senderIdentity = generationContext.workspaceSettings?.senderIdentity || "Hamid";
  const intelligenceRun = await generateLeadIntelligence({
    ...input,
    narrativeContext: {
      brandName,
      tone: generationContext.auditTemplate.config.tone,
      outreachStyle: generationContext.outreachTemplate.config.outreachStyle,
      proposalStyle: generationContext.offerTemplate.config.proposalStyle,
      urgencyStyle: generationContext.auditTemplate.config.urgencyStyle,
      ctaStyle: generationContext.auditTemplate.config.ctaStyle,
      emphasis: generationContext.auditTemplate.config.emphasis,
    },
  });
  const warnings = [...intelligenceRun.diagnostics.fetchWarnings];
  const categoryInsight = Object.entries(businessCategoryDefaults).find(([key]) =>
    `${input.category ?? ""} ${input.notes ?? ""}`.toLowerCase().includes(key),
  )?.[1];
  if (categoryInsight) warnings.push(categoryInsight);

  const templatedChecks = toLegacyChecks(input, intelligenceRun.intelligence);
  const score = scoreLead(templatedChecks, input);
  const local = localAssets(input, templatedChecks, score, {
    brandName,
    senderIdentity,
    offerTemplateName: generationContext.offerTemplate.name,
    proposalSections: generationContext.offerTemplate.config.sectionOrder,
    packageLabels: Object.fromEntries(
      Object.entries(generationContext.offerTemplate.config.packageLabels || {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    outreachStyle: generationContext.outreachTemplate.config.outreachStyle,
    urgencyStyle: generationContext.auditTemplate.config.urgencyStyle,
  });
  const templatedAssets: GeneratedAssets = {
    ...local,
    leadScore: score,
    painPointSummary: intelligenceRun.narrative.painPointSummary || local.painPointSummary,
    likelyMoneyLost: intelligenceRun.narrative.likelyMoneyLost || local.likelyMoneyLost,
    presenceLabsOffer: intelligenceRun.narrative.presenceLabsOffer || local.presenceLabsOffer,
    recommendedPackage: intelligenceRun.intelligence.recommendedOffer || local.recommendedPackage,
  };

  // === LLM AUDIT ENGINE INTEGRATION ===
  // Behaviour:
  //   * No ANTHROPIC_API_KEY → templated path runs as before, no LLM
  //     call, no scrape, no extra latency. (This is the default state
  //     until the operator sets the production env var.)
  //   * Key set → scrape website + call generateLlmAudit. On success,
  //     replace assets/checks with LLM output. Findings + executive
  //     summary are pushed onto the audit's `warnings` array (the
  //     dashboard's lead-detail panel renders that slot).
  //   * Any LLM failure (timeout, schema validation, cost cap,
  //     concurrency cap) returns source=llm-fallback and we keep the
  //     templated assets/checks. The user-visible behaviour is
  //     identical to the pre-LLM state.
  let assets: GeneratedAssets = templatedAssets;
  let checks: AuditChecks = templatedChecks;
  let llmPayload: LlmAuditPayload | null = null;
  const llmEnabled = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (llmEnabled) {
    try {
      const scrape = input.websiteUrl ? await scrapeBusinessWebsite(input.websiteUrl) : null;
      llmPayload = await generateLlmAudit(
        {
          businessName: input.businessName,
          category: input.category ?? null,
          location: input.location ?? null,
          websiteUrl: input.websiteUrl ?? null,
          phone: null, // not on AuditInput today; left for future plumb-through from leadgen
          email: null,
          rating: null,
          reviewCount: null,
          scrapedHomepageText: scrape?.homepageText ?? null,
          scrapedAboutText: scrape?.aboutText ?? null,
          scrapedContactText: scrape?.contactText ?? null,
          scraperSignals: scrape
            ? Object.fromEntries(
                Object.entries(scrape.signals).map(([k, v]) => [k, typeof v === "boolean" || typeof v === "number" ? v : Boolean(v)]),
              )
            : null,
          workspaceId: rawInput.workspaceId,
        },
        {
          brandName,
          senderIdentity,
          packageOptions: Object.values(generationContext.offerTemplate.config.packageLabels || {}).filter(
            (label): label is string => typeof label === "string" && label.trim().length > 0,
          ),
          toneHint: generationContext.auditTemplate.config.tone,
        },
      );
      if (llmPayload.source === "llm") {
        // Re-anchor the leadScore: the LLM doesn't see workspace
        // entitlement / scoring rules, so we keep the deterministic
        // local score on top of the LLM-generated copy.
        assets = { ...llmPayload.assets, leadScore: score };
        checks = llmPayload.checks;
        // Findings render as audit "warnings" — same dashboard slot.
        warnings.unshift(...llmPayload.findings);
        if (llmPayload.executiveSummary) warnings.unshift(llmPayload.executiveSummary);
      }
    } catch (err) {
      // Defensive: generateLlmAudit() promises never to throw, but
      // belt-and-braces. Templated assets stay; the audit ships.
      logger.error("audit_engine_llm_path_threw_unexpectedly", {
        reason: err instanceof Error ? err.message.slice(0, 160) : "unknown",
        workspaceId: rawInput.workspaceId,
      });
    }
  }
  // === END LLM INTEGRATION ===

  const generatedContext = {
    generationVersion: "v4-template-driven",
    workspaceId: generationContext.workspace?.id ?? null,
    workspaceName: generationContext.workspace?.name ?? null,
    branding: {
      brandName,
      logoUrl: generationContext.workspaceSettings?.logoUrl ?? generationContext.workspace?.logoUrl ?? null,
      primaryColor: generationContext.workspaceSettings?.primaryColor ?? null,
      accentColor: generationContext.workspaceSettings?.accentColor ?? null,
      typography: generationContext.workspaceSettings?.typography ?? null,
      senderIdentity: generationContext.workspaceSettings?.senderIdentity ?? null,
      footerContent: generationContext.workspaceSettings?.footerContent ?? null,
      ctaLabelPrimary: generationContext.workspaceSettings?.ctaLabelPrimary ?? null,
      ctaLabelSecondary: generationContext.workspaceSettings?.ctaLabelSecondary ?? null,
      auditIntroCopy: generationContext.workspaceSettings?.auditIntroCopy ?? null,
      auditOutroCopy: generationContext.workspaceSettings?.auditOutroCopy ?? null,
    },
    templates: {
      audit: {
        id: generationContext.auditTemplate.id,
        name: generationContext.auditTemplate.name,
        source: generationContext.auditTemplate.source,
        version: generationContext.auditTemplate.version,
        category: generationContext.auditTemplate.category,
      },
      outreach: {
        id: generationContext.outreachTemplate.id,
        name: generationContext.outreachTemplate.name,
        source: generationContext.outreachTemplate.source,
        version: generationContext.outreachTemplate.version,
        category: generationContext.outreachTemplate.category,
      },
      offer: {
        id: generationContext.offerTemplate.id,
        name: generationContext.offerTemplate.name,
        source: generationContext.offerTemplate.source,
        version: generationContext.offerTemplate.version,
        category: generationContext.offerTemplate.category,
      },
    },
    templateSnapshot: {
      audit: generationContext.auditTemplate,
      outreach: generationContext.outreachTemplate,
      offer: generationContext.offerTemplate,
    },
    scoringSummary: {
      closeProbability: intelligenceRun.intelligence.closeProbability,
      urgencyScore: intelligenceRun.intelligence.urgencyScore,
      momentumScore: intelligenceRun.intelligence.momentumScore ?? null,
    },
    providerMetadata: {
      source: intelligenceRun.diagnostics.source,
      llmSource: llmPayload?.source,
      llmVertical: llmPayload?.verticalKey,
      llmVerticalDisplayName: llmPayload?.verticalDisplayName,
      llmModel: llmPayload?.diagnostics?.model,
      llmInputTokens: llmPayload?.diagnostics?.inputTokens,
      llmOutputTokens: llmPayload?.diagnostics?.outputTokens,
      llmEstimatedCostUsd: llmPayload?.diagnostics?.estimatedCostUsd,
      llmDurationMs: llmPayload?.diagnostics?.durationMs,
      llmFallbackReason: llmPayload?.fallbackReason,
      llmRecommendedPrice:
        llmPayload?.source === "llm" && typeof llmPayload?.recommendedPrice === "number"
          ? llmPayload.recommendedPrice
          : undefined,
    },
  } satisfies NonNullable<AuditResult["generatedContext"]>;

  // Source priority: a successful LLM run brands the audit "claude";
  // an LLM fallback or no-LLM run keeps the prior intelligence-source
  // labelling so the dashboard's "Generated with X" copy stays
  // accurate.
  const source: AuditResult["source"] =
    llmPayload?.source === "llm"
      ? "claude"
      : intelligenceRun.diagnostics.source === "gemini"
        ? "intelligence-gemini"
        : "intelligence-local";

  return {
    checks,
    assets,
    intelligence: intelligenceRun.intelligence,
    websiteSignals: intelligenceRun.diagnostics.websiteSignals,
    warnings,
    source,
    generatedContext,
  };
}
