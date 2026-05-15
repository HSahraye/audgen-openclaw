# AuditGen — SaaS Roadmap

> A sales operating system for agencies and inside-sales teams who sell to
> local businesses. Built around one core loop:
>
> **import → score → audit → prep → contact → reply → follow-up → close → learn.**

This document is the strategic source of truth for what AuditGen is, who it
serves, and what we ship next. It is intentionally opinionated. If a feature
or refactor does not measurably improve the loop above, it does not ship.

---

## 1. Product vision

AuditGen turns a list of local businesses into closed revenue, automatically:

1. **Ingest** business lists (CSV, scraped GBP/Yelp, partner CRMs).
2. **Score** each lead with vertical- and geography-aware signals.
3. **Audit** the business — generate a credible, evidence-backed presence
   audit (mobile, on-page, trust signals, local SEO, reviews, competitors).
4. **Prep** the seller: 30-second pitch, three real pain points,
   conversation outline, post-call email, proposal frame, price guidance.
5. **Contact** the prospect across email / SMS / call with channel-aware
   templates that don't sound templated.
6. **Track replies** and outcomes; classify them; pipe the signal back.
7. **Follow up** on a tuned, per-vertical cadence; never spam.
8. **Close** with proposals that auto-personalize from the audit, with
   pricing recommended by historical win data.
9. **Learn** from every outcome: which signals predict close, which copy
   converts, which verticals are healthy, what the right price is.

The product is not "AI generates an audit." It is "AI runs the loop a good
agency rep runs, faster and with memory."

## 2. Target ICP (first wave)

**Primary:** Boutique digital agencies and freelance operators (1–10 people)
selling websites, SEO, ads, automation, AI services, or local-presence
packages to local US businesses ($500–$5,000 ACV).

**Secondary:** Vertical-specialist agencies (e.g. one that only does dental,
or one that only does HVAC) whose entire pipeline is local.

**Tertiary (later phases):** Internal SDR/AE teams at B2B SaaS where the
buyer behaves like a local business buyer (SMB-tier insurance, accounting,
real estate, recruiting, etc.).

**Anti-ICP:** enterprise sales teams selling to F500 (different motion,
different tools), e-commerce stores selling to consumers (different stack
entirely), anyone who needs to import 50,000 leads/day on day one.

## 3. Core modules

| Module | Status today | Where it lives in the codebase |
|---|---|---|
| Lead intake (CSV + API) | shipped | `src/app/api/import-jobs`, `src/app/api/public/leads`, `src/lib/import-jobs.ts` |
| Lead scoring | shipped (rule-based) | `src/lib/intelligence/scoring`, `src/lib/intelligence/selectors` |
| Audit generation | shipped (LLM + fallback) | `src/lib/audit-engine.ts`, `src/lib/generation` |
| Audit publishing (signed links) | shipped | `src/app/audit/[id]`, `src/lib/audit-links.ts`, `src/app/a/[slug]` |
| Prep / pitch / pain | shipped | `src/app/prep/[id]`, `src/lib/intelligence/*` |
| Outreach (email/SMS templates, sequences) | partial | `src/lib/automation/outreach`, `src/lib/communication`, `src/app/sequences` |
| Proposals (value, guarantee, pricing) | partial | `src/lib/intelligence/proposals`, `src/app/api/proposals/events` |
| Pipeline / stages | minimal | inferred from `EventLog`, no first-class stage model |
| Reply tracking / classification | not built | (gap) |
| Daily brief | shipped (basic) | `src/app/brief/page.tsx` |
| Workspaces / RBAC | partial | `Workspace`, `Membership`, see `src/lib/auth.ts` |
| Billing | shipped (Stripe trial + plans) | `src/lib/billing`, `src/app/api/billing`, `src/app/settings/billing` |
| Admin ops | hardened on `security/admin-auth-hardening` | `src/app/admin`, `src/lib/authz.ts` |
| Observability | partial | `src/lib/observability`, `EventLog`, `AuditLog`, `WebhookEvent` |
| Learning loop / outcome feedback | not built | (gap) |

## 4. Data model (target shape)

The existing Prisma schema already has most of the entities below. The
roadmap-critical additions are marked **(new)**.

- **Workspace** — tenant container. Plan, status, trial, owner.
- **Membership** — User ↔ Workspace ↔ Role (owner/admin/member/sales/viewer).
- **User** — identity (better-auth).
- **Lead** — business record; the unit of work.
- **LeadStage (new, derived or stored)** — `new → contacted → replied → booked → audit_sent → proposal_sent → won → lost`.
- **Audit** — generated audit attached to a Lead.
- **Prep** — generated pitch/pain/proposal bundle attached to a Lead.
- **Sequence / SequenceStep** — outreach plan.
- **Contact / ContactChannel** — per-lead contactability (email, phone, SMS, web form, in-person).
- **Activity (new)** — append-only log: outbound sent, opened, clicked, replied, called, voicemail, meeting booked, no-show, demo, proposal sent, signed.
- **Reply (new)** — captured inbound (manual or via webhook), classified.
- **Outcome (new)** — final state per opportunity (won amount, lost reason).
- **OutcomeSignal (new)** — links a closed outcome back to the signals that predicted it (score, vertical, copy variant, channel).
- **ImportJob, EventLog, AuditLog, WebhookEvent, AiUsageLog** — already exist.
- **Subscription, Plan, UsageMetric** — already exist (billing).

Single-tenant invariant: every workspace-scoped row carries `workspaceId`.
We enforce this in code via `strictWorkspaceScope()` and at the boundary via
`assertSessionWorkspace()` (introduced in `security/admin-auth-hardening`).

## 5. Roadmap phases

### Phase 0 — Security foundation *(in flight)*
Branch: `security/admin-auth-hardening` (pushed to `audgen-openclaw`).

- [x] Platform-admin allowlist gate on `/admin` and `/admin/health`.
- [x] Remove cross-tenant auto-elevation in `listWorkspacesForUser`.
- [x] Strip `token` from `/api/auth/list-sessions` and `/get-session`.
- [x] Rate-limit + gate legacy shared-password fallback.
- [x] Default CSP / Referrer-Policy / Permissions-Policy / COOP / CORP / XFO / HSTS / nosniff.
- [x] `withWorkspaceFallbackScope` strict by default; opt-in via env.
- [x] Harden `POST /api/import-jobs` (session + body + origin + rate-limit).
- [ ] Harden `/api/audit-view`.
- [ ] Harden `/api/payment-intent`.
- [ ] Harden `/api/proposals/events`.
- [ ] Harden `/api/communication/events`.
- [ ] Backfill orphan rows (workspaceId NULL) into a real workspace and drop the env flag.
- [ ] Move CSP to nonce-based via `middleware.ts`; drop inline allowances.
- [ ] Add `SECURITY.md` with disclosure contact and safe-harbor.

### Phase 1 — Sales engine foundations
- [ ] First-class `LeadStage` (column on `Lead` or derived view), with stage transitions logged in `Activity`.
- [ ] `Activity` model and append-only ledger; helpers in `src/lib/pipeline/activity.ts`.
- [ ] Pipeline dashboard counters: contacted / replied / booked / proposal / won / lost (24h, 7d, 30d, all-time).
- [ ] Daily brief rebuilt off pipeline state, not just freshness.
- [ ] Conversion funnel chart (per workspace, per vertical, per template).

### Phase 2 — Reply + outcome intelligence
- [ ] Manual reply logging UI on `/prep/[id]`.
- [ ] Reply classifier (positive / negative / ask-for-info / out-of-office / unsubscribe / wrong-person).
- [ ] Next-best-action engine: given a Lead's current state + reply class + history, return the recommended next move.
- [ ] Outcome capture (won amount, lost reason, ICP fit retro).
- [ ] `OutcomeSignal` write-back: feed closed outcomes into the scoring model so the score actually predicts close.

### Phase 3 — Outreach quality
Outreach prep must read like a human read the site. Every generated outreach
artifact must include all four:
  1. one **real audit-specific issue** (cite which check fired).
  2. one **business-specific detail** (their name, their service, a phrase from their copy).
  3. one **local / review / search / competitor signal** (review count, ranking, competitor density).
  4. one **clear next action** (call-back time, demo slot, signed audit link).

No fake revenue claims unless the assumption sheet is shown alongside.
Add a "Show my work" toggle that expands the assumption math.

### Phase 4 — Team / SaaS readiness
- [ ] Member invites (email + accept-invite link).
- [ ] Workspace roles enforced at the helper layer (`requireWorkspaceRole`).
- [ ] Plan-tier usage gates: leads/mo, audits/mo, AI tokens/mo, sequences active.
- [ ] Workspace-aware Stripe trial + dunning behavior.
- [ ] Onboarding wizard: connect domain → import sample CSV → run first audit → send first email → see first reply.
- [ ] In-app "what's broken / what to do next" health card.

### Phase 5 — Scale + learning loop
- [ ] Per-vertical / per-city template performance dashboards.
- [ ] Auto-pick winning template by Lead segment.
- [ ] Backfill ICP scoring from closed-won deals (logistic regression or simple gradient boost over `OutcomeSignal`).
- [ ] Public API for partner CRMs (HubSpot, Pipedrive, Close, Attio) — webhook in + push out.
- [ ] Multi-channel orchestrator: alternate email/SMS/voicemail-drop with throttle and quiet hours.

### Phase 6 — Reliability + observability
- [ ] Move rate-limit and failed-auth state out of in-memory (Redis or Postgres-backed table).
- [ ] Add structured logs (one JSON line per request) with workspaceId, route, latency, status.
- [ ] Synthetic monitoring against the public ingest + audit-view endpoints.
- [ ] Per-workspace usage and cost dashboards.

## 6. Revenue model

| Tier | Price/month | Includes | Designed for |
|---|---|---|---|
| Free Trial | $0 / 14 days | 50 leads, 25 audits, full feature access | new agencies |
| Starter | $99 | 500 leads/mo, 200 audits/mo, 1 seat | solo operators |
| Growth | $299 | 2,000 leads/mo, 800 audits/mo, 3 seats, sequences | small agencies |
| Agency | $799 | 10,000 leads/mo, 4,000 audits/mo, 10 seats, white-label audit pages | mid agencies |
| Enterprise | custom | unlimited + SLA + dedicated support | inside-sales teams |

Unit economics:
- Variable cost per audit ≈ LLM tokens + 1 page render + 1 storage write. Target < $0.05.
- Variable cost per lead ingest ≈ 1 dedupe + 1 row + optional enrichment. Target < $0.005.
- Gross margin target ≥ 80% at the Growth tier.

Add-ons (later): enrichment credits, voicemail drops, SMS volume, custom domain on audit links.

## 7. Moat

Defensibility, in order of strength:
1. **Outcome data.** Every closed deal teaches the scorer and the copy
   picker. After 10k closed-won outcomes the system out-performs any
   generic LLM prompt because it has seen what worked, in *this* vertical,
   in *this* geography, at *this* price.
2. **Workflow lock-in.** Pipeline + reply history + sequences = the rep's
   working memory. Once a team's last 90 days of outreach are in AuditGen,
   they don't churn casually.
3. **Audit credibility.** A real, evidence-grounded audit page that reads
   like a human wrote it is the wedge product. Hard to clone in a weekend.
4. **Integration breadth.** Stripe, email/SMS providers, partner CRMs,
   public ingest from presencelabs.net. Each integration is a small wall,
   the bundle is the moat.

Not the moat: LLM choice, fancy UI, "AI" in the name.

## 8. Architecture invariants

These don't change without an ADR.

1. **Single-tenant safety:** every workspace-scoped Prisma query MUST
   include `workspaceId`. Use `strictWorkspaceScope()` from `src/lib/workspace.ts`.
2. **Session > input:** workspaceId is always derived from the authenticated
   session, never from request body/query/headers. Use `assertApiSessionWorkspace()`.
3. **Fail closed:** auth gates return `notFound()` not `403`. Don't advertise routes.
4. **HMAC for inbound webhooks:** every external write endpoint verifies a
   provider signature (`verifyHmacSignature`).
5. **Idempotent writes:** Stripe / webhook / public ingest writes are keyed
   on a provider event id and stored in `WebhookEvent`.
6. **No secrets in logs.** Use `redactSecrets()` for any object that may
   contain tokens, API keys, or session strings.
7. **All money math goes through `src/lib/billing/*`.** Never compute price
   inline in a route.
8. **The audit is the unit of truth.** Prep, outreach, proposal all
   reference the audit they were derived from.

## 9. Next 10 engineering tasks

In order. Each one fits in a single focused branch.

1. **`security/audit-view-hardening`** — replace `getWorkspaceContext()`
   fallback in `src/app/api/audit-view/route.ts` with either signed-link
   verification or `assertApiSessionWorkspace()`. Decide path by reading
   the existing public/audit signing model.
2. **`security/payment-intent-hardening`** — same treatment for
   `src/app/api/payment-intent/route.ts`. Workspace must come from the
   authenticated session and the price must come from Stripe/`Plan` only,
   never from the request body.
3. **`security/proposals-events-hardening`** — `src/app/api/proposals/events/route.ts`.
   Decide: internal-only (session-required) or provider-signed (HMAC). No
   anonymous default-workspace writes.
4. **`security/communication-events-hardening`** — `src/app/api/communication/events/route.ts`.
   This is almost certainly an inbound provider webhook (Resend / Postmark / Twilio):
   require an HMAC signature per provider and a `WebhookEvent` idempotency row.
5. **`feature/lead-stage-model`** — add `LeadStage` enum + `Lead.stage` column,
   `Activity` model, helpers to transition stages and append activity.
6. **`feature/pipeline-counters`** — dashboard tiles: contacted / replied /
   booked / proposal / won / lost across 24h / 7d / 30d.
7. **`feature/reply-logging-manual`** — UI on `/prep/[id]` to log a reply
   manually with classification dropdown; writes `Reply` + `Activity`.
8. **`feature/outreach-real-signals`** — outreach prep MUST include the
   four-item structure from Phase 3. Add validator that fails the prep if
   any of the four is missing.
9. **`feature/onboarding-wizard`** — five-step wizard (workspace name →
   sample CSV import → first audit → first sequence → first reply log).
10. **`infra/redis-rate-limit`** — replace in-memory rate-limit + failed-auth
    state with a Postgres-backed table or Redis (decide by infra budget).

## 10. Out of scope (for now)

- Chrome extension for one-click audit.
- Mobile app.
- Native dialer / power-dialer (use Twilio click-to-call instead).
- Multi-language outreach.
- Public marketplace of audit templates.
- Salesforce integration.

These are all reasonable bets, but every one of them dilutes the loop. We
revisit after Phase 4 ships.

---

## Working notes

- **Original repo:** https://github.com/HSahraye/PresenceLabs-AuditGenerator (protected; do not push without explicit approval).
- **Safe development repo:** https://github.com/HSahraye/audgen-openclaw (operator-side experiments live here).
- **Branch hygiene:** never mix unrelated work in one branch. Prefixes: `security/`, `feature/`, `fix/`, `docs/`, `test/`, `infra/`.
- **Definition of done for any branch:** lint + test + build all green; touches only the files in scope; report appended to `DAILY_OPENCLAW_REPORT.md`.
