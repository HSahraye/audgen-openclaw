import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Tests for the consolidated per-row action button cluster introduced
// 2026-05-19. Four logical states:
//
//   (a) No AI audit yet, not pending   → "Generate Audit ✨"  (no ↻ icon)
//   (b) Audit exists, not pending      → "Open Audit"  +  ↻ icon visible
//   (c) Audit pending / BG regen active → "Generating…" spinner  (disabled)
//   (d) Outreach dropdown              → "Outreach ▾" opens Email/SMS/WhatsApp
//
// Static source analysis (same pattern as audit-dashboard-regenerate-button
// .test.ts and account-indicator.test.tsx) — no jsdom/RTLU needed.

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = readFileSync(
  path.resolve(REPO_ROOT, "src/components/audit-dashboard.tsx"),
  "utf8",
);

describe("per-row action buttons — four layout states", () => {
  it("row with NO audit shows 'Generate Audit ✨'; ↻ icon is guarded by aiGenerated", () => {
    // The smart primary button IIFE starts with `const isThisRowPending = ...`.
    // All three branches (Generating…, Open Audit, Generate Audit) must be within ~3000 chars.
    const iife = SOURCE.indexOf("isThisRowPending");
    expect(iife).toBeGreaterThan(0);
    const block = SOURCE.slice(iife, iife + 3000);

    // "Generate Audit ✨" appears in the else branch
    expect(block).toMatch(/Generate Audit/);
    // "Open Audit" appears in the aiGenerated branch
    expect(block).toMatch(/Open Audit/);

    // ↻ icon is wrapped in {lead.audit.aiGenerated ? (...) : null}.
    // Use lastIndexOf to find the guard that immediately precedes the icon.
    const regenIconIdx2 = SOURCE.indexOf("row-regenerate-icon");
    expect(regenIconIdx2).toBeGreaterThan(0);
    const lastGuardIdx = SOURCE.lastIndexOf("lead.audit.aiGenerated", regenIconIdx2);
    expect(lastGuardIdx, "lead.audit.aiGenerated guard should precede the ↻ icon").toBeGreaterThan(0);
    // The guard should be within 800 chars before the data-testid (button has long className)
    expect(regenIconIdx2 - lastGuardIdx).toBeLessThan(800);
  });

  it("row WITH an AI audit shows 'Open Audit' and ↻ icon; click opens audit in new tab", () => {
    // Anchor on window.open(auditUrl — the Open Audit button's onClick handler.
    // (Don't anchor on "Open Audit" text alone — it also appears in a nearby comment.)
    const openAuditClickIdx = SOURCE.indexOf("window.open(auditUrl(lead)");
    expect(openAuditClickIdx, "window.open(auditUrl(lead)) should be present").toBeGreaterThan(0);
    // "Open Audit" (button text) appears ~300 chars AFTER window.open; use +500 window.
    const chunk = SOURCE.slice(Math.max(0, openAuditClickIdx - 200), openAuditClickIdx + 500);
    expect(chunk).toMatch(/window\.open\(auditUrl\(lead\),\s*"_blank"\)/);
    expect(chunk).toMatch(/Open Audit/);

    // ↻ icon is present in per-row map, guarded by lead.audit.aiGenerated
    const regenIconIdx = SOURCE.indexOf("row-regenerate-icon");
    expect(regenIconIdx).toBeGreaterThan(0);
    const guardIdx = SOURCE.lastIndexOf("lead.audit.aiGenerated", regenIconIdx);
    expect(guardIdx, "lead.audit.aiGenerated guard should precede the ↻ icon").toBeGreaterThan(0);
    expect(regenIconIdx - guardIdx).toBeLessThan(800);
  });

  it("row with pending audit shows 'Generating…' (spinner), button is disabled", () => {
    const iife = SOURCE.indexOf("isThisRowPending");
    const block = SOURCE.slice(iife, iife + 800);
    // disabled attribute present
    expect(block).toMatch(/disabled/);
    // spinner icon + label
    expect(block).toMatch(/Loader2 className="size-4 animate-spin"/);
    expect(block).toMatch(/Generating…/);
    // isThisRowPending is derived from audit.pending and regeneratingLeadId
    const derivationChunk = SOURCE.slice(iife, iife + 200);
    expect(derivationChunk).toMatch(/lead\.audit\.pending\s*===\s*true/);
    expect(derivationChunk).toMatch(/regeneratingLeadId\s*===\s*lead\.id/);
  });

  it("Outreach dropdown button opens a menu with Email, SMS, and WhatsApp options", () => {
    // The toggle is driven by openOutreachLeadId state
    expect(SOURCE).toMatch(/openOutreachLeadId/);
    // Button label + ChevronDown icon
    const outreachBtnIdx = SOURCE.indexOf("row-outreach-btn");
    expect(outreachBtnIdx).toBeGreaterThan(0);
    const btnChunk = SOURCE.slice(Math.max(0, outreachBtnIdx - 200), outreachBtnIdx + 100);
    expect(btnChunk).toMatch(/Outreach/);
    expect(btnChunk).toMatch(/ChevronDown/);
    // Menu items — 1500-char window to cover all three items (including WhatsApp last)
    const menuIdx = SOURCE.indexOf("row-outreach-menu");
    expect(menuIdx).toBeGreaterThan(0);
    const menuChunk = SOURCE.slice(menuIdx, menuIdx + 1500);
    expect(menuChunk).toMatch(/emailDraftUrl/);
    expect(menuChunk).toMatch(/smsDraftUrl/);
    expect(menuChunk).toMatch(/whatsappDraftUrl/);
    expect(menuChunk).toMatch(/Email/);
    expect(menuChunk).toMatch(/SMS/);
    expect(menuChunk).toMatch(/WhatsApp/);
  });

  it("'Internal prep' and 'Website' and 'Delete' buttons are preserved in the per-row cluster", () => {
    const leadMapIdx = SOURCE.indexOf("filteredLeads.map((lead)");
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");

    // Internal prep
    const prepIdx = SOURCE.indexOf("Internal prep");
    expect(prepIdx).toBeGreaterThan(0);
    expect(prepIdx > leadMapIdx && prepIdx < selectedPanelIdx).toBe(true);

    // Website link
    const websiteIdx = SOURCE.slice(leadMapIdx, selectedPanelIdx).indexOf("Website");
    expect(websiteIdx).toBeGreaterThan(0);

    // Delete button
    const deleteIdx = SOURCE.slice(leadMapIdx, selectedPanelIdx).indexOf("Delete");
    expect(deleteIdx).toBeGreaterThan(0);
  });

  it("the two identical-looking 'Copy link' buttons are gone from the per-row cluster", () => {
    const leadMapIdx = SOURCE.indexOf("filteredLeads.map((lead)");
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    const perRowBlock = SOURCE.slice(leadMapIdx, selectedPanelIdx);

    // "Copy public audit link" should NOT appear in the per-row cluster
    expect(perRowBlock).not.toContain("Copy public audit link");
    // "Copy internal prep link" should NOT appear in the per-row cluster
    expect(perRowBlock).not.toContain("Copy internal prep link");
  });
});
