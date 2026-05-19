/* eslint-disable no-console */
//
// Manual QA harness for the LLM audit engine.
//
//   ANTHROPIC_API_KEY=sk-ant-... \
//   npx tsx scripts/llm-audit-smoke.ts \
//     "TRIO Heating" "https://trioheatingandair.com" "HVAC contractors"
//
// What it does (and does NOT do):
//   - Calls the website scraper (real network fetch).
//   - Calls the LLM audit engine (real Anthropic API call, costs ~$0.10).
//   - Prints the resulting findings, scripts, and package recommendation
//     to the terminal.
//   - Does NOT touch the database. Does NOT enforce entitlement.
//   - Does NOT hit the templated-fallback path unless ANTHROPIC_API_KEY
//     is missing or the call errors.
//
// Use this for QA after a code change before pushing — verify the
// engine produces sensible vertical-specific findings without going
// through the full /leadgen → Add Selected → Regenerate flow.

import { generateLlmAudit } from "../src/lib/audit/llm-audit-engine";
import { scrapeBusinessWebsite } from "../src/lib/audit/scrape-website";

async function main() {
  const [, , ...args] = process.argv;
  const businessName = args[0] ?? "Acme HVAC";
  const websiteUrl = args[1] ?? "";
  const category = args[2] ?? "HVAC contractors";
  const verticalOverride = args[3] ?? undefined;

  console.log("=== AuditGen LLM smoke test ===");
  console.log("Business name :", businessName);
  console.log("Website URL   :", websiteUrl || "(none)");
  console.log("Category      :", category);
  console.log("Vertical      :", verticalOverride ?? "(auto-detect)");
  console.log("Model         :", process.env.ANTHROPIC_MODEL_AUDIT || "claude-sonnet-4-6");
  console.log("API key set   :", Boolean(process.env.ANTHROPIC_API_KEY));
  console.log("");

  console.log("[1/3] Scraping website...");
  const scrapeStart = Date.now();
  const scrape = websiteUrl ? await scrapeBusinessWebsite(websiteUrl) : null;
  if (scrape) {
    console.log(`  fetched=${scrape.fetched}  loadTime=${scrape.loadTimeMs}ms  finalUrl=${scrape.finalUrl ?? "(none)"}`);
    if (scrape.fetchError) console.log(`  fetchError: ${scrape.fetchError}`);
    console.log(`  signals: ${JSON.stringify(scrape.signals, null, 0)}`);
    console.log(`  homepage excerpt (first 280 chars): ${scrape.homepageText.slice(0, 280)}…`);
  } else {
    console.log("  (skipped — no URL provided)");
  }
  console.log(`  scrape duration: ${Date.now() - scrapeStart}ms`);
  console.log("");

  console.log("[2/3] Calling LLM audit engine...");
  const auditStart = Date.now();
  const result = await generateLlmAudit(
    {
      businessName,
      category,
      location: "San Jose, CA",
      websiteUrl: websiteUrl || null,
      phone: null,
      email: null,
      rating: null,
      reviewCount: null,
      scrapedHomepageText: scrape?.homepageText ?? null,
      scrapedAboutText: scrape?.aboutText ?? null,
      scrapedContactText: scrape?.contactText ?? null,
      scraperSignals: scrape ? Object.fromEntries(Object.entries(scrape.signals)) : null,
      vertical: verticalOverride,
    },
    {
      brandName: "Presence Labs",
      senderIdentity: "Hamid",
      packageOptions: [
        "Presence Labs Local Trust Tune-Up",
        "Presence Labs Conversion Upgrade",
        "Presence Labs Launch Package",
      ],
      toneHint: "consultative, founder-to-founder",
    },
  );
  const auditDuration = Date.now() - auditStart;
  console.log(`  audit duration: ${auditDuration}ms`);
  console.log("");

  console.log("[3/3] Result");
  console.log("-".repeat(70));
  console.log(`source                : ${result.source}`);
  console.log(`vertical              : ${result.verticalKey} (${result.verticalDisplayName})`);
  if (result.fallbackReason) console.log(`fallbackReason        : ${result.fallbackReason}`);
  if (result.diagnostics) {
    console.log(`model                 : ${result.diagnostics.model}`);
    console.log(`input/output tokens   : ${result.diagnostics.inputTokens} / ${result.diagnostics.outputTokens}`);
    console.log(`estimated cost (USD)  : $${result.diagnostics.estimatedCostUsd.toFixed(4)}`);
    console.log(`call duration         : ${result.diagnostics.durationMs}ms`);
  }
  console.log("");
  console.log("EXECUTIVE SUMMARY");
  console.log(result.executiveSummary);
  console.log("");
  console.log("OPENING PITCH");
  console.log(result.openingPitch);
  console.log("");
  console.log(`FINDINGS (${result.findings.length})`);
  for (let i = 0; i < result.findings.length; i++) {
    console.log(`  ${i + 1}. ${result.findings[i]}`);
  }
  console.log("");
  console.log("CHECKS");
  for (const [k, v] of Object.entries(result.checks)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");
  console.log("ASSETS — recommendedPackage");
  console.log(`  ${result.assets.recommendedPackage}`);
  console.log("");
  console.log("ASSETS — likelyMoneyLost");
  console.log(`  ${result.assets.likelyMoneyLost}`);
  console.log("");
  console.log("ASSETS — coldCallScript");
  console.log(result.assets.coldCallScript);
  console.log("");
  console.log("ASSETS — emailScript");
  console.log(result.assets.emailScript);
  console.log("");
  console.log("ASSETS — proposalOutline");
  for (const [i, line] of result.assets.proposalOutline.entries()) {
    console.log(`  ${i + 1}. ${line}`);
  }
  console.log("-".repeat(70));
}

main().catch((err) => {
  console.error("smoke-test error:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
