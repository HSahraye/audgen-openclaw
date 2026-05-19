import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD — Updated 2026-05-19 when the per-row button cluster
// was consolidated from 10+ buttons to 7 actions:
//
//   [Status] · [Internal prep] · [Open Audit / Generate Audit ✨] · [↻ icon]
//   · [Outreach ▾] · [Website] · [Delete]
//
// The "Regenerate (Claude)" per-row label was replaced by:
//   - A smart primary button: "Generate Audit ✨" (no audit) / "Open Audit" (audit exists)
//   - A secondary ↻ icon button (aria-label "Regenerate audit for …") visible only when
//     an audit exists.
//
// Original context: the operator spent 20 minutes hunting for a way to
// regenerate an audit because the only button was inside the buried
// lead-detail panel. The per-row button added in the previous fix
// (commit pinned by these tests) is preserved — now as a cleaner ↻ icon.
//
// Static source analysis is used throughout (see account-indicator.test.tsx,
// audit-dashboard-utils.test.ts for the same pattern) since the repo does
// not have jsdom/@testing-library/react set up.

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = readFileSync(
  path.resolve(REPO_ROOT, "src/components/audit-dashboard.tsx"),
  "utf8",
);

describe("dashboard per-row action buttons — consolidated button cluster", () => {
  it("renders inside the lead-queue map (not just the buried lead-detail panel)", () => {
    // The lead queue is `filteredLeads.map((lead) => ...)`; the buried
    // lead-detail panel is wrapped in `{selected ? (`. Locate the INDEX of
    // each block and assert the per-row Generate Audit / Open Audit / ↻
    // buttons all appear BEFORE the `{selected ?` boundary.
    const leadMapIdx = SOURCE.indexOf("filteredLeads.map((lead)");
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    expect(leadMapIdx, "filteredLeads.map should be present").toBeGreaterThan(0);
    expect(selectedPanelIdx, "{selected ? ( panel should be present").toBeGreaterThan(0);

    // "Generate Audit" (primary button when no audit exists)
    const generateAuditIdx = SOURCE.indexOf("Generate Audit");
    expect(generateAuditIdx, '"Generate Audit" label should be present').toBeGreaterThan(0);
    expect(
      generateAuditIdx > leadMapIdx && generateAuditIdx < selectedPanelIdx,
      "Generate Audit button must render inside the per-row map, BEFORE {selected ? ...}",
    ).toBe(true);

    // "Open Audit" (primary button when audit exists)
    const openAuditIdx = SOURCE.indexOf("Open Audit");
    expect(openAuditIdx, '"Open Audit" label should be present').toBeGreaterThan(0);
    expect(
      openAuditIdx > leadMapIdx && openAuditIdx < selectedPanelIdx,
      "Open Audit button must render inside the per-row map, BEFORE {selected ? ...}",
    ).toBe(true);

    // ↻ icon button via data-testid
    const rowRegenIdx = SOURCE.indexOf("row-regenerate-icon");
    expect(rowRegenIdx, 'data-testid="row-regenerate-icon" should be present').toBeGreaterThan(0);
    expect(
      rowRegenIdx > leadMapIdx && rowRegenIdx < selectedPanelIdx,
      "↻ icon button must render inside the per-row map, BEFORE {selected ? ...}",
    ).toBe(true);
  });

  it("↻ icon button and Generate Audit button are wired to the existing regenerateLead handler", () => {
    // Both the ↻ icon and the "Generate Audit" button must call regenerateLead(lead.id).
    // Locate data-testid="row-regenerate-icon" and look nearby for the onClick.
    const regenIconIdx = SOURCE.indexOf("row-regenerate-icon");
    expect(regenIconIdx, "row-regenerate-icon not found").toBeGreaterThan(0);
    const iconChunk = SOURCE.slice(Math.max(0, regenIconIdx - 600), regenIconIdx + 200);
    expect(iconChunk).toMatch(/onClick={\(event\) => {[\s\S]*?regenerateLead\(lead\.id\)/);
    expect(iconChunk).toMatch(/event\.stopPropagation\(\)/);

    // Generate Audit button also calls regenerateLead(lead.id).
    // Anchor on the Sparkles icon + text (button body, not the nearby comment).
    const generateAuditBtnIdx = SOURCE.indexOf('<Sparkles className="size-4" /> Generate Audit');
    expect(generateAuditBtnIdx, "Generate Audit ✨ button text should be present").toBeGreaterThan(0);
    const generateChunk = SOURCE.slice(Math.max(0, generateAuditBtnIdx - 800), generateAuditBtnIdx + 200);
    expect(generateChunk).toMatch(/regenerateLead\(lead\.id\)/);
  });

  it("↻ icon button is disabled while ANY regen is in flight (single-in-flight policy)", () => {
    // The ↻ icon preserves the three-part disabled gate:
    //   1. isRegenerating   (server action in flight)
    //   2. regeneratingLeadId !== null   (any row queued — full policy)
    //   3. lead.audit.pending === true   (BG Function still running)
    const regenIconIdx = SOURCE.indexOf("row-regenerate-icon");
    const iconChunk = SOURCE.slice(Math.max(0, regenIconIdx - 800), regenIconIdx + 100);
    expect(iconChunk).toMatch(/disabled=\{[\s\S]*?isRegenerating[\s\S]*?\}/);
    expect(iconChunk).toMatch(/regeneratingLeadId !== null/);
    expect(iconChunk).toMatch(/lead\.audit\.pending\s*===\s*true/);
  });

  it("primary button shows 'Generating…' when the row is pending, 'Open Audit' when ai-generated, 'Generate Audit ✨' otherwise", () => {
    // Find the IIFE that drives the smart primary button.
    const isThisRowPendingIdx = SOURCE.indexOf("isThisRowPending");
    expect(isThisRowPendingIdx, "isThisRowPending should be present").toBeGreaterThan(0);
    const buttonBlock = SOURCE.slice(isThisRowPendingIdx, isThisRowPendingIdx + 2500);
    // Pending state
    expect(buttonBlock).toMatch(/Generating…/);
    expect(buttonBlock).toMatch(/Loader2 className="size-4 animate-spin"/);
    // Audit exists
    expect(buttonBlock).toMatch(/Open Audit/);
    expect(buttonBlock).toMatch(/window\.open\(auditUrl\(lead\)/);
    // No audit
    expect(buttonBlock).toMatch(/Generate Audit/);
    expect(buttonBlock).toMatch(/Sparkles className="size-4"/);
  });

  it("regenerateLead handler always clears the per-row spinner via try/finally", () => {
    const handlerIdx = SOURCE.indexOf("const regenerateLead =");
    expect(handlerIdx, "regenerateLead handler not found").toBeGreaterThan(0);
    const handlerChunk = SOURCE.slice(handlerIdx, handlerIdx + 1200);
    expect(handlerChunk).toMatch(/setRegeneratingLeadId\(id\)/);
    expect(handlerChunk).toMatch(/finally {/);
    expect(handlerChunk).toMatch(/setRegeneratingLeadId\(null\)/);
  });

  it("preserves the buried lead-detail panel regenerate button (regression: do not delete the existing surface)", () => {
    // The lead-detail panel (buried below the fold) still has its own
    // Regenerate button so users who have the panel open don't lose that surface.
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    const generateAuditClaudePoweredIdx = SOURCE.indexOf("Generate audit (Claude-powered)");
    expect(generateAuditClaudePoweredIdx, "buried panel label should still be present").toBeGreaterThan(0);
    expect(
      generateAuditClaudePoweredIdx > selectedPanelIdx,
      "buried panel button must still live inside the lead-detail panel",
    ).toBe(true);
  });

  it("button reuses the same regenerateLeadAction (no new server action created)", () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*regenerateLeadAction[^}]*\}\s*from\s*"@\/app\/actions\/leads"/);
    // Exactly one definition of `const regenerateLead =` in the file
    const matches = SOURCE.match(/const\s+regenerateLead\s*=/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("↻ icon button has an aria-label naming the business and the action (accessibility)", () => {
    const regenIconIdx = SOURCE.indexOf("row-regenerate-icon");
    const iconChunk = SOURCE.slice(Math.max(0, regenIconIdx - 800), regenIconIdx + 100);
    expect(iconChunk).toMatch(/aria-label=/);
    expect(iconChunk).toMatch(/Regenerate audit for \$\{lead\.businessName\}/);
  });

  it("the Outreach dropdown is present in the per-row map and contains Email, SMS, WhatsApp menu items", () => {
    const leadMapIdx = SOURCE.indexOf("filteredLeads.map((lead)");
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    const outreachBtnIdx = SOURCE.indexOf("row-outreach-btn");
    expect(outreachBtnIdx, 'data-testid="row-outreach-btn" should be present').toBeGreaterThan(0);
    expect(
      outreachBtnIdx > leadMapIdx && outreachBtnIdx < selectedPanelIdx,
      "Outreach button must be inside the per-row map",
    ).toBe(true);
    // The dropdown menu contains all three outreach options
    const menuIdx = SOURCE.indexOf("row-outreach-menu");
    expect(menuIdx, 'data-testid="row-outreach-menu" should be present').toBeGreaterThan(0);
    const menuChunk = SOURCE.slice(menuIdx, menuIdx + 1500);
    expect(menuChunk).toMatch(/Email/);
    expect(menuChunk).toMatch(/SMS/);
    expect(menuChunk).toMatch(/WhatsApp/);
  });
});
