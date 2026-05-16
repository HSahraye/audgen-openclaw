# Presence Labs Audit Generator

Lead intake + audit generation platform for Presence Labs. This app supports internal sales workflows,
public audit sharing via signed links, async import jobs, and public lead ingestion for
`presencelabs.net` integration.

## Setup

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

## Environment

Review `.env.example` and configure:

- `DATABASE_URL` for local or hosted DB.
- `APP_AUTH_ENABLED`, `BETTER_AUTH_SECRET`, and `SESSION_SECRET`.
- `DEFAULT_WORKSPACE_SLUG` and `DEFAULT_WORKSPACE_NAME` for tenancy bootstrap.
- `AUDIT_LINK_SECRET` for signed public audit URLs.
- `PUBLIC_INGEST_API_KEY` + `PUBLIC_INGEST_API_SECRET` for presencelabs.net lead ingestion.
- Stripe values for webhook processing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- SaaS Stripe price IDs for subscription checkout (`STRIPE_SAAS_PRICE_STARTER`, `STRIPE_SAAS_PRICE_GROWTH`, `STRIPE_SAAS_PRICE_AGENCY`, `STRIPE_SAAS_PRICE_ENTERPRISE`).
- Optional ops values (`ADMIN_EMAILS`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`).
- Optional communication providers (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`, `POSTMARK_API_KEY` + `POSTMARK_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`).
- Optional automation runner protection (`AUTOMATION_RUNNER_SECRET` for `POST /api/automation/process`).

If model API keys are empty, the app uses deterministic local fallback generation.

## Commands

- `npm run dev` — local app
- `npm run build` — production build validation
- `npm run lint` — eslint with `--max-warnings 0`
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — run automated tests (vitest)
- `npm run check` — lint + typecheck + test (the local PR-able gate)
- `npm run db:push` — sync Prisma schema to configured database
- `npm run db:backfill:workspace` — attach legacy rows to default workspace
- `npm run db:bootstrap:saas` — seed default global SaaS plan rows
- `npm run db:bootstrap:automation` — seed default workflow automation rules
- `npm run db:migrate:deploy` — run production migrations
- `npm run db:generate` — regenerate Prisma client
- `npm run db:studio` — inspect leads

See [docs/local-postgres.md](docs/local-postgres.md) for a one-liner local Postgres setup.
See [CONTRIBUTING.md](CONTRIBUTING.md) for branch policy and PR rules.

## Deploy (Netlify)

1. Connect this repo to Netlify.
2. Ensure `netlify.toml` is detected.
3. Set required environment variables in Netlify dashboard.
4. Run database migration in CI/CD using `npm run db:migrate:deploy`.
5. Deploy to `app.presencelabs.net`.

## Public Integration (presencelabs.net)

- Public lead ingest endpoint: `POST /api/public/leads`
- Public status endpoint: `GET /api/public/audits/:jobId/status`
- Requests must include:
  - `x-presencelabs-key`
  - `x-presencelabs-ts`
  - `x-presencelabs-signature` (HMAC SHA-256 over `${timestamp}.${rawBody}`)

## Security Notes

- Internal routes are session-protected when `APP_AUTH_ENABLED=true`.
- Better Auth handles account/session lifecycle at `/api/auth/[...all]`.
- Public audit pages require signed tokens when auth is enabled.
- Website fetch logic blocks internal/private network targets.
- Public endpoints are rate-limited.

## Operations

- Monitor import jobs in the dashboard (retry/cancel supported).
- Stripe webhook endpoint: `POST /api/stripe/webhook` with idempotency protections.
- Automation runner endpoint: `POST /api/automation/process` for queued outreach + workflow monitors.
- Communication tracking endpoint: `POST /api/communication/events` for opens, clicks, replies, bounces, unsubscribes.
- Proposal events endpoint: `POST /api/proposals/events` for opens/reopens/acceptance lifecycle tracking.
- Unsubscribe endpoint: `GET /api/communication/unsubscribe` for compliant suppression lists.
- Critical actions and domain events are stored in DB (`AuditLog`, `EventLog`, `WebhookEvent`).
- Billing and usage settings: `/settings/billing` (workspace owner only).
- Internal ops tools: `/admin` and `/admin/health` (owner only).
