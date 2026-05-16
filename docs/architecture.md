# AuditGen architecture

A 5-minute orientation for new contributors and agents. Updated by Crestodian, 2026-05-16.

## Stack at a glance

```
Next.js 16 (App Router) + React 19
  ↓ rendering
TypeScript (strict) + Tailwind 4
  ↓ data
Prisma 6 → PostgreSQL
  ↓ auth
better-auth (session cookies)
  ↓ AI generation
Anthropic + Google Gemini providers (fall back to deterministic local)
  ↓ billing
Stripe (SaaS plans + per-audit billing)
  ↓ comms (optional, none called during dev)
Resend / Postmark (email) · Twilio (SMS/call)
  ↓ hosting
Netlify (@netlify/plugin-nextjs)
```

## The main flow (this is the product)

```
[Import Leads]
   ├── manual: /  → AuditDashboard "New Lead" form → src/app/actions/leads.ts.createLeadAction
   ├── CSV:     /  → ImportButton → src/app/actions/leads.ts.importLeadsCsvAction
   └── public:  POST /api/public/leads (HMAC-signed ingest from presencelabs.net)
       ↓
[Generate AI Audit]
   src/lib/audit-engine.ts.generateAudit
     ├── src/lib/billing/entitlements (gate by plan)
     ├── src/lib/generation/context   (workspace + template + branding)
     ├── src/lib/intelligence/engine  (scoring + recommendations + narratives)
     ├── src/lib/audit-scoring.ts     (pure lead score + package selection)
     └── localAssets + AI narratives  (audit page body)
       ↓ (persists to prisma.lead.auditJson / assetsJson / intelligenceJson)
[Share Audit]
   ├── token URL:  /audit/[id]?token=...  (HMAC-signed, expires)
   └── short link: /a/[slug]              (resolves slug → redirects to token URL)
       ↓ (every view tracked via /api/audit-view, billed and surfaced in dashboard)
[Prep Outreach]
   /prep/[id] → MeetingPrep page
     ├── shows objections (src/lib/objections.ts)
     ├── shows recommended sequence
     ├── one-tap mailto/sms/wa links (src/lib/communication/links.ts)
     └── AI reply assistant (src/lib/automation/reply-assistant.ts)
       ↓
[Track Follow-up]
   src/lib/pipeline/* (stages, action queue, daily brief, reply classifier)
   /brief, /call-today, /outreach, dashboard funnel tiles
       ↓
[Track Revenue]
   prisma.paymentLog from /api/payment-intent + Stripe webhook
   /settings/billing (subscription state) + admin/insights pages
```

## Directory map

```
src/
├── app/                     # Next.js App Router. Pages, route handlers, server actions.
│   ├── (root)/              # Landing dashboard at "/"
│   ├── audit/[id]/          # PUBLIC customer-facing audit page (token-gated)
│   ├── a/[slug]/            # PUBLIC short-link redirect to /audit/[id]
│   ├── prep/[id]/           # Sales rep's meeting-prep page
│   ├── outreach, brief,
│   │ call-today, research,
│   │ sequences, templates,
│   │ onboarding             # Internal dashboards (session-gated)
│   ├── settings/billing/    # Workspace billing UI
│   ├── admin/               # Owner-only operational pages
│   ├── api/                 # Route handlers (REST endpoints)
│   │   ├── audit-view/      # tracking
│   │   ├── auth/[...all]/   # better-auth glue (responses scrubbed for tokens)
│   │   ├── automation/      # automation runner
│   │   ├── billing/         # Stripe checkout + portal
│   │   ├── communication/   # provider event webhooks + unsubscribe
│   │   ├── health/          # liveness probe (NEW: shift 2 cycle)
│   │   ├── import-jobs/     # async lead import
│   │   ├── notifications/   # in-app notifications
│   │   ├── payment-intent/  # Stripe payment intent creation
│   │   ├── proposals/events/# proposal lifecycle webhooks
│   │   ├── public/          # presencelabs.net public ingest
│   │   └── stripe/webhook/  # Stripe webhook receiver
│   ├── robots.ts, sitemap.ts, loading.tsx, error.tsx, not-found.tsx
│   └── actions/             # Server actions (manual & CSV lead create, etc.)
│
├── components/
│   ├── ui/                  # Generic primitives: Skeleton, EmptyState
│   ├── brand/               # Logo, lockup
│   └── ...                  # Feature-specific: audit-dashboard, prep-action-card, ...
│
├── lib/
│   ├── audit-engine.ts      # generateAudit() orchestrator
│   ├── audit-scoring.ts     # pure scoring math (extracted from audit-engine)
│   ├── audit-links.ts       # signed URLs for /audit/[id]
│   ├── audit-slugs.ts       # /a/[slug] generator
│   ├── auth.ts, auth/       # better-auth wiring
│   ├── authz.ts             # API-route session/workspace assertion
│   ├── billing/             # plans, subscriptions, entitlements, usage, Stripe
│   ├── brand.ts             # product strings
│   ├── branding.ts          # workspace sender-name resolution
│   ├── communication/
│   │   ├── email/           # Resend + Postmark adapters (unsubscribeUrl XSS-safe)
│   │   ├── sms/             # Twilio adapter
│   │   └── links.ts         # mailto / sms / wa.me href builders
│   ├── csv.ts               # tiny CSV parser
│   ├── env.ts               # zod-validated process.env + LOG_LEVEL filter
│   ├── intelligence/
│   │   ├── collect/         # site fetch + signal extraction
│   │   ├── scoring/         # quality dimension scoring
│   │   ├── normalization/   # findings → buckets, strengths, pain points
│   │   ├── recommendations/ # offer, urgency, momentum, budget, close prob
│   │   ├── outreach/        # outreach angle generator
│   │   ├── narratives/      # AI-generated audit copy
│   │   ├── proposals/       # proposal intelligence
│   │   └── engine.ts        # top-level coordinator
│   ├── leads/               # lead form schema (validation, normalization)
│   ├── logger.ts            # JSON logger with secret redaction + LOG_LEVEL
│   ├── money.ts             # pricing math
│   ├── objections.ts        # static objection-response generator
│   ├── pipeline/            # stages, brief, action queue, reply classifier
│   ├── prisma.ts            # singleton Prisma client
│   ├── public-url.ts        # client-side base URL helpers
│   ├── templates/           # audit/outreach/offer template defaults + resolver
│   ├── types.ts             # shared type primitives
│   ├── url.ts               # server-side base URL helpers
│   ├── utils.ts             # cn() + formatRelativeTime()
│   └── workspace.ts         # workspace context + fallback scope
│
├── middleware.ts            # session-gates internal routes; allowlists public
└── globals.css              # Tailwind base + print stylesheet
```

## Key invariants (do not break without a plan)

1. **`schema.prisma` is Postgres-only.** SQLite files are dev-only and ignored.
2. **Every workspace-scoped query uses `withWorkspaceFallbackScope`** so tenant isolation is enforced consistently.
3. **`logger.*` is the only log entry point.** `console.*` is forbidden in production code — secret redaction happens in `logger.ts`.
4. **Public audit URLs are token-gated.** `verifyAuditAccessToken` runs before any business-name lookup on `/audit/[id]`. Token is HMAC + payload + exp.
5. **Server actions in `"use server"` files only export async functions.** Move helpers/constants to `src/lib/...` if you want to test them or share types.
6. **The audit page renders deterministically when AI keys are absent.** Audit generation falls back to `localAssets` in `audit-engine.ts`. Don't make it require the AI provider.

## Build / deploy outline

```
GitHub push to develop / autopilot/*
   ↓
GitHub Actions (.github/workflows/ci.yml)
   ├── npm ci
   ├── prisma generate
   ├── eslint --max-warnings 0
   ├── tsc --noEmit
   ├── vitest run
   └── next build
       ↓
(PR merge into main)
   ↓
Netlify (@netlify/plugin-nextjs)
   ├── npm run db:generate
   ├── npm run db:push      ⚠️ swap to db:migrate:deploy once we have a migration baseline (parking lot)
   └── npm run build
       ↓
app.presencelabs.net
```

## When something breaks at runtime

1. `GET /api/health` → 200 means the app process is alive; commit-ref tells you which deploy.
2. `/admin/health` → richer health card for the workspace owner.
3. Netlify function logs → JSON one-line records. `level=error` or `level=warn` to filter.
4. Sentry (if `SENTRY_DSN` set) → unhandled exceptions with the request shape.

## See also

- `CONTRIBUTING.md` — branch policy, commit style, PR rules.
- `AUTOPILOT_BACKLOG.md` — outstanding safe-task backlog.
- `NIGHT_REPORT.md` — recent agent-driven changes (current shift).
- `prisma/MIGRATION_PLAN_*.md` — proposed schema migrations awaiting approval.
- `docs/local-postgres.md` — local dev setup.
- `STAGING_PREVIEW_CHECKLIST.md` — what to check before any staging deploy.
- `TENANT_SCOPE_AUDIT_REPORT.md` — workspace isolation audit and deferred follow-ups.
