# Staging Preview Checklist (no production deploys)

> Setup guide for shipping `develop` on `HSahraye/audgen-openclaw` to a
> **staging** Netlify site. Production (`audgen.netlify.app`) is
> explicitly out of scope. Anything destructive or irreversible is
> called out.

## Repo + branch

- Repo: `HSahraye/audgen-openclaw` (safe repo only).
- Staging branch: **`develop`**.
- Do NOT point staging at `main` (it's an orphan single-commit history).
- Do NOT point staging at any `preview/*` branch (legacy from earlier
  cycles).

## Netlify site setup — one-time

1. **Create a new Netlify site.** Suggested name:
   `audgen-openclaw-staging`. The default URL becomes something like
   `audgen-openclaw-staging.netlify.app`.

   - DO NOT reuse the production site `audgen.netlify.app`.
   - DO NOT alias a production domain to this staging site.

2. In the new site's settings:
   - **Build & deploy → Continuous deployment** → connect GitHub repo
     `HSahraye/audgen-openclaw`.
   - **Production branch** (of this *staging site*) = `develop`.
   - **Build command**: leave default (`netlify.toml` already pins it).
   - **Publish directory**: `.next` (pinned in `netlify.toml`).
   - **Deploy preview branches**: keep on if you want PRs to also auto-
     preview; otherwise off is fine.

3. Confirm the staging site's domain is NOT `audgen.netlify.app`. If
   you ever see Netlify offering to "promote to production domain,"
   say no.

## Required env vars (names only)

Set these on the **staging** site, not anywhere else. **Do not paste
real production secrets.** Generate fresh dev values with
`openssl rand -base64 32` where applicable.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | **Throwaway Postgres**, not production. Neon / Supabase / Vercel-Postgres free tier is fine. |
| `BETTER_AUTH_SECRET` | yes | 32+ chars. Fresh value, not the prod one. |
| `SESSION_SECRET` | yes | 32+ chars. Fresh. |
| `AUDIT_LINK_SECRET` | yes | 32+ chars. Fresh. |
| `APP_AUTH_ENABLED` | yes | `true` |
| `ADMIN_EMAILS` | yes | Your email (comma-separated). Required to reach `/admin` and `/admin/health`. |
| `APP_URL` | yes | `https://<staging-site>.netlify.app` |
| `NEXT_PUBLIC_APP_URL` | yes | Same as `APP_URL`. |
| `DEFAULT_WORKSPACE_SLUG` | optional | Default `default`. |
| `DEFAULT_WORKSPACE_NAME` | optional | Default `Default Workspace`. |
| `NEXT_TELEMETRY_DISABLED` | optional | `1` |
| `ENFORCE_ENV_VALIDATION` | optional | `true` if you want production-grade env validation in staging. |
| `STRIPE_SECRET_KEY` | leave empty or test-mode | Production keys forbidden. |
| `STRIPE_WEBHOOK_SECRET` | leave empty or test-mode | Same. |
| `RESEND_API_KEY` / `POSTMARK_API_KEY` | leave empty | No real email from staging. |
| `TWILIO_*` | leave empty | No real SMS / calls from staging. |
| `PUBLIC_INGEST_API_KEY` / `PUBLIC_INGEST_API_SECRET` | optional | Set only if you want to test the public ingest path. |
| `COMMUNICATION_WEBHOOK_SECRET` | optional | Set only if you want to exercise the HMAC webhook on `/api/communication/events`. |
| `ALLOW_WORKSPACE_NULL_FALLBACK` | leave unset | `true` re-enables orphan-row inclusion (only for backfill). |

`NETLIFY_AUTH_TOKEN` is a **build-side** secret on your machine, never
in app env. Don't set it on the site.

## Build command (already pinned in `netlify.toml`)

```
npm run db:generate && npm run db:push && npm run build
```

`db:push` is non-destructive for a fresh Postgres; it will create the
schema on first build. **If you ever point staging at a populated DB,
the same command may attempt schema diffs — do not point staging at a
populated DB.**

## First-time after the build succeeds

Seed demo data once so the dashboards have content:

```
DATABASE_URL=<staging-db-url> npm run db:seed:demo
```

- Idempotent (safe to re-run).
- Refuses to run when `NODE_ENV=production` AND `APP_AUTH_ENABLED=true`
  unless `DEMO_FORCE=true` is also set (audit-trail moment).
- Creates one demo workspace ("Demo Agency Inc", slug `demo-agency`)
  with five demo leads across five stages.

## Expected routes to inspect

Open these in this order:

1. **`/about`** (public). New positioning page (AI Sales OS).
2. **`/login`** → sign up an admin account that matches `ADMIN_EMAILS`.
3. **`/`** dashboard:
   - Pipeline **funnel tiles** at the top (5 leads imported / 3
     contacted / etc.).
   - Lead list with the seeded leads.
4. **`/brief`** — Today's Hit List (heuristic). The pipeline-state
   brief lives on the parked `feature/daily-brief-on-brief` branch
   and is not on `develop`.
5. **`/prep/<lead>`** — pick a lead from the seed (e.g.
   `/prep/<lead-id>`). Confirm: reply logger card visible,
   personalization advisory shows under the 30-second pitch.
6. **`/admin`** — should render only if your email is in
   `ADMIN_EMAILS`. Non-admins should get a 404 (deliberate; we do not
   advertise the route).
7. **`/admin/health`** — same admin gate; basic ops metrics.

Sanity-check on headers (run from terminal):

```
curl -sI https://<staging-site>.netlify.app/ | grep -iE \
  'content-security-policy|referrer-policy|permissions-policy|x-frame-options|cross-origin-opener-policy|cross-origin-resource-policy|strict-transport-security|x-content-type-options'
```

You should see CSP, Referrer-Policy, Permissions-Policy, XFO, COOP,
CORP, HSTS, and `X-Content-Type-Options: nosniff`.

## Demo data setup recap

- 1 workspace: `Demo Agency Inc` (slug `demo-agency`).
- 5 leads: Bay Smiles Dental (CONTACTED), 420 Smoke Shop (REPLIED),
  Cool Air HVAC (QUALIFIED), Cosmic Coffee Roasters (PROPOSAL_SENT),
  Anchor Auto Repair (NEW).
- All emails / phones use `.example` / 555-01xx; no real PII.
- Activity ledger pre-seeded with `LEAD_IMPORTED` + `AUDIT_GENERATED`
  so funnel tiles and analytics have signal on day one.

## Rollback plan

- **Bad build / regression on staging:** in Netlify → **Deploys** →
  pick the last good deploy → **Publish deploy**. This is the
  Netlify-native rollback; no git rewrite needed.
- **Bad DB state on staging:** wipe the staging DB and re-run
  `npm run db:seed:demo`. Do this only on the throwaway staging DB.
- **Bad branch / commit on `develop`:** revert the offending merge
  commit with `git revert -m 1 <merge-sha>` on a `hotfix/...` branch,
  then merge back into `develop`. **Do not force-push `develop`.**

## What NOT to deploy / what NOT to do

- ❌ Do **not** run `netlify deploy --prod`.
- ❌ Do **not** point staging at `audgen.netlify.app` or any prod
  domain.
- ❌ Do **not** set production Stripe / Twilio / Resend keys on the
  staging site.
- ❌ Do **not** point staging at the production DB.
- ❌ Do **not** push `develop` to the original repo
  (`PresenceLabs-AuditGenerator`).
- ❌ Do **not** auto-deploy `main` from staging — `main` is an orphan
  on the safe repo.

## Notes for the operator

- Staging deploys do not require the OpenClaw agent. Netlify pulls
  from GitHub and builds on its own infra. The OpenClaw operator's job
  is the **code** going into `develop`, not pushing the actual deploy.
- If you want me to attempt a `netlify deploy --build` (no `--prod`),
  you need to either install Netlify CLI on this host and provide
  `NETLIFY_AUTH_TOKEN` + the staging site id in a separate message, or
  use Netlify's GitHub-side continuous deployment which doesn't need
  me at all.

## Status today

- `develop` exists on safe repo, points to commit `3c0df14`.
- 188 / 188 tests pass, lint clean, build clean.
- Staging deploy: not attempted from this host (no CLI / no token / no
  site id). When the site exists and is wired to `develop`, the next
  Netlify build will pick this state up automatically.
