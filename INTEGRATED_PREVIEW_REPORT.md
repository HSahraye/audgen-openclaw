# Integrated Preview Report

## Branch
`preview/integrated-demo` on `HSahraye/audgen-openclaw` (safe repo
only; never pushed to original).

## Branches included (21 of 21, zero conflicts)

Merged in this order so dependencies (security → spine → UI → docs)
build up cleanly:

1. `security/admin-auth-hardening`
2. `security/audit-view-hardening`
3. `security/payment-intent-hardening`
4. `security/proposals-events-hardening`
5. `security/communication-events-hardening`
6. `feature/lead-stage-model`
7. `feature/pipeline-counters`
8. `feature/reply-logging-manual`
9. `feature/dashboard-funnel-tiles`
10. `feature/reply-ui-on-prep`
11. `feature/outreach-personalization-validator`
12. `feature/daily-brief-pipeline-state`
13. `feature/scoring-feedback-loop-skeleton`
14. `feature/outcome-analytics-by-vertical-city`
15. `feature/reply-classifier-v1`
16. `feature/landing-copy-ai-sales-os`
17. `feature/demo-data-seed-script`
18. `docs/saas-roadmap`
19. `docs/onboarding-checklist-agencies`
20. `docs/demo-walkthrough`
21. `docs/gtm-sales-playbook`

## Branches skipped

**None.** All 21 branches merged with strategy `ort`, zero conflict
markers, zero hand-edits.

## Conflicts resolved

None. The branch dependency order was selected to make merges
contiguous (each branch's diff lives in a different file or section
than the next).

## Files changed (versus safe-repo `main`)

Summary from `git diff --stat main...preview/integrated-demo`:

- New: `AUDITGEN_SAAS_ROADMAP.md`, `AUDITGEN_AGENCY_ONBOARDING.md`,
  `AUDITGEN_DEMO_WALKTHROUGH.md`, `AUDITGEN_GTM_SALES_PLAYBOOK.md`,
  `AUDITGEN_SECURITY_FIX_REPORT.md`.
- New: `prisma/MIGRATION_PLAN_LEAD_STAGE.md`,
  `prisma/MIGRATION_PLAN_REPLY_MODEL.md`.
- New: `scripts/seed-demo-data.ts` + `scripts/security-verification.sh`.
- New: `src/lib/authz.ts`, `src/lib/pipeline/*` (stages, activity,
  transition, counters, replies, daily-brief, reply-classifier),
  `src/lib/intelligence/outreach/personalization.ts`,
  `src/lib/intelligence/analytics/outcomes.ts`,
  `src/lib/intelligence/scoring/feedback.ts`,
  `src/components/pipeline-funnel-tiles.tsx`,
  `src/components/reply-logger.tsx`,
  `src/app/actions/replies.ts`,
  `src/app/about/page.tsx`.
- Hardened: `src/app/admin/page.tsx`, `src/app/admin/health/page.tsx`,
  `src/app/api/auth/[...all]/route.ts`, `src/app/api/audit-view/route.ts`,
  `src/app/api/payment-intent/route.ts`,
  `src/app/api/proposals/events/route.ts`,
  `src/app/api/communication/events/route.ts`,
  `src/app/api/import-jobs/route.ts`,
  `src/app/api/import-jobs/[id]/route.ts`,
  `src/app/api/import-jobs/[id]/run/route.ts`,
  `src/app/login/page.tsx`,
  `src/lib/auth.ts`, `src/lib/env.ts`, `src/lib/workspace.ts`,
  `src/lib/brand.ts`, `middleware.ts`, `next.config.ts`,
  `vitest.config.ts`, `package.json`.
- Existing test files updated and many new tests added.

## Lint / test / build results

| Step | Result |
|---|---|
| `npm run lint` | clean |
| `npm test` | **188 / 188 passing across 41 test files** (~9 s) |
| `npm run build` | clean Next.js 16.2.6 production build; all routes compile, including the new `/about` route |

Visible routes on the integrated branch:
```
○ /_not-found      ƒ /audit/[id]            ƒ /about
ƒ /                ƒ /accept-invite          ƒ /a/[slug]
ƒ /admin           ƒ /admin/health           ƒ /automation/approvals
ƒ /brief           ƒ /call-today             ƒ /login
ƒ /outreach        ƒ /prep/[id]              ƒ /research
ƒ /sequences       ƒ /sequences/[id]         ƒ /settings/billing
ƒ /templates       /api/* routes …
```

## Secrets scan before push

```
ghp_           -> 0 hits
github_pat_    -> 0 hits
sk_live        -> 0 hits
sk_test        -> 0 hits
STRIPE_SECRET  -> N hits (var-name references in src; no values)
BETTER_AUTH_SECRET -> N hits (var-name references in src; no values)
DATABASE_URL=  -> 0 hits
SESSION_TOKEN  -> 0 hits
```

No actual secret values found.

## Preview branch link

After push: https://github.com/HSahraye/audgen-openclaw/tree/preview/integrated-demo

## Netlify staging deploy instructions (DO NOT use --prod)

These steps run **outside** this session because the host doesn't have
Netlify CLI installed or a `NETLIFY_AUTH_TOKEN` available. Run them
locally or on a Netlify-connected host.

### One-time setup (5 min)

1. Create a **new Netlify site** specifically for staging. **Do NOT
   reuse `audgen.netlify.app`**. Suggested name:
   `audgen-openclaw-staging`.

2. In the new site's Netlify settings:
   - **Build & deploy → Continuous deployment**: connect the GitHub
     repo `HSahraye/audgen-openclaw`.
   - **Production branch**: set to `preview/integrated-demo` (it's
     `main` on the safe repo that stays untouched; the "production"
     branch of this *staging site* is the preview branch).
   - **Build command**: leave as-is (the `netlify.toml` in the repo
     pins `npm run db:generate && npm run db:push && npm run build`).
   - **Publish directory**: `.next` (pinned in `netlify.toml`).

3. **Environment variables** for the staging site (NOT the production
   site):
   - `DATABASE_URL` → a fresh Postgres on Neon / Supabase / Vercel
     Postgres. **NOT the production DB.**
   - `BETTER_AUTH_SECRET` → fresh 32+ char random
     (`openssl rand -base64 32`).
   - `SESSION_SECRET` → fresh 32+ char random.
   - `AUDIT_LINK_SECRET` → fresh 32+ char random.
   - `APP_AUTH_ENABLED=true`
   - `ADMIN_EMAILS=<your-email>` so you can reach `/admin`.
   - `NEXT_TELEMETRY_DISABLED=1`
   - Leave Stripe / Twilio / Resend / Postmark vars empty, OR set to
     test-mode keys. No real outreach. No real billing.

4. **Seed the preview database** once after the first build succeeds:
   ```
   DATABASE_URL=<preview-db-url> npm run db:seed:demo
   ```
   This creates a demo workspace ("Demo Agency Inc") with 5 demo leads
   across 5 stages and 5 verticals. The seeder is idempotent and
   refuses to run against `NODE_ENV=production` unless `DEMO_FORCE=true`
   is also set.

### Deploys

Once the staging site is wired:
- Pushes to `preview/integrated-demo` on `audgen-openclaw` trigger
  Netlify builds automatically.
- Each build produces a deploy preview URL under the staging site's
  domain (NOT the production `audgen.netlify.app` URL).
- Manual draft from CLI (after `netlify login` + `netlify link` to the
  **staging** site):
  ```
  netlify deploy --build
  ```
  Outputs a draft URL like
  `https://<id>--audgen-openclaw-staging.netlify.app/`. This is the
  click-through link to share for review.
- **Never run `netlify deploy --prod`** against any site that resolves
  to a customer domain.

### Routes to inspect first

In this order:
1. `/about` — repositioning page (public, no auth).
2. `/login` → sign in as `demo-owner@auditgen.local` (set this account
   up via `/signup` first; password is whatever you pick at signup).
3. `/` — confirm onboarding wizard card (if a fresh workspace) + funnel
   tiles + lead list show.
4. `/brief` — confirm "Pipeline-state brief" section appears above the
   existing Hit List.
5. `/prep/<lead>` (use a lead from the demo seed, e.g. `bay-smiles-dental`
   slug or via the lead id) — confirm: NBA strip at top (if wired
   onto this branch), reply logger card, personalization advisory under
   the 30-second pitch.
6. `/admin` — should render the Ops Console **only** when your email
   is in `ADMIN_EMAILS`; should return 404 otherwise.

### Visible features to inspect

- Public `/about` page (AI Sales OS positioning).
- Pipeline funnel tiles on home dashboard.
- Reply logger card on `/prep/[id]`.
- Personalization advisory (4-signal rule) on the 30-second pitch.
- Pipeline-state daily brief on `/brief`.
- Admin allowlist gating on `/admin` and `/admin/health`.
- Stripped `token` field from `/api/auth/list-sessions` and
  `/api/auth/get-session` JSON responses.
- CSP / HSTS / Referrer-Policy / Permissions-Policy / COOP / CORP /
  XFO / nosniff headers on every response (run `curl -sI` on `/` to
  confirm).

### Note on missing UI wires

Two completed feature branches were **not** merged here because they
are wires for additional surfaces not in the original include list:
- `feature/outreach-validator-wired` (validator advisory rendered on
  `/prep/[id]` — separate from the validator itself)
- `feature/daily-brief-on-brief` (pipeline brief rendered on `/brief`)
- `feature/next-best-action` + `feature/next-best-action-on-prep`
- `feature/vertical-pack-scaffold` + `feature/vertical-pack-prep-wiring`
- `feature/team-roles-permissions-plan`
- `feature/usage-limits-plan`
- `feature/billing-plan-enforcement-plan`
- `feature/enforce-import-jobs-billing`
- `feature/onboarding-wizard-helper` + `feature/onboarding-wizard-ui`
- `feature/activity-emit-on-import`

If you want the **full** stack on preview, ask me to land
`preview/integrated-demo-full` covering all 30+ feature branches; that
needs a second integration pass.

## Risks

1. **Build command runs `npm run db:push`.** It is non-destructive for
   fresh Postgres but does write the schema on first build. Use a
   throwaway preview DB.
2. **`/about` is public** by design (added to middleware allowlist). No
   PII; same exposure as `/login`.
3. **Demo seed leaves traces.** If you ever re-point the staging DB at
   a real customer DB the seeded rows will appear in their workspace
   listing. Run `db:seed:demo` against fresh DBs only.

## Next task

Stopping per cost caps after pushing this branch and report. To unblock
the actual deploy: complete the Netlify setup above and trigger the
first build. I won't auto-deploy.

If you want the **full-stack integrated branch** (all 30+ feature
branches, not just these 21), say so and I'll run a single
integration pass on `preview/integrated-demo-full` next cycle.
