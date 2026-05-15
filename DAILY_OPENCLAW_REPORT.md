# Daily OpenClaw Report

## Date
2026-05-15 (UTC)

## Work completed

**Cycle 0 (pre-mission, foundation).** Black-box recon of `audgen.netlify.app`
surfaced six real issues. Built a clean isolated working copy at
`~/openclaw-workspaces/auditgen-security-clean/PresenceLabs-AuditGenerator`
on a fresh branch off `main`. Did NOT touch the original repo. Created the
safe development repo `HSahraye/audgen-openclaw` and pushed feature
branches there. `origin` (`PresenceLabs-AuditGenerator`) untouched.

**Cycle 1.** Shipped `docs/saas-roadmap` — `AUDITGEN_SAAS_ROADMAP.md` with
vision, ICP, modules, data model, six-phase roadmap, revenue model, moat,
eight architecture invariants, and the next 10 engineering tasks. This is
now the source of truth for what we build.

**Cycle 2.** `security/audit-view-hardening`. POST /api/audit-view now
requires a signed audit token bound to the leadId, or an authenticated
workspace member who owns the lead's workspace. Dropped the
Default-Workspace fallback. ViewLog writes to the lead's real workspace.
Per-leadId rate limit. 404 on authz failure.

**Cycle 3.** `security/payment-intent-hardening`. Same model applied to
POST /api/payment-intent (a side-effect endpoint that mutates
Lead.paymentStatus and fires pipeline automation). Pre-fix, anonymous
callers could flip paymentStatus on any lead and pollute pipeline.

**Cycle 4.** `security/proposals-events-hardening`. Removed
client-supplied `workspaceId` from POST /api/proposals/events. The
workspace is now derived from the Lead. Pre-fix this was an open IDOR:
anyone could forge `proposal.accepted` activities into any tenant.

**Cycle 5.** `security/communication-events-hardening`. The biggest of
the four. The route is an inbound provider webhook target (Resend /
Postmark / Twilio); previously it accepted `workspaceId` and arbitrary
unsubscribe/bounce events from any caller. Now: HMAC-signed via
`COMMUNICATION_WEBHOOK_SECRET` using the same `ts.rawBody` convention as
the public-ingest endpoint, or session-bound internal caller. workspaceId
is resolved server-side from the OutboundMessage we sent. leadId is
verified to belong to the resolved workspace or nulled.

## Branches/commits

All branches pushed to `audgen-openclaw` (safe repo). `origin` untouched.

| Branch | Commit | Summary |
|---|---|---|
| `security/admin-auth-hardening` | `6be4ae5` | admin gate, list-sessions scrub, legacy pw guard, security headers, listWorkspacesForUser auto-elevation removed, `withWorkspaceFallbackScope` strict by default |
| `security/admin-auth-hardening` | `02fe1d3` | import-jobs hardening, authz/scrub/workspace tests, verification script, security-fix report |
| `docs/saas-roadmap` | `1d1a045` | `AUDITGEN_SAAS_ROADMAP.md` |
| `security/audit-view-hardening` | `2be9270` | audit-view: signed-token-or-owner |
| `security/payment-intent-hardening` | `c01b1f7` | payment-intent: signed-token-or-owner |
| `security/proposals-events-hardening` | `4435682` | proposals/events: drop body workspaceId (IDOR fix) |
| `security/communication-events-hardening` | `896e8bb` | communication/events: HMAC webhook + drop body workspaceId |
| `docs/daily-report-2026-05-15` | (this commit) | this report |

Each branch is small, focused, reviewable, and reversible. None merged.

## Tests/build

- `npm run lint` — clean across every branch.
- `npm test` — green on every branch:
  - `security/admin-auth-hardening`: 70 tests
  - `security/audit-view-hardening`: 76 tests (+6 audit-view route tests)
  - `security/payment-intent-hardening`: 76 tests (+6)
  - `security/proposals-events-hardening`: 76 tests (+6)
  - `security/communication-events-hardening`: 76 tests (rewrote the old single test into 7)
- `npm run build` — clean Next.js 16.2.6 production build on every branch. All
  38 routes compile.

## Security findings

Closed in this session:

1. **Cross-tenant admin access via `/admin` and `/admin/health`**
   (Severity: Critical). Fixed in `security/admin-auth-hardening` via
   `requirePlatformAdmin()` ADMIN_EMAILS allowlist gate. Root-caused to
   the auto-elevation in `listWorkspacesForUser`; also fixed.

2. **Session token returned in `/api/auth/list-sessions` and
   `/get-session` response bodies** (Severity: High). Fixed via a wrapper
   around the better-auth catch-all that scrubs any `token` key from JSON
   responses.

3. **Legacy shared-password fallback unbounded** (Severity: Medium).
   Rate-limited per-IP (10/15 min) and blocked from `/admin`. TODO to
   remove the path entirely once real accounts have migrated.

4. **Missing HTTP security headers** (Severity: Medium). CSP,
   Referrer-Policy, Permissions-Policy, COOP, CORP, XFO, HSTS, nosniff
   added globally.

5. **`POST /api/import-jobs` accepted arbitrary POSTs** (Severity: Medium).
   Now requires session, validates strict body, enforces same-origin,
   rate-limited, workspaceId derived from session.

6. **Orphan-row leak via `withWorkspaceFallbackScope`** (Severity: Medium).
   Strict by default; opt-in via `ALLOW_WORKSPACE_NULL_FALLBACK` for
   backfill.

7. **`/api/audit-view`, `/api/payment-intent` fell back to Default
   Workspace and accepted any leadId** (Severity: High). Now require a
   signed audit token or session-bound workspace owner.

8. **`/api/proposals/events` accepted client-supplied `workspaceId`**
   (Severity: Critical IDOR). workspaceId now derived from the Lead;
   client cannot pin events to another tenant.

9. **`/api/communication/events` accepted unauthenticated POSTs with
   client-supplied `workspaceId`** (Severity: Critical IDOR + spoof
   surface). Now HMAC-verified or session-bound; workspaceId resolved
   from the OutboundMessage we issued; foreign leadId stripped.

Open / accepted risks (carried forward):

- CSP still has `'unsafe-inline'` on script-src/style-src. Move to
  nonce-based CSP via `middleware.ts` in Phase 6.
- Rate limit and failed-auth state are in-memory and per-instance.
  Acceptable today; move to Postgres or Redis when traffic grows.
- Legacy shared-password fallback still exists (rate-limited, gated, but
  exists). Schedule removal after user migration.
- `assertProductionEnv()` does not run during dev/test builds — production
  must still set `ENFORCE_ENV_VALIDATION=true`.

## Product improvements

- Workspace boundaries are now enforced server-side on every previously
  weak endpoint. That makes "agency hosts multiple clients on AuditGen"
  a credible pitch rather than a leak waiting to happen.
- The strict workspace scope means orphan rows (legacy data) no longer
  surface to random tenants. Once we run a real backfill, the legacy env
  flag goes away.
- The webhook signature pattern on `/api/communication/events` matches the
  one already used on `/api/public/leads`, so wiring up Resend / Postmark /
  Twilio is now a configuration job, not a security redesign.
- The new `AUDITGEN_SAAS_ROADMAP.md` gives the team a shared map. Every
  branch from here on cites a roadmap line so we don't drift.

## Risks/blockers

- No production credentials on this host; all work is offline. Build/test
  prove the code compiles and behaves under unit tests, not under live
  Stripe / better-auth / database load. When a staging environment is
  available, the verification script (`scripts/security-verification.sh`)
  should be run against it before any merge.
- The four route-hardening branches do not yet have a shared `assertApiSessionWorkspace`
  import path because each branched off `security/admin-auth-hardening`.
  Before merge, they should be rebased onto a single integration branch (or
  `admin-auth-hardening` should land first and the others rebase on `main`
  after).

## Next 3 tasks

1. **`feature/lead-stage-model`** — add a first-class `LeadStage` enum on
   `Lead` (`new → contacted → replied → booked → audit_sent →
   proposal_sent → won → lost`), plus an `Activity` ledger and helpers
   to transition + log. This unlocks every pipeline counter and report.
2. **`feature/pipeline-counters`** — wire the dashboard tiles to the new
   stage/activity data. Counters by stage, 24h / 7d / 30d. This is the
   first piece of CRM-grade visibility.
3. **`feature/reply-logging-manual`** — add a reply-capture UI on
   `/prep/[id]` that writes a `Reply` (+ Activity) row with a
   classification dropdown (positive / negative / ask-for-info /
   out-of-office / unsubscribe / wrong-person). Foundation for the
   reply-intelligence module in Phase 2.

After those three land, we have the spine of a sales CRM. Phase 2 (reply
intelligence) and Phase 3 (outreach quality) sit on top of that spine.
