# Safe Preview Deploy Report

## Repo
- **Working:** `HSahraye/audgen-openclaw` (safe repo, the only push target).
- **Original (untouched, push DISABLED locally):** `HSahraye/PresenceLabs-AuditGenerator`.

## Branch
`docs/safe-preview-deploy-report` (this report).
Latest 6 commits on `main`:
```
8bfac4a Fixed hero section and organized the reveniew cards
497d056 Refine prep and audit link UX flow.
9b1d769 Add safe audit slug backfill validation
13aa519 fix: push prisma schema during netlify build
0b9054d fix: validate postgres database url in production
285bb41 fix: allow auth secret fallback in production env validation
```

Note: every feature/security branch from cycles 1–5 lives independently
on `audgen-openclaw` and is **not** merged into `main`. The preview
deploy below would publish whatever is on `main` today, not the
in-flight feature branches. Once a branch is merged into the safe-repo
`main`, the next preview will include it.

## Lint / test / build results

This cycle used the cost-capped 1× run policy.

| Step | Command | Result |
|---|---|---|
| Lint | `npm run lint` | clean (no ESLint errors or warnings) |
| Test | `npm test` | **52 / 52 passing** across 23 test files (~5 s) |
| Build | `npm run build` | clean Next.js 16.2.6 production build; all 38 routes compile |

Build output is locally available at `./.next/` (BUILD_ID dated this
cycle).

## Preview URL

**Not deployed.** Required ingredients to ship the safe preview:

1. Netlify CLI installed on this host (`npm i -g netlify-cli` or use a
   per-deploy `npx netlify-cli`). The host currently reports
   `(netlify CLI not installed)`.
2. A Netlify auth token in the environment as `NETLIFY_AUTH_TOKEN`
   (or `netlify login` interactive flow). Currently absent.
3. A Netlify site linked to this repo via either:
   - `.netlify/state.json` (currently absent), or
   - `netlify link --id <SITE_ID>` once authenticated.
4. Confirmation the target site is **not** `audgen.netlify.app` (the
   production site). Use a separate Netlify site, e.g.
   `audgen-openclaw-preview` or a draft-deploy on the same site with
   `netlify deploy` (no `--prod`).

When all four are present, the safe preview command is:
```
netlify deploy --build
```
which uploads to a draft URL (e.g. `https://<id>--<site>.netlify.app`)
**without** publishing to production. The `netlify.toml` in the repo
already pins:
```
[build]
  command = "npm run db:generate && npm run db:push && npm run build"
  publish = ".next"
```

⚠️ The `db:push` step in the build command will run a non-destructive
Prisma migrate against whichever `DATABASE_URL` Netlify provides. For a
**safe** preview that must NOT be the production database. Recommended
setup:

- A separate Postgres database for preview (Neon / Supabase free tier
  is fine). `DATABASE_URL` for the preview site points there.
- `BETTER_AUTH_SECRET`, `SESSION_SECRET`, `AUDIT_LINK_SECRET` set to
  fresh dev values (NOT production secrets).
- `ADMIN_EMAILS` set to your email so `/admin` is reachable for you only.
- `APP_AUTH_ENABLED=true` so security gating is active.
- Stripe / Twilio / email vars left unset, OR pointed at test-mode
  keys; this prevents real outreach / billing from the preview.

## Visible features to inspect (when the preview is up)

Today, `main` exposes:
- `/` — workspace dashboard (audit dashboard component).
- `/login` and `/signup` — better-auth email/password + legacy fallback.
- `/admin` and `/admin/health` — staff ops (gated; current `main` does
  not yet have the platform-admin allowlist from `security/admin-auth-hardening`).
- `/audit/[id]` and `/a/[slug]` — signed audit pages.
- `/prep/[id]` — meeting prep (pitch, pain, proposal outline).
- `/brief` — heuristic daily brief.
- `/call-today`, `/outreach`, `/research`, `/sequences`, `/templates`,
  `/automation/approvals`, `/settings/billing`.

After the next merge from the safe repo's feature branches, the
preview will additionally show:
- Funnel tiles row above the dashboard.
- Reply logger card on `/prep/[id]`.
- Personalization advisory under the 30-second pitch.
- Vertical-pack playbook on `/prep/[id]` (dental / smoke-shop / HVAC).
- Next-best-action strip at the top of `/prep/[id]`.
- Onboarding wizard card on `/`.
- Pipeline-state brief on `/brief`.

## Routes to open first (in this order)

1. `/signup` → create a test workspace, sign in.
2. `/` → confirm dashboard renders and lists leads.
3. `/prep/<any-lead-id>` → confirm prep page renders.
4. `/brief` → confirm daily brief renders.
5. `/settings/billing` → confirm plan tier shows.
6. `/admin` → confirm staff gate works (404 for non-admin once the
   hardening branch merges).

## Risks

1. **`netlify.toml` includes `npm run db:push` in the build command.**
   If a fresh DB is provided, Prisma will create the schema on first
   build (safe). If a populated DB is provided, the same command runs
   `prisma db push` which may attempt schema diffs. For a preview this
   should target a throwaway DB.
2. **`.env` not committed.** Every secret must be set on Netlify's
   environment side; nothing in this repo references real values.
3. **Production site `audgen.netlify.app` exists** per earlier recon.
   We are deliberately **not** deploying to it. Any preview must use a
   different Netlify site or a `--no-prod` draft.
4. **In-flight feature branches are not merged.** A preview built from
   `main` today will look like the pre-cycle-1 app. To preview the new
   features, branches need to land on `audgen-openclaw/main` first.

## Next task

Move directly to:
- **Task 2 — Stabilize preview deploy:** documented above; awaits
  Netlify CLI + token + site id on this host. Until then, deploy is
  blocked, so I will **skip this task and proceed** to the next
  highest-impact item that doesn't need deploy: queue items 6–10
  (UI polish, GTM landing copy, onboarding checklist, demo data
  mode, walkthrough doc).

If you want me to attempt the preview now: install Netlify CLI and
provide `NETLIFY_AUTH_TOKEN` (paste in a separate message; I will
redact and never persist it) along with the target site id or `--site
<id>` so I know which non-production site to use.

Until then: I'm not running `netlify deploy` and I'm not touching the
production site.
