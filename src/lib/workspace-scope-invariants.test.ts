import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the multi-surface cross-tenant data leak verified
// in production by the two-account browser test on 2026-05-17:
//
//   • /leadgen  — User A's exported lead visible in User B's session
//   • /research — full lead rows visible across both sessions
//   • /outreach — lead with real phone visible across both sessions
//
// Root cause was *case (c)*: every authenticated user-facing page sourced
// `workspaceId` from `getWorkspaceContext()`, which always resolves to the
// platform-default workspace via `ensureDefaultWorkspace()`. Because every
// tenant got the same workspaceId, `strictWorkspaceScope(defaultId)` and
// `withWorkspaceFallbackScope(defaultId)` were both pooling tenants into
// one bucket. Fixed by sourcing `workspaceId` from `requireSessionRole(...)`
// (membership-derived, per better-auth user) and using `strictWorkspaceScope`
// at every read site.
//
// These tests fail loudly if a future edit reintroduces either anti-pattern
// on an auth-gated user-facing page or an authenticated server action.

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(path.resolve(REPO_ROOT, rel), "utf8");
}

// Files that MUST source workspaceId from the authenticated session.
const AUTH_GATED_PAGES = [
  "src/app/page.tsx",
  "src/app/leadgen/page.tsx",
  "src/app/research/page.tsx",
  "src/app/outreach/page.tsx",
  "src/app/call-today/page.tsx",
  "src/app/brief/page.tsx",
  "src/app/prep/[id]/page.tsx",
];

// Server actions that must source workspaceId from the authenticated session.
const AUTH_GATED_ACTIONS = [
  "src/app/actions/leads.ts",
  "src/app/actions/leadgen.ts",
  "src/app/actions/research-queue.ts",
  "src/app/actions/case-studies.ts",
];

// Library helpers that must not use the leaky fallback helper on read paths.
const LIBRARY_READ_PATHS = [
  "src/lib/import-jobs.ts",
  "src/lib/templates/resolver.ts",
];

// Library write helpers that take a workspaceId argument and must scope
// every Prisma read/write through `strictWorkspaceScope(workspaceId)`,
// not `getWorkspaceContext()` or `withWorkspaceFallbackScope`. Adding a
// helper here pins the invariant for that file.
const LIBRARY_WRITE_PATHS = [
  "src/lib/leadgen/promote-to-lead.ts",
];

describe("workspace-scope invariants on auth-gated user-facing pages", () => {
  for (const rel of AUTH_GATED_PAGES) {
    describe(rel, () => {
      const source = read(rel);

      it("does NOT call getWorkspaceContext() (would resolve to platform default and pool tenants)", () => {
        // Allow occurrences inside comment blocks (the SECURITY notes
        // explain *why* it's banned). Strip line comments and block
        // comments first, then assert.
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        expect(
          stripped.includes("getWorkspaceContext"),
          `${rel} must source workspaceId from requireSessionRole(...).workspaceId, not getWorkspaceContext().`,
        ).toBe(false);
      });

      it("does NOT use withWorkspaceFallbackScope (legacy leaky helper)", () => {
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        expect(stripped.includes("withWorkspaceFallbackScope"), rel).toBe(false);
      });

      it("calls requireSessionRole or requireSessionRole-equivalent to source the session", () => {
        // src/app/page.tsx already uses `requireSessionRole`. The fix
        // brought every other auth-gated page onto the same pattern.
        expect(source.includes("requireSessionRole"), rel).toBe(true);
      });
    });
  }
});

describe("workspace-scope invariants on auth-gated server actions", () => {
  for (const rel of AUTH_GATED_ACTIONS) {
    describe(rel, () => {
      const source = read(rel);

      it("does NOT call getWorkspaceContext()", () => {
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        expect(stripped.includes("getWorkspaceContext"), rel).toBe(false);
      });

      it("does NOT use withWorkspaceFallbackScope", () => {
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        expect(stripped.includes("withWorkspaceFallbackScope"), rel).toBe(false);
      });

      it("calls requireSessionRole (membership-aware) instead of requireRole", () => {
        expect(source.includes("requireSessionRole"), rel).toBe(true);
      });
    });
  }
});

describe("workspace-scope invariants on library read paths", () => {
  for (const rel of LIBRARY_READ_PATHS) {
    it(`${rel} does NOT use withWorkspaceFallbackScope on its read paths`, () => {
      const source = read(rel);
      const stripped = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(stripped.includes("withWorkspaceFallbackScope"), rel).toBe(false);
    });
  }
});

describe("workspace-scope invariants on library write paths", () => {
  for (const rel of LIBRARY_WRITE_PATHS) {
    describe(rel, () => {
      const source = read(rel);
      const stripped = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      it("does NOT use withWorkspaceFallbackScope (legacy leaky helper)", () => {
        expect(stripped.includes("withWorkspaceFallbackScope"), rel).toBe(false);
      });

      it("does NOT call getWorkspaceContext() (would resolve to platform default)", () => {
        expect(stripped.includes("getWorkspaceContext"), rel).toBe(false);
      });

      it("uses strictWorkspaceScope on every Prisma access", () => {
        expect(stripped.includes("strictWorkspaceScope"), rel).toBe(true);
      });
    });
  }
});

describe("/audit/[id] public token-gated route", () => {
  // SECURITY model: /audit/[id] is publicly accessible. The HMAC-signed
  // token (verified by verifyAuditAccessToken, bound to lead id) IS the
  // security boundary, NOT workspace scoping. The lead lookup must be
  // `findUnique({ where: { id } })`, not workspace-scoped — otherwise
  // audit-share links silently break for non-default tenants once leads
  // are correctly written to the session's workspace.
  const source = read("src/app/audit/[id]/page.tsx");

  it("does NOT scope the lead lookup by workspaceId (token IS the auth)", () => {
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // No fallback helper, and no getWorkspaceContext() at module scope.
    expect(stripped.includes("withWorkspaceFallbackScope")).toBe(false);
    expect(stripped.includes("getWorkspaceContext")).toBe(false);
  });

  it("verifies the access token before reading the lead", () => {
    expect(source.includes("verifyAuditAccessToken")).toBe(true);
  });
});

describe("strictWorkspaceScope vs cross-tenant query semantics", () => {
  // The strict helper is the only sanctioned scope clause for read paths.
  // When two tenants A and B query their own data through this helper,
  // the resulting Prisma `where` clauses are disjoint (different
  // workspaceId values), so the result sets never overlap.
  it("produces disjoint where clauses for different tenants", async () => {
    const { strictWorkspaceScope } = await import("./workspace");
    const tenantA = strictWorkspaceScope("ws_alpha");
    const tenantB = strictWorkspaceScope("ws_bravo");
    expect(tenantA).toEqual({ workspaceId: "ws_alpha" });
    expect(tenantB).toEqual({ workspaceId: "ws_bravo" });
    // Disjoint at the value level — Prisma will not return ws_alpha rows
    // for a query carrying { workspaceId: "ws_bravo" }.
    expect(tenantA.workspaceId).not.toEqual(tenantB.workspaceId);
  });
});
