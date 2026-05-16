# Bugs & Gaps Catalogued — Night Autopilot 2026-05-16

Findings from inspection of `develop` @ `ffd2016`. Severity is impact × likelihood. Status reflects what I did about it on `autopilot/night-audgen-2026-05-16`.

## 🔴 High severity

### B-1 — `tsc --noEmit` emits 28 errors across test files
- **Where:** `src/lib/audit-links.test.ts`, `src/lib/csv.test.ts` (mine, now), all `src/lib/intelligence/**/*.test.ts`, `src/lib/request-security.test.ts`, etc.
- **Root cause:** `vitest.config.ts` has `globals: true` but `tsconfig.json` doesn't declare `"types": ["vitest/globals"]`. `describe`/`it`/`expect` therefore lack ambient types.
- **Why it was hidden:** `next build` skips `*.test.ts` files, and the local sprint workflow only ran `eslint` + `vitest run` + `next build` — never a raw `tsc --noEmit`. Any IDE typecheck or future CI pre-merge gate fails immediately.
- **Status:** ✅ Fixed in `50899eb`. tsc now exits 0.

### B-2 — Logger has zero secret scrubbing
- **Where:** `src/lib/logger.ts` before this branch.
- **Risk:** A caller doing `logger.error("stripe_call_failed", { err })` where `err.message` contains a live key (`sk_live_…`, `whsec_…`, `Bearer …`) would dump that key into Netlify function logs verbatim. README + AGENTS.md explicitly claim we never log secrets.
- **Status:** ✅ Fixed in `d8b0c94`. Added key-based + value-pattern redaction, depth-limited recursion, Error.message/stack scrubbing, 9 new tests.

## 🟠 Medium severity

### B-3 — `prisma/dev.db` (520 KB SQLite) tracked in git
- **Where:** `prisma/dev.db`.
- **Risk:** Schema is Postgres in `schema.prisma`. The SQLite file is leftover from earlier work — it's neither canonical nor useful, it bloats every clone, and it's a confusing trap for contributors.
- **Status:** ✅ Untracked in `dcdc837`. `prisma/*.db` added to `.gitignore`. Backup left at `/tmp/audgen-dev.db.bak` on the build host.

### B-4 — `.env.example` missing despite README instruction
- **Where:** README.md line 9 says `cp .env.example .env` but no such file existed.
- **Status:** ✅ Added in `dcdc837`. Documents every env var referenced by `src/lib/env.ts` with safe defaults.

### B-5 — No `loading.tsx` / `not-found.tsx` across ~20 routes
- **Where:** Entire `src/app/**` tree — only `error.tsx` existed.
- **User impact:** Server components render nothing during fetch (blank white flash); `notFound()` calls fall through to Next's default 404 page (no branding, jarring for prospects hitting expired audit links).
- **Status:** ✅ Fixed in `017ae84`. Global `loading.tsx` + `not-found.tsx`, customer-facing `/audit/[id]/not-found.tsx`, route-level skeletons for 8 heavy dashboards.

### B-6 — Audit page (share-and-print surface) lacks print styles
- **Where:** `src/app/audit/[id]/page.tsx` uses `bg-slate-950` sections; `globals.css` had no `@media print` rules.
- **User impact:** Customers using "Print to PDF" get backgrounds dropped (illegible black-on-white) or printed as solid black ink, oversized chrome, ugly mid-card page breaks.
- **Status:** ✅ Fixed in `820772f`. Forced white bg / dark fg, `@page` margins, page-break avoidance, URL annotation, opt-out via `.no-print` / `[data-no-print]`.

### B-7 — No CI on the repository
- **Where:** No `.github/workflows/` directory existed.
- **Risk:** Sprint reports claim "lint clean, 212/212, build clean" but nothing automated enforced that. A future PR could regress and Netlify would happily build it because the build doesn't run tests.
- **Status:** ✅ Fixed in `d035bed`. Added `.github/workflows/ci.yml` running lint + tsc + test + build on PRs to develop/main.

## 🟡 Lower severity / approval-required (not touched)

### B-8 — Netlify build runs `prisma db push`
- **Where:** `netlify.toml`:
  ```
  command = "npm run db:generate && npm run db:push && npm run build"
  ```
- **Risk:** `db push` writes schema without migration history. On real shared Postgres it drifts silently; on column drops it can lose data. `DEVELOP_INTEGRATION_REPORT.md` already calls this out: "Staging DB must be throwaway."
- **Why I didn't fix it:** Schema migrations require your approval per the operating rules. I'd want to introduce a baseline `prisma/migrations/` directory first, which is a meaningful structural change.
- **Recommended action:** Approve a baseline-migration window. Procedure documented in `NIGHT_REPORT.md` §"Suggested next 3 steps".

### B-9 — Two unrun migration plans
- **Where:** `prisma/MIGRATION_PLAN_LEAD_STAGE.md`, `prisma/MIGRATION_PLAN_REPLY_MODEL.md`.
- **Current state:** Application-layer enums + normalisers are the source of truth.
- **Status:** Not touched. Coupled to B-8 — once migrations infra is real, these two are the first ones to apply.

### B-10 — CSP allows `'unsafe-inline'` on script-src in production
- **Where:** `next.config.ts` line 31:
  ```
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'")
  ```
- **Risk:** Defeats CSP as XSS mitigation. The code's own comment acknowledges this and asks for nonce-based middleware.
- **Status:** Not touched. Needs design work for Next 16 + Turbopack inline-script handling.

### B-11 — Four deferred security follow-ups in `TENANT_SCOPE_AUDIT_REPORT.md`
- `unsubscribe-signed-link`
- `public-ingest-tenant-binding`
- `stripe-webhook-no-default-fallback`
- `automation-runner-secret-required` ← smallest, recommended as next ship.
- **Status:** Not touched. Each touches live integrations and needs your sign-off.

## Shift 2 additions

### B-12 — No `loading.tsx` on the long tail of routes
- **Where:** /admin, /admin/health, /admin/insights/scoring, /settings/billing, /templates, /automation/approvals, /sequences/[id], /audit/[id], /a/[slug], /login, /accept-invite.
- **Status:** ✅ Fixed in `e616dab`. Every route now has loading.tsx.

### B-13 — No `error.tsx` on customer-facing public routes
- **Where:** /audit/[id], /a/[slug].
- **Risk:** Prospects hitting an error see the internal "the team has been notified" copy from the root error.tsx — wrong tone, wrong audience.
- **Status:** ✅ Fixed in `eee8bcd`. Friendly copy + try-again CTA. Both still log via the redacting logger.

### B-14 — No robots.txt or sitemap.xml
- **Risk:** Customer audit URLs could be indexed by misbehaving crawlers (leaks business names from the URL itself).
- **Status:** ✅ Fixed in `6f8b25c`. robots.ts disallows every internal + share path; sitemap.ts exposes only / and /about.

### B-15 — No Open Graph / Twitter metadata
- **Where:** layout.tsx + audit/[id]/page.tsx.
- **Risk:** Shared audit links in Slack/iMessage/Twitter unfurl with a blank preview — looks unprofessional on the exact surface where the prospect first sees the brand.
- **Status:** ✅ Fixed in `6b18dda`. Per-audit dynamic title + description with token-protected fallback (no business-name leak to crawlers without the signed token).

### B-16 — audit-engine.ts inline scoring helpers had no direct tests
- **Risk:** scoreLead / packageName / estimateAnnualLoss are deterministic business-critical math but untestable without mocking the entire generation pipeline.
- **Status:** ✅ Fixed in `71afad2`. Extracted to audit-scoring.ts behavior-preserving; 20 new direct tests cover every weight, every threshold, every vertical tier.

### B-17 — audit-links.ts security paths untested
- **Risk:** HMAC verification + expiration + payload-swap defenses had no regression net.
- **Status:** ✅ Fixed in `764b2ef`. 8 adversarial tests prove the gate holds.

### B-18 — Multiple business-critical utilities had zero tests
- **Where:** money.ts, audit-slugs.ts, branding.ts, public-url.ts, objections.ts, utils.ts (cn + formatRelativeTime), communication/links.ts.
- **Status:** ✅ All have dedicated test files now (62 new tests this shift).

### B-19 — Lead actions accept unvalidated email format
- **Where:** `src/app/actions/leads.ts` formSchema uses `z.string().optional()` for email — no email-format check. Same on CSV import path.
- **Risk:** Malformed emails go in, outreach drafts later try to send to garbage and fail silently or noisily.
- **Status:** 🟡 **Not touched** — changing form validation can break existing leads with junky email values already in the DB. Needs Hamid's call on whether to (a) reject at intake, (b) coerce to null when invalid, or (c) keep current permissive behavior. Documented for triage.

## ✅ Things I checked and found genuinely fine

- TypeScript strict mode is on, zero `as any` in `src/`, only one TODO in the entire codebase.
- API routes are well-secured (origin checks, strict zod, rate-limiting, session-derived workspaceId).
- The CSV parser is correct on all the edge cases I could think of (CRLF, embedded commas, embedded newlines, doubled quotes, blank rows, missing trailing columns). Now has 16 tests to prove it.
- The existing `error.tsx` boundary is high-quality — used it as the style template for the new pages.
- The Better Auth integration looks careful (cookie-based, middleware-guarded, scrubTokens pattern in `/api/auth`).

— Crestodian
