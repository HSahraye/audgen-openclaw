# Security policy

Thanks for taking the time to look at AuditGen with a security mindset.
We take this seriously. If you find an issue that could expose customer
data, escalate privilege, or affect the platform's integrity, please
report it via the steps below rather than disclosing it publicly first.

## Scope

In scope:
- The hosted application (production URLs and any staging surfaces).
- This repository's application code (Next.js app, API routes, server
  actions, Prisma access layer, auth/authz helpers, webhook handlers).
- Public-facing surfaces: signed audit links, public lead ingest, the
  Stripe webhook, communication-event webhooks.

Out of scope:
- Findings whose only impact is denial-of-service from a single attacker
  IP.
- Reports about missing security headers on third-party assets we don't
  control.
- Self-XSS that requires the victim to paste arbitrary content into
  their own browser tools.
- Vulnerabilities in dependencies that already have a fix and are
  patched within 7 days of disclosure.
- Social-engineering attacks against operators or customers.
- Physical attacks.

## How to report

**Please do not file a public GitHub issue for security bugs.**

Email security findings to: **security@presencelabs.net**

If you do not get an acknowledgement within 2 business days, send a
follow-up via WhatsApp / Signal to the operator phone on the project
contact list, or open a private GitHub Security Advisory on this
repository.

Include in the report:
- A clear description of the issue and impact.
- Step-by-step reproduction details (URLs, payloads, expected vs
  actual behaviour). Test accounts are fine; do not test against real
  customer data.
- Any logs, screenshots, or HAR captures that make the issue clear.
- Your preferred name for the credits section, if you want credit.

## Safe-harbour

We will not pursue legal action or report you for good-faith research
that:
- Does not access, modify, exfiltrate, or destroy data that isn't
  yours.
- Does not degrade or interrupt service for our customers.
- Does not violate the privacy of users (including by reading their
  data or sessions beyond what's strictly necessary to demonstrate
  the issue).
- Reports through this policy before public disclosure and gives us
  reasonable time to fix.

Reasonable time means at minimum 60 days for high-severity issues and
30 days for lower-severity issues, or sooner if we ship a fix.

## What we promise

- Acknowledge your report within 2 business days.
- Provide an initial severity assessment within 5 business days.
- Keep you updated as we triage and fix.
- Credit you publicly when the fix ships, if you want credit.
- Not retaliate against good-faith researchers operating inside this
  policy.

## What we don't do

- We don't pay bug bounties today. We will revisit this when the
  product is generating meaningful revenue.
- We don't sign NDAs to receive vulnerability reports. We do
  coordinate disclosure timelines.
- We don't grant pre-authorization for active exploitation against
  production. If your test would visibly affect another customer's
  workspace, stop and tell us first.

## Architecture invariants we enforce

Security work in this repo follows these invariants. PRs that violate
them are blocked.

1. **Single-tenant safety.** Every workspace-scoped Prisma query
   includes a strict `workspaceId` filter. Helpers in
   `src/lib/workspace.ts` and `src/lib/authz.ts` are the only correct
   entry points.
2. **Session > input.** `workspaceId` is always derived from the
   authenticated session, never from request body, query string, or
   header. The exception is signed audit-link prospects (signature
   verifies the leadId binding) and HMAC-signed webhooks (signature
   verifies the message integrity).
3. **Fail closed.** Auth gates return `notFound()` (404), not 403, to
   avoid advertising the existence of protected routes.
4. **HMAC every inbound webhook.** Public ingest + communication
   events + future webhook surfaces verify a provider signature with
   timestamp freshness.
5. **Idempotent writes.** Stripe / webhook / public ingest writes are
   keyed on a provider event id and stored in `WebhookEvent`.
6. **No secrets in logs.** Use `redactSecrets()` for any object that
   might contain tokens, API keys, or session strings.
7. **All pricing math goes through `src/lib/billing/*`.** Never
   compute a price inline in a route.
8. **The audit is the unit of truth.** Prep, outreach, and proposal
   all reference the audit they were derived from.

## Hall of fame

We'll credit researchers here as fixes ship. None yet \u2014 be the first.
