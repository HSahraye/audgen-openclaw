// Claude-powered, vertical-adaptive audit engine.
//
// CONTRACT:
//   - The engine NEVER throws. On any failure (missing API key,
//     unparseable response, SDK error, hard timeout, schema-validation
//     failure after one retry), it returns a structured result with
//     `source: "llm-fallback"` and the caller falls back to the
//     existing templated `localAssets()` path.
//   - The engine output shape is a STRICT superset of `GeneratedAssets`
//     so the dashboard's parsedLeads renderer (audit-dashboard-utils.ts)
//     can consume it directly. Schema validation rejects responses
//     missing any GeneratedAssets field; Zod's superset acceptance is
//     intentional so additive Anthropic responses don't break us.
//   - Workspace concurrency capped at 10 in-flight calls per workspace
//     via in-process semaphore; 11th call waits or short-circuits to
//     fallback if the queue is too deep.
//   - 30-second hard timeout on the SDK call. Aborted via
//     AbortController; on timeout we emit a structured warning and
//     return the fallback result.
//   - Cost cap: max_tokens=4000, system+user prompts capped, model
//     hard-coded to sonnet-4-6 for the main call (haiku-4-5 for the
//     classifier). Override via ANTHROPIC_MODEL_AUDIT and
//     ANTHROPIC_MODEL_CLASSIFIER environment variables.
//
// Defense-in-depth note: the c05db5e contract test (helper output
// satisfies GeneratedAssets) and the 189e605 defensive parser
// (audit-dashboard-utils.ts) BOTH still apply. Any malformed engine
// output from this module that slips past validation will still
// render safely in the dashboard, just with placeholder copy.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";
import {
  buildAuditSystemPrompt,
  buildAuditUserMessage,
  buildVerticalClassifierPrompt,
  type AuditPromptInput,
} from "./audit-system-prompt";
import {
  ALL_VERTICALS,
  getVerticalIntelligence,
  inferVerticalFromCategory,
  listVerticalKeys,
  type VerticalIntelligence,
} from "./verticals";

const DEFAULT_AUDIT_MODEL = process.env.ANTHROPIC_MODEL_AUDIT || "claude-sonnet-4-6";
const DEFAULT_CLASSIFIER_MODEL = process.env.ANTHROPIC_MODEL_CLASSIFIER || "claude-haiku-4-5";
const HARD_TIMEOUT_MS = 30_000;
const MAX_TOKENS_AUDIT = 4_000;
const MAX_TOKENS_CLASSIFIER = 16;
const MAX_CONCURRENT_PER_WORKSPACE = 10;

// Anthropic Sonnet 4.6 list pricing as of 2026-05-18: $3/MTok input,
// $15/MTok output. Worst-case 8000 input + 4000 output ≈
// $0.024 + $0.060 = $0.084. Adding the haiku classifier (~$0.001)
// keeps total < $0.10/audit. The 4000-token output cap mathematically
// guarantees we cannot exceed ~$0.20 per call. Cost-cap abort
// triggers on any computed cost > $1, which would only fire if
// pricing changes or the cap is misconfigured.
const COST_PER_INPUT_TOKEN_USD = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN_USD = 15 / 1_000_000;
const COST_HARD_CAP_USD = 1.0;

export type LlmAuditPayload = {
  source: "llm" | "llm-fallback";
  /** Vertical key resolved (registry or classifier) for telemetry/UI badge. */
  verticalKey: string;
  verticalDisplayName: string;
  executiveSummary: string;
  findings: string[];
  openingPitch: string;
  checks: AuditChecks;
  assets: GeneratedAssets;
  /** When source=llm-fallback, populated with a short reason string. */
  fallbackReason?: string;
  /** Diagnostic — populated only when source=llm. */
  diagnostics?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
  };
};

export type LlmAuditInput = AuditPromptInput & {
  workspaceId?: string;
  /**
   * Optional hint from the caller. When present, we skip the
   * classifier entirely. Otherwise we try `inferVerticalFromCategory`
   * (deterministic alias match) first, then fall back to the haiku
   * classifier ONLY if a category was provided that didn't match.
   */
  vertical?: string;
};

export type LlmAuditWorkspaceContext = {
  brandName: string;
  senderIdentity: string;
  packageOptions: string[];
  toneHint?: string;
};

const verticalKeyEnum = z.enum([...listVerticalKeys()] as [string, ...string[]]);

const checksSchema = z
  .object({
    hasWebsite: z.boolean(),
    outdatedWebsite: z.boolean(),
    mobileFriendly: z.boolean(),
    clearCta: z.boolean(),
    phoneEasyToFind: z.boolean(),
    reviewsVisible: z.boolean(),
    onlineBooking: z.boolean(),
    trustSection: z.boolean(),
    gallery: z.boolean(),
    serviceList: z.boolean(),
    pricing: z.boolean(),
    faq: z.boolean(),
  })
  .passthrough();

const auditResponseSchema = z
  .object({
    executiveSummary: z.string().min(10),
    findings: z.array(z.string().min(10)).min(5).max(8),
    checks: checksSchema,
    openingPitch: z.string().min(10),
    painSummary: z.string().min(20),
    likelyMoneyLost: z.string().min(10),
    presenceLabsOffer: z.string().min(10),
    recommendedPackage: z.string().min(2),
    packagePrice: z.number().int().positive(),
    coldCallScript: z.string().min(40),
    textMessageScript: z.string().min(20),
    emailScript: z.string().min(60),
    thirtySecondPitch: z.string().min(40),
    followUpMessage: z.string().min(20),
    proposalOutline: z.array(z.string().min(3)).length(6),
  })
  .passthrough();

type ParsedAuditResponse = z.infer<typeof auditResponseSchema>;

// In-process per-workspace concurrency semaphore. Cleared on process
// restart. Anthropic's own rate limits (RPM + TPM) are enforced
// server-side; this is local protection against a runaway batch
// import burning entitlements before the user notices.
const inFlightByWorkspace: Map<string, number> = new Map();

function trackInFlight(workspaceId: string | undefined): boolean {
  const key = workspaceId ?? "<no-workspace>";
  const current = inFlightByWorkspace.get(key) ?? 0;
  if (current >= MAX_CONCURRENT_PER_WORKSPACE) return false;
  inFlightByWorkspace.set(key, current + 1);
  return true;
}

function releaseInFlight(workspaceId: string | undefined): void {
  const key = workspaceId ?? "<no-workspace>";
  const current = inFlightByWorkspace.get(key) ?? 0;
  if (current <= 1) inFlightByWorkspace.delete(key);
  else inFlightByWorkspace.set(key, current - 1);
}

function buildFallbackPayload(
  input: LlmAuditInput,
  vertical: VerticalIntelligence,
  reason: string,
): LlmAuditPayload {
  // The fallback payload's content is intentionally minimal — the
  // CALLER (audit-engine.ts integration) decides whether to invoke
  // the legacy templated engine or to surface this as the final
  // result. Most callers should treat source=llm-fallback as a hint
  // that the templated path should run.
  const placeholder =
    "Audit pending — Claude generation unavailable; falling back to templated content.";
  const fallbackChecks: AuditChecks = {
    hasWebsite: Boolean(input.websiteUrl),
    outdatedWebsite: false,
    mobileFriendly: false,
    clearCta: false,
    phoneEasyToFind: Boolean(input.phone),
    reviewsVisible: typeof input.reviewCount === "number" && input.reviewCount > 0,
    onlineBooking: false,
    trustSection: false,
    gallery: false,
    serviceList: false,
    pricing: false,
    faq: false,
  };
  return {
    source: "llm-fallback",
    verticalKey: vertical.key,
    verticalDisplayName: vertical.displayName,
    executiveSummary: placeholder,
    findings: [placeholder],
    openingPitch: placeholder,
    checks: fallbackChecks,
    fallbackReason: reason,
    assets: {
      leadScore: 50,
      painPointSummary: placeholder,
      recommendedPackage: "Presence Labs Local Trust Tune-Up",
      likelyMoneyLost: placeholder,
      presenceLabsOffer: placeholder,
      coldCallScript: placeholder,
      textMessageScript: placeholder,
      emailScript: placeholder,
      thirtySecondPitch: placeholder,
      followUpMessage: placeholder,
      proposalOutline: [
        "Current online presence snapshot",
        "Top conversion gaps and revenue impact",
        "Recommended solution",
        "Deliverables",
        "Timeline",
        "Investment & next steps",
      ],
    },
  };
}

function parseAuditFromText(text: string): ParsedAuditResponse | null {
  // Some models occasionally wrap JSON in markdown fences. Be tolerant.
  const trimmed = text.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    return null;
  }
  const parsed = auditResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, abortController: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      abortController.abort();
      reject(new Error(`anthropic-call-timeout-${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function classifyVerticalLlm(
  client: Anthropic,
  input: LlmAuditInput,
): Promise<string | null> {
  const allKeys = listVerticalKeys();
  const messageText = [
    `Business name: ${input.businessName}`,
    input.category ? `Stated category: ${input.category}` : null,
    input.websiteUrl ? `Website: ${input.websiteUrl}` : null,
    input.scrapedHomepageText ? `Homepage excerpt: ${input.scrapedHomepageText.slice(0, 600)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const abortController = new AbortController();
  try {
    const resp = await withTimeout(
      client.messages.create(
        {
          model: DEFAULT_CLASSIFIER_MODEL,
          max_tokens: MAX_TOKENS_CLASSIFIER,
          system: buildVerticalClassifierPrompt(allKeys),
          messages: [{ role: "user", content: messageText }],
        },
        { signal: abortController.signal },
      ),
      10_000,
      abortController,
    );
    const block = resp.content?.[0];
    const raw = block && "text" in block && typeof block.text === "string" ? block.text : "";
    const candidate = raw.trim().toLowerCase().split(/\s+/)[0];
    return allKeys.includes(candidate) ? candidate : null;
  } catch (err) {
    logger.warn("llm_audit_classifier_failed", {
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    return null;
  }
}

async function resolveVertical(
  client: Anthropic | null,
  input: LlmAuditInput,
): Promise<VerticalIntelligence> {
  // 1) Explicit override from caller
  if (input.vertical) {
    const direct = ALL_VERTICALS.find((v) => v.key === input.vertical);
    if (direct) return direct;
  }
  // 2) Deterministic alias match (free)
  const aliasKey = inferVerticalFromCategory(input.category);
  if (aliasKey) return getVerticalIntelligence(aliasKey);
  // 3) LLM classifier — only if we already have an Anthropic client
  if (!client) return getVerticalIntelligence("generic_local_services");
  const llmKey = await classifyVerticalLlm(client, input);
  if (llmKey) return getVerticalIntelligence(llmKey);
  return getVerticalIntelligence("generic_local_services");
}

function projectAssetsFromAuditResponse(parsed: ParsedAuditResponse, _vertical: VerticalIntelligence): GeneratedAssets {
  return {
    leadScore: 50, // overridden by the integration layer using its own scoring
    painPointSummary: parsed.painSummary,
    recommendedPackage: parsed.recommendedPackage,
    likelyMoneyLost: parsed.likelyMoneyLost,
    presenceLabsOffer: parsed.presenceLabsOffer,
    estimatedAnnualLoss: undefined,
    coldCallScript: parsed.coldCallScript,
    textMessageScript: parsed.textMessageScript,
    emailScript: parsed.emailScript,
    thirtySecondPitch: parsed.thirtySecondPitch,
    followUpMessage: parsed.followUpMessage,
    proposalOutline: parsed.proposalOutline,
  };
}

export async function generateLlmAudit(
  input: LlmAuditInput,
  workspaceContext: LlmAuditWorkspaceContext,
): Promise<LlmAuditPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // No API key → immediate fallback, no LLM call attempted.
  if (!apiKey) {
    const vertical = await resolveVertical(null, input);
    return buildFallbackPayload(input, vertical, "missing-anthropic-api-key");
  }

  // Concurrency gate — refuse new calls if the workspace queue is full.
  if (!trackInFlight(input.workspaceId)) {
    const vertical = await resolveVertical(null, input);
    logger.warn("llm_audit_concurrency_capped", {
      workspaceId: input.workspaceId,
      cap: MAX_CONCURRENT_PER_WORKSPACE,
    });
    return buildFallbackPayload(input, vertical, "workspace-concurrency-cap");
  }

  let client: Anthropic;
  try {
    client = new Anthropic({ apiKey });
  } catch (err) {
    releaseInFlight(input.workspaceId);
    const vertical = await resolveVertical(null, input);
    logger.warn("llm_audit_sdk_init_failed", {
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    return buildFallbackPayload(input, vertical, "anthropic-sdk-init-failed");
  }

  const vertical = await resolveVertical(client, input);

  const systemPrompt = buildAuditSystemPrompt({
    vertical,
    brandName: workspaceContext.brandName,
    senderIdentity: workspaceContext.senderIdentity,
    packageOptions: workspaceContext.packageOptions,
    toneHint: workspaceContext.toneHint,
  });
  const userMessage = buildAuditUserMessage(input);

  const start = Date.now();
  let parsed: ParsedAuditResponse | null = null;
  let lastError: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const abortController = new AbortController();
    try {
      const resp = await withTimeout(
        client.messages.create(
          {
            model: DEFAULT_AUDIT_MODEL,
            max_tokens: MAX_TOKENS_AUDIT,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          },
          { signal: abortController.signal },
        ),
        HARD_TIMEOUT_MS,
        abortController,
      );

      // Cost guard.
      inputTokens = resp.usage?.input_tokens ?? 0;
      outputTokens = resp.usage?.output_tokens ?? 0;
      estimatedCostUsd = inputTokens * COST_PER_INPUT_TOKEN_USD + outputTokens * COST_PER_OUTPUT_TOKEN_USD;
      if (estimatedCostUsd > COST_HARD_CAP_USD) {
        releaseInFlight(input.workspaceId);
        logger.error("llm_audit_cost_cap_exceeded", {
          workspaceId: input.workspaceId,
          inputTokens,
          outputTokens,
          estimatedCostUsd,
          cap: COST_HARD_CAP_USD,
        });
        return buildFallbackPayload(input, vertical, "cost-cap-exceeded");
      }

      const block = resp.content?.[0];
      const text = block && "text" in block && typeof block.text === "string" ? block.text : "";
      parsed = parseAuditFromText(text);
      if (parsed) break; // success
      lastError = "schema-validation-failed";
      logger.warn("llm_audit_schema_validation_failed", {
        workspaceId: input.workspaceId,
        attempt,
        textPrefix: text.slice(0, 200),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 120) : "unknown";
      logger.warn("llm_audit_call_failed", {
        workspaceId: input.workspaceId,
        attempt,
        reason: lastError,
      });
    }
  }

  releaseInFlight(input.workspaceId);

  if (!parsed) {
    return buildFallbackPayload(input, vertical, lastError ?? "unknown");
  }

  // Success path. Log a single info line per audit so cost +
  // performance show up in Netlify logs without flooding.
  logger.info("llm_audit_succeeded", {
    workspaceId: input.workspaceId,
    verticalKey: vertical.key,
    model: DEFAULT_AUDIT_MODEL,
    inputTokens,
    outputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    durationMs: Date.now() - start,
  });

  return {
    source: "llm",
    verticalKey: vertical.key,
    verticalDisplayName: vertical.displayName,
    executiveSummary: parsed.executiveSummary,
    findings: parsed.findings,
    openingPitch: parsed.openingPitch,
    checks: parsed.checks,
    assets: projectAssetsFromAuditResponse(parsed, vertical),
    diagnostics: {
      model: DEFAULT_AUDIT_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      durationMs: Date.now() - start,
    },
  };
}

/** EXPORTED ONLY FOR TESTS. */
export const __test__ = {
  parseAuditFromText,
  trackInFlight,
  releaseInFlight,
  inFlightByWorkspace,
  resolveVertical,
  buildFallbackPayload,
};
