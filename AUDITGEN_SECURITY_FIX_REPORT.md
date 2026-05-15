# AuditGen Security Fix Report

## Clean workspace
- **Path used:** `/home/ubuntu/openclaw-workspaces/auditgen-security-clean/PresenceLabs-AuditGenerator`
- **Branch used:** `security/admin-auth-hardening`
- **Remote:** `https://github.com/HSahraye/PresenceLabs-AuditGenerator.git` (fetch + push configured, **no push performed**)
- **Base commit:** `8bfac4a Fixed hero section and organized the reveniew cards`
- **Local commits on this branch:**
  - `6be4ae5` — `security: harden admin access sessions and headers`
  - second commit hash appended after this report is committed (see end of file)

No existing local working directory of yours was touched. No push, no force-push, no destructive git, no deploy, no rm -rf, no destructive migration, no secret rotation.

## Objective
Close the highest-impact issues found during authenticated black-box recon of `audgen.netlify.app`:
1. `/admin` and `/admin/health` reachable by a normal signed-in workspace owner (cross-tenant ops surface).
2. `/api/auth/list-sessions` and `/api/auth/get-session` returning raw better-auth session tokens to the client.
3. Legacy shared-password fallback (`AUTH_*_PASSWORD` env vars) gave admin-equivalent access without per-user attribution and no rate limit.
4. Missing standard HTTP security headers (CSP, Referrer-Policy, Permissions-Policy, COOP, CORP, XFO, HSTS at the app layer).
5. `POST /api/import-jobs` accepted empty/random POSTs without proper auth, body validation, or origin enforcement.
6. `withWorkspaceFallbackScope` matched orphan rows (`workspaceId: null`) — a cross-tenant data hazard.
7. `listWorkspacesForUser` silently auto-elevated workspace owners to **owner of the platform Default Workspace**, which is the root cause of (1).

## Baseline findings (before changes)
- `npm install`: clean.
- `npm run lint`: clean.
- `npm test`: 23 test files, 52 tests, all passing.
- `npm run build`: clean (also re-run after fixes — still clean).
- Code-level evidence backing the recon:
  - `src/app/admin/page.tsx` and `src/app/admin/health/page.tsx` gated only by `requireSessionRole(["owner"])`, which considers anyone with workspace role `owner` on **any** workspace a valid admin.
  - `src/lib/workspace.ts → listWorkspacesForUser` upserts the caller into the Default Workspace with their elevated role on first call, so every signup → owner → became owner of the global Default Workspace.
  - `src/app/api/import-jobs/route.ts` used `getWorkspaceContext()` which falls back to the global Default Workspace for unauthenticated callers when auth is enabled but session is missing.
  - `src/app/api/auth/[...all]/route.ts` was a 2-line passthrough to better-auth — no scrubbing of the `token` field.
  - `next.config.ts` was empty; no security headers from the Next layer.
  - `src/lib/workspace.ts → withWorkspaceFallbackScope` returned `OR: [{ workspaceId }, { workspaceId: null }]`.

## Changes made

### A. Platform admin gate (`src/lib/authz.ts`, new file)
- New helper `requirePlatformAdmin()` calls `notFound()` (404) unless the better-auth session user's email matches `ADMIN_EMAILS`. Legacy `pl_session` sessions are explicitly **not** accepted by this gate.
- New helper `isCurrentUserPlatformAdmin()` for non-throwing UI checks.
- New helper `assertSessionWorkspace()` (page/SSR contexts) and `assertApiSessionWorkspace()` (API contexts) — derive workspaceId from the session, never from the request.
- Wired into `src/app/admin/page.tsx` and `src/app/admin/health/page.tsx`. Both pages were previously calling `requireSessionRole(["owner"])` which let every workspace owner in.

### A2. Removed cross-tenant auto-elevation (`src/lib/workspace.ts`)
- `listWorkspacesForUser` no longer upserts the caller into the platform Default Workspace as `owner`/`admin`. Memberships must now be granted explicitly.
- This was the root cause of (1): every new signup → owner of own workspace → auto-promoted to owner of Default → passed the old admin gate.

### B. Strip raw session tokens (`src/app/api/auth/[...all]/route.ts`)
- Replaced the 2-line passthrough with a wrapper that calls `toNextJsHandler(auth)` then walks the JSON response and **removes any key named `token`** before returning.
- Effect: `GET /api/auth/list-sessions` and `GET /api/auth/get-session` no longer expose the raw better-auth session token to the client. Opaque `id` is still present for revoke flows.
- The HttpOnly `__Secure-better-auth.session_token` cookie still works as before — only the JS-readable response body is sanitized.

### C. Legacy shared-password fallback (`src/app/login/page.tsx`)
- Added per-IP rate limit (10 attempts / 15 min) plus the existing exponential lockout from `getFailedAuthState`/`registerFailedAuthAttempt`.
- Legacy sessions explicitly cannot satisfy `requirePlatformAdmin` (only better-auth sessions can).
- Inline `TODO(security)` comment marks the fallback for removal after migration.

### D. Security headers (`next.config.ts`)
Added globally via `headers()`:
- `Content-Security-Policy`: practical baseline (no `unsafe-eval` in production). `'unsafe-inline'` is kept for `style-src` because Tailwind / Next inject style fragments at runtime; `script-src` keeps `'unsafe-inline'` for Next App Router inline bootstrap scripts (move to nonce-based CSP in a follow-up).
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)`
- `X-Frame-Options: DENY`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`

### E. `POST /api/import-jobs` hardening (`src/app/api/import-jobs/route.ts`, `[id]/route.ts`, `[id]/run/route.ts`)
- Auth required via `assertApiSessionWorkspace()`. Unauthenticated → 404 (deliberately, to avoid enumeration).
- `workspaceId` always derived from the authenticated session. Body/query/header values are ignored even if present.
- POST body validated with strict `zod` (`{}` or `{action:"process-next"}`); anything else → 400.
- Cross-site protection: requires `Sec-Fetch-Site: same-origin|same-site`, or `Origin`/`Referer` matching `getAppOrigin()`. Otherwise → 403.
- Per-user rate limit (30 POST/min, 60 GET/min) via existing `enforceRateLimit`.

### F. Strict workspace scoping (`src/lib/workspace.ts`, `src/lib/env.ts`)
- `withWorkspaceFallbackScope(workspaceId)` now returns `{ workspaceId }` by default. The legacy `OR: [{ workspaceId }, { workspaceId: null }]` behaviour is opt-in via `ALLOW_WORKSPACE_NULL_FALLBACK=true` for backfill scenarios only.
- New `strictWorkspaceScope(workspaceId)` helper for new code that should never fall back to orphan rows.
- `ALLOW_WORKSPACE_NULL_FALLBACK` added to `src/lib/env.ts` schema.

## Files changed
First commit (`6be4ae5`):
- `next.config.ts`
- `package-lock.json` (only the install drift from `npm install` — no dependency changes)
- `src/app/admin/health/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/login/page.tsx`
- `src/lib/authz.ts` (new)
- `src/lib/env.ts`
- `src/lib/workspace.ts`

Second commit (this commit):
- `src/app/api/import-jobs/route.ts`
- `src/app/api/import-jobs/[id]/route.ts`
- `src/app/api/import-jobs/[id]/run/route.ts`
- `src/lib/authz.test.ts` (new — 11 tests)
- `src/lib/workspace.test.ts` (new — 3 tests)
- `src/app/api/auth/scrub.test.ts` (new — 4 tests)
- `scripts/security-verification.sh` (new — manual curl checklist)
- `AUDITGEN_SECURITY_FIX_REPORT.md` (this file)

## Security impact
- **Admin surface is closed to workspace owners.** Only emails in `ADMIN_EMAILS` reach `/admin`. Anyone else gets a 404 (no enumeration). Legacy shared-password sessions are explicitly out.
- **Cross-tenant auto-elevation is gone.** Signing up no longer makes you an owner of the platform Default Workspace. The path that made every workspace owner an admin no longer exists.
- **Session tokens stay server-side.** Any XSS that lands no longer recovers the device tokens via `/api/auth/*` JSON responses. The HttpOnly session cookie remains untouched.
- **Legacy fallback is now rate-limited and gated.** Production should still target removing it; until then, brute-force attempts are throttled and the path can never reach `/admin`.
- **HTTP security headers** are enforced at the Next layer, not just Netlify. CSP blocks foreign scripts; XFO+COOP+CORP block clickjacking and cross-origin embeds; HSTS pins HTTPS.
- **`import-jobs` is no longer a usable handle for cross-tenant data fetches.** WorkspaceId is derived server-side; cross-site POSTs are blocked; invalid bodies are rejected; rate-limited.
- **`withWorkspaceFallbackScope` is strict by default.** Existing call sites (`/`, `/research`, `/call-today`, `/prep/[id]`, `actions/leads.ts`, `actions/research-queue.ts`, `api/public/audits/[id]/status`) automatically benefit from the strict default. The orphan-row inclusion can be turned back on with one env var if a backfill needs it.

## Product impact
AuditGen is being positioned as a Salesforce-style sales engine for local-business outbound. The fixes matter for that pitch in three concrete ways:

1. **Multi-tenant credibility.** Before this branch, every signup silently became an owner of the platform Default Workspace and could read every other tenant's workspaces, plans, webhook events, AI usage, and auth failure logs from `/admin`. That makes "we'll host your agency on AuditGen" a non-starter. After this branch, only emails on the explicit `ADMIN_EMAILS` allowlist can see cross-tenant ops, and workspace owners are confined to their own workspace data.
2. **Auth posture is what buyers expect.** Stripped session tokens, CSP, rate-limited legacy auth, server-side workspace derivation, and strict scoping are the table-stakes for a SaaS that handles lead PII and is wired to Stripe + Twilio + email providers.
3. **Foundation for the next features.** The new `assertSessionWorkspace` / `assertApiSessionWorkspace` / `strictWorkspaceScope` helpers give a clean, centralized hook for every new API route or server action. The follow-up work below should standardise on them.

## Tests / verification

### Automated
- `npm run lint` → clean.
- `npm test` → **26 test files / 70 tests** passing. Up from 23/52.
  - New: `src/lib/authz.test.ts` (11 tests: admin gate fail-closed, allowlist match, legacy rejection, API session presence).
  - New: `src/app/api/auth/scrub.test.ts` (4 tests: mirrors and pins the token-scrubbing contract).
  - New: `src/lib/workspace.test.ts` (3 tests: strict default, env-flag opt-in, strict helper).
- `npm run build` → clean Next.js 16.2.6 production build. All 38 routes compile.

### Manual
- `scripts/security-verification.sh` — curl-based checklist for: unauth `/admin` 404/redirect, normal user `/admin` 404, admin user `/admin` 200, `list-sessions` and `get-session` no `token`, `import-jobs` cross-site 403, `import-jobs` invalid body 400, security headers present. Run against a local `npm run dev` with `APP_AUTH_ENABLED=true` and `ADMIN_EMAILS` set.

## Remaining risks
Be honest, in order of concern:

1. **Other API routes still derive workspace from `getWorkspaceContext()` (default workspace fallback) instead of from the authenticated session.** Routes flagged but not changed in this pass:
   - `src/app/api/audit-view/route.ts`
   - `src/app/api/payment-intent/route.ts`
   - `src/app/api/proposals/events/route.ts`
   - `src/app/api/communication/events/route.ts`
   These are reachable when `APP_AUTH_ENABLED=true` but session is missing, and will write to the platform Default Workspace. They likely need either a session check (if internal) or a provider-signed payload check (if webhook). I did not change them because the right contract for each depends on the upstream caller and could break working webhooks if guessed wrong. **Recommended next task — see below.**
2. **CSP keeps `'unsafe-inline'` on `script-src` and `style-src`.** Next.js App Router uses inline bootstrap scripts. The right end-state is nonce-based CSP injected by `middleware.ts`. Practical baseline today is still a big upgrade vs. no CSP at all, and explicitly drops `'unsafe-eval'` in production.
3. **In-memory rate limit and failed-auth maps don't survive process restarts** and are per-instance. Acceptable for a single Netlify function instance / small footprint; revisit if the app fans out across many functions or moves to multi-region.
4. **The platform Default Workspace is still a real workspace** containing whatever rows pre-dated multi-tenancy. The `ALLOW_WORKSPACE_NULL_FALLBACK` env is the only safe way to surface those rows now, and only to callers explicitly bound to that workspace. A clean migration (assign every orphan row to a workspace, drop the env flag, drop the OR branch) is a one-time job worth doing.
5. **Legacy shared-password fallback is rate-limited and gated, not removed.** Removal is a product decision: once you confirm no real users still authenticate via `AUTH_*_PASSWORD`, delete the path in `src/app/login/page.tsx`, `src/lib/auth.ts → resolveRoleFromPassword`, and the env vars. Tests assume removal will not break the better-auth path.
6. **Better-auth `BETTER_AUTH_SECRET` warning in the build log.** Build succeeds because dev secrets are short — production must set a real 32+ char secret. `assertProductionEnv()` already enforces this when `ENFORCE_ENV_VALIDATION=true` or `NETLIFY=true`.
7. **`requirePlatformAdmin` reads `ADMIN_EMAILS` on every request.** That's fine, but if `ADMIN_EMAILS` is empty in production the entire `/admin` surface is unreachable. That's the correct fail-closed posture; just don't be surprised by it.

## Next recommended task
Lock down the four remaining API routes that still call `getWorkspaceContext()` directly:

- `src/app/api/audit-view/route.ts`
- `src/app/api/payment-intent/route.ts`
- `src/app/api/proposals/events/route.ts`
- `src/app/api/communication/events/route.ts`

For each, decide whether it's:
- Internal (UI-driven) → switch to `assertApiSessionWorkspace()` + same-origin enforcement (mirror the import-jobs pattern).
- External (provider webhook / public ingest) → require a provider HMAC signature like `src/app/api/public/leads/route.ts` already does (`verifyHmacSignature`).
Use the new helpers in `src/lib/authz.ts` and the strict scope in `src/lib/workspace.ts → strictWorkspaceScope`. Add a vitest unit per route.

Inspect this branch with:
```
cd /home/ubuntu/openclaw-workspaces/auditgen-security-clean/PresenceLabs-AuditGenerator && git log --stat security/admin-auth-hardening ^main
```
