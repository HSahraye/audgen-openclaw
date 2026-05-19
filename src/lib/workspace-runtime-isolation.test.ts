import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the production crash on 2026-05-19 ~12:43 PT:
//
//   ERR_MODULE_NOT_FOUND: Cannot find module 'next/headers' imported
//   from /var/task/netlify/functions/llm-audit-generate-background.mjs
//
// Standalone Netlify Functions do NOT include the Next.js runtime in
// their Lambda bundle. Any transitive import of `next/*` modules
// crashes the function at module-load time, BEFORE the handler body
// runs. Symptom: function invocations exit in ~80ms with no handler
// logs, leaving any "Regenerate (Claude)" click stuck in pending
// state forever (the dashboard polling loop has no way to know the
// function never started).
//
// The bug fix moved the pure scope helpers into `@/lib/workspace-scope`
// (zero next/* imports). These tests pin the contract so a future
// refactor cannot silently re-introduce a Next.js dependency anywhere
// in the BG function's transitive import graph.

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(path.resolve(REPO_ROOT, relPath), "utf8");
}

const NEXT_IMPORT_PATTERN = /from\s+["']next\/(headers|cookies|navigation|server)["']/;

describe("workspace-scope — pure module hygiene", () => {
  it("`@/lib/workspace-scope` contains zero Next.js imports (it is the runtime-agnostic surface)", () => {
    const source = read("src/lib/workspace-scope.ts");
    expect(source.match(NEXT_IMPORT_PATTERN)).toBeNull();
  });

  it("exports both `strictWorkspaceScope` and `withWorkspaceFallbackScope`", () => {
    const source = read("src/lib/workspace-scope.ts");
    expect(source).toMatch(/export function strictWorkspaceScope\(/);
    expect(source).toMatch(/export function withWorkspaceFallbackScope\(/);
  });

  it("`@/lib/workspace` re-exports the pure helpers (so existing call sites keep compiling)", () => {
    const source = read("src/lib/workspace.ts");
    expect(source).toMatch(/export\s*\{\s*strictWorkspaceScope,\s*withWorkspaceFallbackScope\s*\}\s*from\s*["']@\/lib\/workspace-scope["']/);
  });

  it("`@/lib/workspace` does NOT keep its own duplicate definition of strictWorkspaceScope (regression: would defeat the runtime-isolation fix)", () => {
    const source = read("src/lib/workspace.ts");
    // Re-export is fine; an `export function strictWorkspaceScope(` definition
    // is NOT — it would mean the helper still lives in the next-poisoned
    // module and importers of @/lib/workspace would still pull next/headers.
    expect(source).not.toMatch(/export function strictWorkspaceScope\(/);
    expect(source).not.toMatch(/export function withWorkspaceFallbackScope\(/);
  });
});

describe("Background Function — runtime isolation", () => {
  const BG_FUNCTION_PATH = "netlify/functions/llm-audit-generate-background.mts";

  it("the BG function file exists at the canonical path", () => {
    expect(existsSync(path.resolve(REPO_ROOT, BG_FUNCTION_PATH))).toBe(true);
  });

  it("the BG function does NOT import any next/* module directly", () => {
    const source = read(BG_FUNCTION_PATH);
    expect(source.match(NEXT_IMPORT_PATTERN)).toBeNull();
  });

  it("the BG function does NOT import from `@/lib/workspace` (the next-poisoned barrel)", () => {
    const source = read(BG_FUNCTION_PATH);
    // We allow `@/lib/workspace-scope` (the pure module) but forbid
    // the legacy `@/lib/workspace` import. Same regex but the trailing
    // boundary forbids `-` before the closing quote.
    expect(source).not.toMatch(/from\s+["']@\/lib\/workspace["']/);
  });

  it("the BG function imports `strictWorkspaceScope` from the pure scope module", () => {
    const source = read(BG_FUNCTION_PATH);
    expect(source).toMatch(/from\s+["']@\/lib\/workspace-scope["']/);
    expect(source).toMatch(/strictWorkspaceScope/);
  });

  it("the BG function logs a `bg_module_loaded` boot-time sentinel before the handler", () => {
    // Without this, a future regression that breaks module-load
    // produces zero log output (Netlify won't surface
    // ERR_MODULE_NOT_FOUND in the function log stream cleanly), so
    // diagnosis takes hours. The sentinel proves at-a-glance that
    // module-load succeeded.
    const source = read(BG_FUNCTION_PATH);
    expect(source).toMatch(/bg_module_loaded/);
    // The sentinel must run BEFORE the export default handler, so it
    // fires during module init, not on the first request.
    const sentinelIdx = source.indexOf("bg_module_loaded");
    const handlerIdx = source.indexOf("export default");
    expect(sentinelIdx).toBeGreaterThan(0);
    expect(handlerIdx).toBeGreaterThan(0);
    expect(sentinelIdx).toBeLessThan(handlerIdx);
  });
});

describe("BG function transitive chain — no next/* reachable through audit-engine", () => {
  // The BG function imports `generateAudit` from `@/lib/audit-engine`,
  // which transitively pulls in:
  //   - billing/entitlements      (sync DB writes; pure)
  //   - intelligence/engine       (LLM intelligence; pure)
  //   - generation/context        (template loader)
  //   - branding                  (resolver; pure)
  //   - audit/llm-audit-engine    (Anthropic SDK; pure)
  //   - audit/scrape-website      (fetch; pure)
  //   - audit/audit-async         (HMAC; pure)
  //   - logger                    (console + redact; pure)
  //
  // The dangerous file historically was `templates/resolver.ts`
  // (loaded by generation/context), which used to import from
  // `@/lib/workspace`. We rerouted it to `@/lib/workspace-scope`.
  // This test pins that.

  it("`@/lib/templates/resolver` imports `strictWorkspaceScope` from the pure module, not `@/lib/workspace`", () => {
    const source = read("src/lib/templates/resolver.ts");
    expect(source).toMatch(/from\s+["']@\/lib\/workspace-scope["']/);
    // Same defensive negative-match: forbid the next-poisoned barrel.
    expect(source).not.toMatch(/from\s+["']@\/lib\/workspace["']/);
  });

  it("none of the other top-level files in the audit-engine chain import next/* directly", () => {
    // Spot-check the modules generateAudit pulls in. A regression
    // that adds `import { cookies } from "next/headers"` to any of
    // these would break the BG function the same way as the
    // workspace.ts bug did.
    const filesToCheck = [
      "src/lib/audit-engine.ts",
      "src/lib/audit/llm-audit-engine.ts",
      "src/lib/audit/scrape-website.ts",
      "src/lib/audit/audit-async.ts",
      "src/lib/audit/audit-system-prompt.ts",
      "src/lib/audit/verticals.ts",
      "src/lib/billing/entitlements/index.ts",
      "src/lib/intelligence/engine.ts",
      "src/lib/generation/context.ts",
      "src/lib/templates/resolver.ts",
      "src/lib/templates/index.ts",
      "src/lib/branding.ts",
      "src/lib/logger.ts",
      "src/lib/prisma.ts",
    ];
    const violations: Array<{ file: string; line: string }> = [];
    for (const rel of filesToCheck) {
      const fullPath = path.resolve(REPO_ROOT, rel);
      if (!existsSync(fullPath)) continue;
      const source = readFileSync(fullPath, "utf8");
      const match = source.match(NEXT_IMPORT_PATTERN);
      if (match) {
        violations.push({ file: rel, line: match[0] });
      }
    }
    expect(
      violations,
      `Files in the BG function's transitive chain must not import next/*:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
});
