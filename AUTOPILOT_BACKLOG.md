# Autopilot Backlog

Safe product/code/test/docs tasks ranked roughly by value × safety. Crestodian picks the highest-value safe task each cycle. Approval-pending work goes to NIGHT_REPORT.md's "Approval Parking Lot" — never blocks the loop.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done (commit hash in NIGHT_REPORT.md)

## Tests for untested libraries (pure logic, no DB)
- [x] B-T01 — `audit-log.ts` shape + write helpers → `6e90bff` (6 tests)
- [ ] B-T02 — `events.ts` event tracker shape (if pure)
- [~] B-T03 — `templates/resolver.ts` (existing `resolve.test.ts` covers basics; cache TTL still untested)
- [ ] B-T04 — `templates/defaults.ts` default config integrity
- [ ] B-T05 — `intelligence/scoring/index.ts` pure scoring
- [ ] B-T06 — `intelligence/recommendations/index.ts` recommendations
- [ ] B-T07 — `intelligence/normalization/findings.ts` finding normalization
- [x] B-T08 — `intelligence/outreach/angles.ts` outreach angle generator → `47ea8d8` (10 tests)
- [ ] B-T09 — `intelligence/narratives/generate.ts` narrative builder
- [ ] B-T10 — `automation/reply-assistant.ts` reply suggestion logic
- [ ] B-T11 — `automation/insights.ts` automation insights
- [ ] B-T12 — `automation/playbooks.ts` playbook helpers
- [ ] B-T13 — `automation/tasks.ts` task builders
- [x] B-T14 — `automation/timeline.ts` timeline assembly → `89cec69` (9 tests)
- [ ] B-T15 — `prep-links.ts` prep URL builder (if exists)

## UX safety nets
- [x] B-U01 — `error.tsx` on `/prep/[id]` → `616cd6f`
- [x] B-U02 — `error.tsx` on `/sequences/[id]` → `616cd6f`
- [x] B-U03 — `error.tsx` on `/settings/billing` → `616cd6f`
- [x] B-U04 — `error.tsx` on `/automation/approvals` → `616cd6f`
- [x] B-U05 — `error.tsx` on `/admin/health` → `616cd6f`
- [ ] B-U06 — Reusable `EmptyState` component for "no leads yet" / "no sequences" / "no templates"
- [ ] B-U07 — Tailwind `prose` defaults for printed copy
- [ ] B-U08 — Skip-to-main-content link in layout (a11y)

## Public/customer-facing polish
- [ ] B-P01 — OG metadata for `/about` page
- [ ] B-P02 — OG metadata for `/a/[slug]` short link
- [ ] B-P03 — `manifest.webmanifest` for PWA-ish install prompts
- [ ] B-P04 — Favicon-set for non-SVG browsers (`favicon.ico` fallback)
- [ ] B-P05 — `apple-touch-icon` size variants

## Security hardening (local-only, defensive)
- [x] B-S01 — Constant-time compare for `PUBLIC_INGEST_API_KEY` in `/api/public/leads` (audit, not change behaviour if already safe)
- [ ] B-S02 — Rate-limit unit tests for `enforceRateLimit`
- [ ] B-S03 — Audit `CSP` header for routes that legitimately need inline scripts; document trade-offs (no behaviour change)
- [ ] B-S04 — Add `nosniff` / `frame-ancestors` audit (defaults already set in `next.config.ts`; document)
- [ ] B-S05 — Tests for `auth/scrub` to lock down behaviour beyond the existing mirror test

## Docs & DX
- [x] B-D01 — `CONTRIBUTING.md` with branch policy, commit style, test rules → `616cd6f`
- [ ] B-D02 — `docs/architecture.md` high-level diagram (text-based)
- [x] B-D03 — Update `README.md` "Commands" section with `typecheck` script → `4117dc8`
- [x] B-D04 — `docs/local-postgres.md` quick-start → `deda8ff`
- [x] B-D05 — Add `npm run typecheck` to `package.json` → `5b4e052`
- [x] B-D06 — Add `npm run check` script → `5b4e052`

## Bug fixes (small, reversible)
- [ ] B-B01 — `next.config.ts` `connect-src https: wss:` is broad; narrow to known providers
- [ ] B-B02 — Logger default level via `LOG_LEVEL` env var
- [x] B-B03 — `formatRelativeTime` weeks/months/years → `870279a`
- [ ] B-B04 — `cn()` test for extreme inputs

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
