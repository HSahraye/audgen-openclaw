# Tenant-Scope Audit Report

> Pass executed on `develop` after Sprint 2 (commit `bd3b8b6`). Goal:
> walk every API route and identify any path where `workspaceId` is
> trusted from client input instead of derived from the authenticated
> session or a signed payload.

## Method

For each `src/app/api/**/route.ts` on `develop`, check:
1. How does `workspaceId` enter the handler (session, query, body,
   header, deterministic lookup from a signed/HMAC'd input)?
2. Is the caller authenticated, signature-verified, or both?
3. Does any DB write occur on the untrusted `workspaceId` value?

## Summary

| Route | Auth | workspaceId source | Verdict |
|---|---|---|---|
| `/api/audit-view` POST | signed audit token OR session owner | `lead.workspaceId` (looked up) | ✅ |
| `/api/auth/[...all]` | better-auth catch-all + token-scrub wrapper | n/a | ✅ |
| `/api/auth/logout` POST | better-auth signOut | n/a | ✅ |
| `/api/automation/process` POST | optional `AUTOMATION_RUNNER_SECRET` | scans ALL workspaces | ⚠️ (see below) |
| `/api/billing/checkout` POST | session role=owner | session | ✅ |
| `/api/billing/portal` POST | session role=owner | session | ✅ |
| `/api/communication/events` POST | HMAC OR session matching outbound msg | derived from OutboundMessage | ✅ |
| `/api/communication/unsubscribe` GET | none (email/SMS link) | **URL query param** | 🟡 fixed (rate-limit added) + plan documented |
| `/api/import-jobs` GET/POST | `assertApiSessionWorkspace` | session | ✅ |
| `/api/import-jobs/[id]` GET/POST | `assertApiSessionWorkspace` | session | ✅ |
| `/api/import-jobs/[id]/run` POST | `assertApiSessionWorkspace` | session | ✅ |
| `/api/leads/[id]/timeline` GET | `getCurrentSession()` + 401 | session | ✅ |
| `/api/notifications` GET | `getCurrentSession()` + 401 | session | ✅ |
| `/api/notifications/[id]` POST | `getCurrentSession()` + 401 | session | ✅ |
| `/api/payment-intent` POST | signed audit token OR session owner | `lead.workspaceId` (looked up) | ✅ |
| `/api/proposals/events` POST | signed audit token OR session matching lead | `lead.workspaceId` (looked up) | ✅ |
| `/api/public/audits/[id]/status` GET | none | `withWorkspaceFallbackScope(getWorkspaceContext())` | 🟡 follow-up |
| `/api/public/leads` POST | HMAC `x-presencelabs-signature` + timestamp | `getWorkspaceContext()` default workspace | 🟡 follow-up |
| `/api/stripe/webhook` POST | Stripe signature | `event.metadata.workspaceId` → `customer.stripeCustomerId` lookup → fallback default | 🟡 follow-up |

## Detailed findings

### 🟢 No issue (most routes)

The bulk of `develop`'s routes are clean post-Sprint-1: they derive
`workspaceId` from `assertApiSessionWorkspace()` (the helper introduced
on `security/admin-auth-hardening`) or from a verified payload.

### 🟡 Fixed this pass — `/api/communication/unsubscribe`

**Issue:** the unsubscribe endpoint takes `workspaceId` from the query
string and writes to `UnsubscribedContact` keyed on it. An attacker
who learns a tenant's `workspaceId` (e.g. by scraping logs or guessing
cuids) can post a stream of (email, phone) pairs to grief that
tenant's suppression list.

**Fix shipped this pass:** per-IP rate limit
(`enforceRateLimit("communication-unsubscribe", 60, 60_000)`) so
forged-spam is throttled.

**Why the full fix is deferred:** the unsubscribe URL is shipped in
emails / SMS messages that may already be in flight; signing the
link with an HMAC over `(workspaceId, email|phone, ts)` like
`/audit/[id]` does would invalidate existing unsubscribe links. That's
a behaviour change that needs explicit owner approval and a coordinated
rotation. Plan documented below.

### 🟡 Follow-up — `/api/public/audits/[id]/status`

**Issue:** GET-only public status endpoint. Uses
`getWorkspaceContext()` (i.e. the platform Default Workspace fallback)
combined with `withWorkspaceFallbackScope`. The lookup then matches
`import-job.id` against that scope. Because `withWorkspaceFallbackScope`
is **strict by default on `develop`** (post-`security/admin-auth-hardening`),
this currently returns a job only when its `workspaceId` matches the
Default Workspace. So the endpoint is largely inert today — it shows
only Default Workspace import jobs to anonymous callers, which is
already nothing useful unless the Default Workspace is being used as
a real working tenant.

**Severity:** low. Only the platform's own Default Workspace is
exposed, no PII, only progress counters.

**Recommended fix (deferred):** turn this endpoint into a signed-link
shape: include an HMAC of the `import-job.id` in the URL produced by
the public ingest path. Verify the signature here and resolve
workspace from the job row. Same pattern as `audit-links.ts`. Not
behaviour-breaking unless someone hard-codes the URL.

### 🟡 Follow-up — `/api/public/leads`

**Issue:** the HMAC signature is verified properly (good), but
`workspaceId` is then set to `getWorkspaceContext().workspaceId` —
the platform Default Workspace. There's no per-tenant routing in the
ingest signature itself. So every signed public ingest lands in the
Default Workspace regardless of which customer's
`PUBLIC_INGEST_API_KEY` was used.

**Severity:** medium. If `presencelabs.net` ever signs ingestion for
multiple AuditGen tenants (which is the long-term plan documented in
the SaaS roadmap), they'd cross-contaminate today.

**Recommended fix (deferred):** add a `workspaceId` to the HMAC
payload (`ts.workspaceId.rawBody`) and have the server verify the
workspace exists. Requires `presencelabs.net` to update its signer
too — coordinate with whoever owns that integration before changing
the contract. Plan in `TENANT_SCOPE_FIX_PLAN.md` (not in this branch).

### 🟡 Follow-up — `/api/stripe/webhook`

**Issue:** Stripe events are verified via Stripe signature (good).
The handler then resolves the target workspace in order of
preference:
1. `event.metadata.workspaceId` if present on the Stripe object.
2. `workspace.stripeCustomerId == event.customer` (one row).
3. Falls back to the Default Workspace.

The fallback is the worry: a malformed Stripe event (or a customer
whose `stripeCustomerId` got nulled) lands in the Default Workspace.
For most events this means a SaaS subscription change is applied to
the wrong tenant.

**Severity:** medium. Stripe webhook signature already prevents
spoofing, so an external attacker can't trigger this. The fallback
only matters if our own data is misconfigured.

**Recommended fix (deferred):** refuse the event when both metadata
and customer-id lookup fail. Surface an alert so an operator notices.
This is a small change but touches a webhook with idempotency and
billing implications; it needs a careful PR + manual replay test.

### ⚠️ `/api/automation/process` — runner secret optional

**Issue:** the route guards behind `env.AUTOMATION_RUNNER_SECRET` if
set, but **does nothing if the env var is unset**. In that case any
anonymous caller can run the full automation pass over every
workspace (sequence processing, outbound queue, workflow monitors).

**Severity:** medium in dev (acceptable; operators expect this), high
in any production deploy that forgets the env var.

**Recommended fix (deferred):** make `AUTOMATION_RUNNER_SECRET`
**required** when `NODE_ENV=production`; refuse the request if it's
missing. Until then: the existing `assertProductionEnv()` helper in
`src/lib/env.ts` should add this to its production check.

## Actions this pass

- ✅ Added per-IP rate limit on `/api/communication/unsubscribe` and an
  inline `SECURITY note` block explaining the deferred full fix.
- ✅ This report documents three remaining tenant-scope risks that
  require coordinated changes (HMAC contract updates, env-var
  validation tightening, customer rotation) and are therefore
  deferred with named follow-up branches.

## Recommended follow-up branches

| Branch | Risk addressed | Scope |
|---|---|---|
| `security/unsubscribe-signed-link` | unsubscribe forgery | sign the unsubscribe URL (same shape as audit-links); cut over existing senders. Needs owner approval. |
| `security/public-ingest-tenant-binding` | public ingest cross-contamination | extend HMAC payload to include workspaceId; coordinate with `presencelabs.net` signer. |
| `security/stripe-webhook-no-default-fallback` | misrouted Stripe events | refuse events without a resolvable workspace; emit operator alert. |
| `security/automation-runner-secret-required` | anonymous automation runs | enforce `AUTOMATION_RUNNER_SECRET` in production via `assertProductionEnv()`. |

Each is a small focused change. They are NOT bundled into this
report's branch because each one is a behaviour change that touches a
live caller (presencelabs.net signer, Stripe webhook, email
unsubscribe links). Owner approval before each.

## Acceptance

- This audit report is a one-pass scan. Re-run after any new API route
  is added or any helper-level change to `getWorkspaceContext` /
  `assertApiSessionWorkspace`.
- No existing routes were silently changed; the only behaviour change
  this pass is the per-IP rate limit on `/api/communication/unsubscribe`.
