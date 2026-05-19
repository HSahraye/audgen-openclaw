import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the renderer-split bug observed on 2026-05-19
// PT: the LLM audit engine produced excellent vertical-specific
// content (Daikin 3E mentions, San Jose specifics, structured 6-step
// proposal outline), the prep page rendered it correctly, but the
// public audit page kept rendering legacy templated copy ("Trust
// score: 100/100", "Page payload appears heavy", "Conversion
// blockers: Clarify CTA and contact pathway") on the SAME database
// record. Two views, two read paths, only one wired to the LLM
// fields.
//
// Plus a pricing-disagreement bug: prep page showed the LLM's
// $736 recommendation; public audit page showed $1,500 from the
// bucket-based estimatedDealValue lookup. Same lead, two prices.
//
// Plus the "AI-generated · {vertical} vertical" badge was missing
// from both pages.
//
// All four problems are pinned by static source-code analysis here.
// We avoid full React renders because the repo doesn't have jsdom +
// @testing-library/react installed (cf. account-indicator.test.tsx,
// audit-dashboard-utils.test.ts — same pattern). The conditional
// render branches + LLM-field reads + AI badge can be verified just
// from the source.

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(path.resolve(REPO_ROOT, rel), "utf8");
}

const AUDIT_PAGE = read("src/app/audit/[id]/page.tsx");
const PREP_PAGE = read("src/app/prep/[id]/page.tsx");
const ENGINE_LLM = read("src/lib/audit/llm-audit-engine.ts");
const ENGINE_AUDIT = read("src/lib/audit-engine.ts");
const TYPES = read("src/lib/types.ts");
const BRANDING = read("src/lib/branding.ts");
const CONFIG_BRANDING = read("src/config/branding.ts");

describe("public audit page — LLM-field rendering", () => {
  it("derives `isLlmAudit` from `audit.source === \"claude\"` OR `audit.aiGenerated === true`", () => {
    // Either signal must trigger the LLM-driven branch. The BG
    // function writes both; older sync writes set only `source`.
    expect(AUDIT_PAGE).toMatch(/const isLlmAudit\s*=\s*audit\.source === "claude" \|\| audit\.aiGenerated === true/);
  });

  it("renders the LLM-driven sections block when isLlmAudit is true", () => {
    // Conditional must EXIST and render an "AI-generated audit
    // findings" header that wraps the LLM content.
    expect(AUDIT_PAGE).toMatch(/\{isLlmAudit \?[\s\S]*?AI-generated audit findings/);
  });

  it("LLM branch reads findings from `audit.warnings` (executiveSummary + 5-8 findings unshifted by audit-engine.ts)", () => {
    expect(AUDIT_PAGE).toMatch(/llmExecutiveSummary\s*=\s*isLlmAudit && audit\.warnings\.length > 0\s*\?\s*audit\.warnings\[0\]/);
    expect(AUDIT_PAGE).toMatch(/llmFindings\s*=[\s\S]*?audit\.warnings[\s\S]*?\.slice\(1\)/);
  });

  it("LLM branch DOES NOT show templated `getLeadScores` copy ('Trust score: X/100' etc.)", () => {
    // Locate the boundaries of the LLM branch and the legacy branch.
    // The LLM branch sits inside `{isLlmAudit ? (...)` and ends at
    // the matching `) : (`.
    const llmBranchStart = AUDIT_PAGE.indexOf("{isLlmAudit ? (");
    const legacyBranchStart = AUDIT_PAGE.indexOf(") : (", llmBranchStart);
    expect(llmBranchStart, "LLM branch start not found").toBeGreaterThan(0);
    expect(legacyBranchStart, "legacy branch start not found").toBeGreaterThan(llmBranchStart);
    const llmBranchSlice = AUDIT_PAGE.slice(llmBranchStart, legacyBranchStart);
    // None of these templated phrases may appear inside the LLM
    // branch — they're the exact copy the operator complained about.
    expect(llmBranchSlice).not.toMatch(/Trust score:\s*\{?scores\.trust\}?\/100/);
    expect(llmBranchSlice).not.toMatch(/Conversion score:/);
    expect(llmBranchSlice).not.toMatch(/SEO score:/);
    expect(llmBranchSlice).not.toMatch(/Page payload appears heavy/);
  });

  it("renders the AI-generated badge in the header when isLlmAudit", () => {
    // The badge must reference verticalDisplayName so the operator
    // sees the right vertical (HVAC / Dental / Roofing / etc.).
    expect(AUDIT_PAGE).toMatch(/\{isLlmAudit \?[\s\S]*?AI-generated\{verticalDisplayName \? \` · \$\{verticalDisplayName\} vertical\`/);
  });

  it("uses LLM `llmRecommendedPrice` when present, falling back to bucket-based `estimatedDealValue`", () => {
    expect(AUDIT_PAGE).toMatch(/const llmRecommendedPrice\s*=\s*generationContext\?\.providerMetadata\?\.llmRecommendedPrice/);
    expect(AUDIT_PAGE).toMatch(/isLlmAudit && typeof llmRecommendedPrice === "number" && llmRecommendedPrice > 0[\s\S]*?\?\s*llmRecommendedPrice[\s\S]*?:\s*estimatedDealValue\(selectedPackage, lead\.customPrice\)/);
  });

  it("LEGACY templated branch is preserved verbatim for the no-LLM path", () => {
    // The other half of `{isLlmAudit ? (...) : (...)}` must keep the
    // legacy "Structured Intelligence Sections" copy. We don't want
    // to silently delete the templated path for workspaces that
    // haven't enabled the LLM engine.
    const legacyBranchStart = AUDIT_PAGE.indexOf(") : (");
    expect(legacyBranchStart).toBeGreaterThan(0);
    const legacyBranchSlice = AUDIT_PAGE.slice(legacyBranchStart);
    expect(legacyBranchSlice).toMatch(/Structured Intelligence Sections/);
    expect(legacyBranchSlice).toMatch(/sectionPlan\.includes\("trustIssues"\)/);
    expect(legacyBranchSlice).toMatch(/Trust score:\s*\{scores\.trust\}/);
  });
});

describe("prep page — LLM-field rendering", () => {
  it("derives the same `isLlmAudit` signal as the public audit page", () => {
    expect(PREP_PAGE).toMatch(/const isLlmAudit\s*=\s*audit\.source === "claude" \|\| audit\.aiGenerated === true/);
  });

  it("loads `generatedContextJson` so the LLM pricing recommendation is available", () => {
    expect(PREP_PAGE).toMatch(/lead\.generatedContextJson/);
    expect(PREP_PAGE).toMatch(/providerMetadata\?\.llmRecommendedPrice/);
  });

  it("uses the LLM price for the deal-snapshot card when present", () => {
    expect(PREP_PAGE).toMatch(/const price\s*=[\s\S]*?isLlmAudit && typeof llmRecommendedPrice === "number" && llmRecommendedPrice > 0[\s\S]*?\?\s*llmRecommendedPrice[\s\S]*?:\s*estimatedDealValue\(lead\.packageName, lead\.customPrice\)/);
  });

  it("renders the AI-generated badge in the header when isLlmAudit", () => {
    expect(PREP_PAGE).toMatch(/\{isLlmAudit \?[\s\S]*?AI-generated/);
  });
});

describe("LLM engine — propagates `recommendedPrice` so renderers can show it", () => {
  it("LlmAuditPayload type has the optional `recommendedPrice` field", () => {
    expect(ENGINE_LLM).toMatch(/recommendedPrice\?:\s*number/);
  });

  it("success path sets `recommendedPrice: parsed.packagePrice`", () => {
    // The Zod schema validates parsed.packagePrice as a positive
    // integer; this just propagates it onto the payload.
    expect(ENGINE_LLM).toMatch(/recommendedPrice:\s*parsed\.packagePrice/);
  });

  it("audit-engine.ts copies `llmRecommendedPrice` into providerMetadata when source=llm", () => {
    expect(ENGINE_AUDIT).toMatch(/llmRecommendedPrice:[\s\S]*?llmPayload\?\.source === "llm"[\s\S]*?llmPayload\.recommendedPrice/);
  });

  it("GenerationContextSnapshot.providerMetadata declares `llmRecommendedPrice`", () => {
    expect(TYPES).toMatch(/llmRecommendedPrice\?:\s*number/);
  });
});

describe("brand cleanup — fallback says 'AuditGen', not 'Presence Labs'", () => {
  it("`resolvePublicSenderName` falls back to 'AuditGen'", () => {
    expect(BRANDING).toMatch(/DEFAULT_PUBLIC_BRAND\s*=\s*"AuditGen"/);
    // The function body must reference the constant and NOT have a
    // hardcoded "Presence Labs" fallback string.
    expect(BRANDING).not.toMatch(/return\s*"Presence Labs"/);
  });

  it("`sanitizePublicBrandCopy` substitutes 'default workspace' → 'AuditGen'", () => {
    expect(BRANDING).toMatch(/\.replace\(\/\\bdefault workspace\\b\/gi,\s*DEFAULT_PUBLIC_BRAND\)/);
  });

  it("BRANDING_CONFIG.companyName + legalEntity now use 'AuditGen'", () => {
    expect(CONFIG_BRANDING).toMatch(/companyName:\s*"AuditGen"/);
    expect(CONFIG_BRANDING).toMatch(/legalEntity:\s*"AuditGen, LLC"/);
    expect(CONFIG_BRANDING).not.toMatch(/companyName:\s*"Presence Labs"/);
    expect(CONFIG_BRANDING).not.toMatch(/legalEntity:\s*"Presence Labs/);
  });
});
