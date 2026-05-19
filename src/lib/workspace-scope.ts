// PURE workspace-scope helpers. ZERO Next.js / runtime-specific imports.
//
// Why this file exists:
//
// `src/lib/workspace.ts` imports `cookies` from `next/headers` at
// module scope (it's needed by `getWorkspaceContextForUser` for the
// session-aware workspace lookup). Any module that imports from
// `@/lib/workspace` therefore pulls in the Next.js runtime — fine
// inside the Next.js server handler, broken inside a standalone
// Netlify Background Function bundle:
//
//   ERR_MODULE_NOT_FOUND: Cannot find module 'next/headers'
//
// Concrete repro: on 2026-05-19 ~12:43 PT, the
// `llm-audit-generate-background` function crashed at module-load
// because it imports `strictWorkspaceScope` from `@/lib/workspace`.
// The handler body never ran; every "Regenerate (Claude)" click
// stuck the lead in pending state forever.
//
// Fix shape: keep `strictWorkspaceScope` and
// `withWorkspaceFallbackScope` here as pure functions, and have
// `@/lib/workspace` re-export them for backward compatibility with
// callers that already pull in next/headers anyway (server actions,
// page components, route handlers). Files that need to be runtime-
// agnostic — Background Functions, Edge Functions, standalone
// scripts — should import directly from `@/lib/workspace-scope`.

/**
 * SECURITY NOTE.
 *
 * Historically `withWorkspaceFallbackScope` returned
 * `OR: [{ workspaceId }, { workspaceId: null }]` so legacy rows that
 * pre-dated the multi-tenant migration would still surface in the
 * UI. That is a cross-tenant data-leak hazard once a real tenant
 * exists with orphan rows in the table.
 *
 * We now scope strictly to the caller's workspaceId by default. The
 * legacy orphan-row inclusion can be re-enabled explicitly via the
 * env flag `ALLOW_WORKSPACE_NULL_FALLBACK=true` to ease backfill,
 * but it should be disabled in production.
 *
 * The companion helper `strictWorkspaceScope` is preferred in new
 * code — see commit b8a3975 for the multi-surface cross-tenant leak
 * post-mortem and the strict-scoping invariants test
 * (`src/lib/workspace-scope-invariants.test.ts`).
 */
export function withWorkspaceFallbackScope(workspaceId: string) {
  if (process.env.ALLOW_WORKSPACE_NULL_FALLBACK === "true") {
    return { OR: [{ workspaceId }, { workspaceId: null }] };
  }
  return { workspaceId };
}

/** Always-strict workspace scope. Use this in new code. */
export function strictWorkspaceScope(workspaceId: string) {
  return { workspaceId };
}
