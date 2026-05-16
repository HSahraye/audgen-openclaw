# Autopilot Backlog

Safe product/code/test/docs tasks ranked roughly by value × safety. Crestodian picks the highest-value safe task each cycle. Approval-pending work goes to NIGHT_REPORT.md's "Approval Parking Lot" — never blocks the loop.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done (commit hash in NIGHT_REPORT.md)

## Tests for untested libraries (pure logic, no DB)
- [x] B-T01 — `audit-log.ts` shape + write helpers → `6e90bff` (6 tests)
- [x] B-T02 — `events.ts` event tracker + analytics wrappers → `26c9af8` (6) + `5086659` (10)
- [~] B-T03 — `templates/resolver.ts` (existing `resolve.test.ts` covers basics; cache TTL still untested)
- [x] B-T04 — `templates/defaults.ts` default config integrity → `c975100` (10 tests)
- [x] B-T05 — `intelligence/scoring/engine.ts` extended coverage → `714b16c` (11 tests on top of the existing 1)
- [x] B-T06 — `intelligence/recommendations/index.ts` covered via `9c9ca7b` extra tests + existing `infer.test.ts`
- [x] B-T07 — `intelligence/normalization/findings.ts` finding normalization → `402578b` (9 tests)
- [x] B-T08 — `intelligence/outreach/angles.ts` outreach angle generator → `47ea8d8` (10 tests)
- [x] B-T09 — `intelligence/narratives/generate.ts` narrative builder → `40f050b` (7 tests)
- [x] B-T10 — `automation/reply-assistant.ts` reply suggestion logic → `f4d0806` (7 tests)
- [x] B-T11 — `automation/insights.ts` automation insights → `2ea90ae` (8 tests)
- [x] B-T12 — `automation/playbooks.ts` playbook helpers → `3aeb2d0` (9 tests)
- [x] B-T13 — `automation/tasks.ts` task builders → `45c34d9` (6 tests)
- [x] B-T14 — `automation/timeline.ts` timeline assembly → `89cec69` (9 tests)
- [x] B-T15 — `prep-links.ts` prep URL builder → `0671805` (5 tests)

## UX safety nets
- [x] B-U01 — `error.tsx` on `/prep/[id]` → `616cd6f`
- [x] B-U02 — `error.tsx` on `/sequences/[id]` → `616cd6f`
- [x] B-U03 — `error.tsx` on `/settings/billing` → `616cd6f`
- [x] B-U04 — `error.tsx` on `/automation/approvals` → `616cd6f`
- [x] B-U05 — `error.tsx` on `/admin/health` → `616cd6f`
- [x] B-U06 — Reusable `EmptyState` primitive → `48f0215` (9 tests)
- [~] B-U07 — Already covered by existing print stylesheet (shift 1 commit 820772f)
- [x] B-U08 — Skip-to-main-content link in layout → `d8db9d8` + `99d501d` (id="main" anchors)

## Public/customer-facing polish
- [x] B-P01 — OG metadata for `/about` page → `54a8ba1`
- [x] B-P02 — OG metadata for `/a/[slug]` short link → `54a8ba1`
- [ ] B-P03 — `manifest.webmanifest` for PWA-ish install prompts
- [ ] B-P04 — Favicon-set for non-SVG browsers (`favicon.ico` fallback)
- [ ] B-P05 — `apple-touch-icon` size variants

## Security hardening (local-only, defensive)
- [x] B-S01 — Constant-time compare for `PUBLIC_INGEST_API_KEY` (audit, no change needed; already safe)
- [ ] B-S02 — Rate-limit unit tests for `enforceRateLimit`
- [ ] B-S03 — Audit `CSP` header for routes that legitimately need inline scripts; document trade-offs (no behaviour change)
- [ ] B-S04 — Add `nosniff` / `frame-ancestors` audit (defaults already set in `next.config.ts`; document)
- [x] B-S05 — Edge-case tests for `auth/scrub` → `6e206da` (7 tests)

## Docs & DX
- [x] B-D01 — `CONTRIBUTING.md` → `616cd6f`
- [x] B-D02 — `docs/architecture.md` → `a7e9371`
- [x] B-D03 — README Commands refresh → `4117dc8`
- [x] B-D04 — `docs/local-postgres.md` → `deda8ff`
- [x] B-D05 — `npm run typecheck` script → `5b4e052`
- [x] B-D06 — `npm run check` script → `5b4e052`

## Bug fixes (small, reversible)
- [→parking-lot] B-B01 — narrow `connect-src` CSP. Moved to Approval Parking Lot: risk of breaking production if I miss an active provider domain. Needs prod observability first.
- [x] B-B02 — Logger default level via `LOG_LEVEL` env var → `b0fa273`
- [x] B-B03 — `formatRelativeTime` weeks/months/years → `870279a`
- [ ] B-B04 — `cn()` test for extreme inputs (low priority — underlying libs are well-tested)
- [ ] B-B05 — `getPublicBaseUrl` whitespace-only `NEXT_PUBLIC_APP_URL` falls through to localhost instead of `APP_URL`. Tiny: change to `??` or trim before `||`. Pinned in `src/lib/url.test.ts`. Safe to fix in a follow-up PR after deciding whether anyone is intentionally relying on the current behaviour.

## Refactors (behaviour-preserving)
- [ ] B-R01 — Extract `localAssets` from `audit-engine.ts` (still inline, 100+ lines)
- [ ] B-R02 — Extract `toLegacyChecks` from `audit-engine.ts`
- [ ] B-R03 — Shared `PublicShell` component for `not-found.tsx` / `error.tsx` / `loading.tsx` chrome
- [ ] B-R04 — Move dashboard skeleton variants into one configurable component

## Approval Parking Lot (NIGHT_REPORT.md tracks these)
- Netlify `db push` → `db:migrate:deploy` baseline
- `security/automation-runner-secret-required` env enforcement
- Strict email validation on lead form (B-19)
- Two pending Prisma migration plans
- Nonce-based CSP middleware
- Narrow `connect-src` CSP to known providers (B-B01) — risk of breaking production if I miss an active provider domain
