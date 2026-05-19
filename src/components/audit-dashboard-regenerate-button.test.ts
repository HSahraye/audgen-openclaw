import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the discoverability bug reported on 2026-05-18:
// the operator spent 20 minutes hunting for a way to regenerate an
// audit. The "Regenerate (Claude-powered)" button existed only inside
// the `{selected ? (...)}` lead-detail panel — buried below the AI
// badge, the Offer & Pricing card, and the short-slug form. With 8+
// leads in the queue, the panel was off-screen.
//
// The fix added a per-row Regenerate button to every lead in the
// queue. These tests pin the contract so a future refactor cannot
// silently re-bury it.
//
// We use static source-code analysis here rather than a React render
// because the repo doesn't have jsdom + @testing-library/react
// installed (cf. account-indicator.test.tsx, audit-dashboard-utils
// .test.ts — same pattern). A real render test would catch a few more
// cases but at the cost of a new dep + jsdom config; static checks
// catch the field-and-discoverability issues that broke production.

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = readFileSync(
  path.resolve(REPO_ROOT, "src/components/audit-dashboard.tsx"),
  "utf8",
);

describe("dashboard per-row Regenerate (Claude) button", () => {
  it("renders inside the lead-queue map (not just the buried lead-detail panel)", () => {
    // The lead queue is `filteredLeads.map((lead) => ...)`; the buried
    // lead-detail panel is wrapped in `{selected ? (...)}`. Locate the
    // INDEX of each block and assert the per-row Regenerate button
    // appears BEFORE the `{selected ?` boundary, i.e. inside the row map.
    const leadMapIdx = SOURCE.indexOf("filteredLeads.map((lead)");
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    const regenerateButtonIdx = SOURCE.indexOf("Regenerate (Claude)");
    expect(leadMapIdx, "filteredLeads.map should be present").toBeGreaterThan(0);
    expect(selectedPanelIdx, "{selected ? ( panel should be present").toBeGreaterThan(0);
    expect(regenerateButtonIdx, "Regenerate (Claude) label should be present").toBeGreaterThan(0);
    expect(
      regenerateButtonIdx > leadMapIdx && regenerateButtonIdx < selectedPanelIdx,
      "Regenerate button must render inside the per-row map, BEFORE the `{selected ? ...}` lead-detail panel",
    ).toBe(true);
  });

  it("button click is wired to the existing regenerateLead handler (no new server action)", () => {
    // Find the per-row button and confirm the onClick targets
    // `regenerateLead(lead.id)` — the same handler the buried Lead
    // Notes button uses, which calls regenerateLeadAction → generateAudit
    // → generateLlmAudit (when ANTHROPIC_API_KEY is set).
    const regenerateLabelIdx = SOURCE.indexOf("Regenerate (Claude)");
    expect(regenerateLabelIdx, "label not found").toBeGreaterThan(0);
    // Look back ~1500 chars from the label to find the button definition.
    const buttonChunk = SOURCE.slice(Math.max(0, regenerateLabelIdx - 1500), regenerateLabelIdx + 200);
    expect(buttonChunk).toMatch(/onClick={\(event\) => {[\s\S]*?regenerateLead\(lead\.id\)/);
    // Stop event propagation so the click doesn't ALSO select the row.
    expect(buttonChunk).toMatch(/event\.stopPropagation\(\)/);
  });

  it("button is disabled while ANY regen is in flight (single-in-flight policy)", () => {
    // Prevents the user from double-clicking and being charged for two
    // LLM audits when the network round-trip is 60+ seconds. The
    // disabled gate is `isRegenerating || regeneratingLeadId !== null`
    // so the moment one row is clicked, ALL Regenerate buttons disable.
    const regenerateLabelIdx = SOURCE.indexOf("Regenerate (Claude)");
    const buttonChunk = SOURCE.slice(Math.max(0, regenerateLabelIdx - 1500), regenerateLabelIdx + 200);
    expect(buttonChunk).toMatch(/disabled={isRegenerating \|\| regeneratingLeadId !== null}/);
  });

  it("the active row shows a spinner; other rows keep the static label", () => {
    const buttonChunk = SOURCE.slice(
      Math.max(0, SOURCE.indexOf("Regenerate (Claude)") - 1500),
      SOURCE.indexOf("Regenerate (Claude)") + 400,
    );
    // Active row → spinner + "Regenerating…"
    expect(buttonChunk).toMatch(/regeneratingLeadId === lead\.id/);
    expect(buttonChunk).toMatch(/Loader2 className="size-4 animate-spin"/);
    expect(buttonChunk).toMatch(/Regenerating…/);
    // Inactive rows → Sparkles icon + label
    expect(buttonChunk).toMatch(/Sparkles className="size-4"/);
  });

  it("regenerateLead handler always clears the per-row spinner (even on throw) via try/finally", () => {
    // If the LLM call throws and we don't reset regeneratingLeadId,
    // the row stays stuck on "Regenerating…" until a page reload —
    // that's the exact failure mode the operator avoided when they
    // burned 20 minutes hunting for the button to begin with.
    const handlerIdx = SOURCE.indexOf("const regenerateLead =");
    expect(handlerIdx, "regenerateLead handler not found").toBeGreaterThan(0);
    const handlerChunk = SOURCE.slice(handlerIdx, handlerIdx + 1200);
    expect(handlerChunk).toMatch(/setRegeneratingLeadId\(id\)/);
    expect(handlerChunk).toMatch(/finally {/);
    expect(handlerChunk).toMatch(/setRegeneratingLeadId\(null\)/);
  });

  it("preserves the buried lead-detail panel button (regression: do not delete the existing surface)", () => {
    // The task explicitly said NOT to remove the buried button —
    // other UI surfaces or screen readers may rely on it. Pin its
    // continued existence inside the {selected ? (...)} block.
    const selectedPanelIdx = SOURCE.indexOf("{selected ? (");
    const generateAuditClaudePoweredIdx = SOURCE.indexOf("Generate audit (Claude-powered)");
    expect(generateAuditClaudePoweredIdx, "buried panel label should still be present").toBeGreaterThan(0);
    expect(
      generateAuditClaudePoweredIdx > selectedPanelIdx,
      "buried panel button must still live inside the lead-detail panel",
    ).toBe(true);
  });

  it("button reuses the same regenerateLeadAction (no new server action created)", () => {
    // Safety rule: do not introduce a new server action just to add
    // the per-row button. The chain regenerateLead → regenerateLeadAction
    // → generateAudit → generateLlmAudit must remain the only path.
    expect(SOURCE).toMatch(/import\s*\{[^}]*regenerateLeadAction[^}]*\}\s*from\s*"@\/app\/actions\/leads"/);
    // Exactly one definition of `const regenerateLead =` in the file
    // (otherwise we'd have a forked handler).
    const matches = SOURCE.match(/const\s+regenerateLead\s*=/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("aria-label on the per-row button names the business and the action", () => {
    // Accessibility — the row has many similar-shape buttons; the
    // aria-label must distinguish "Regenerate audit for {business}"
    // from "Delete {business}" for screen-reader users.
    const buttonChunk = SOURCE.slice(
      Math.max(0, SOURCE.indexOf("Regenerate (Claude)") - 1500),
      SOURCE.indexOf("Regenerate (Claude)") + 200,
    );
    expect(buttonChunk).toMatch(/aria-label=/);
    expect(buttonChunk).toMatch(/Regenerate audit \(Claude-powered\) for \$\{lead\.businessName\}/);
  });
});
