# Branch Audit Report

## Scope
Safe working repo only: `HSahraye/audgen-openclaw`. The original repo
`HSahraye/PresenceLabs-AuditGenerator` is read-only here (push URL set
to a `DISABLED:` sentinel locally so any `git push origin ...` fails
loudly).

## Baseline note

Two unrelated `main` histories exist in scope:
- **Local `main`** (used as the integration base for every feature
  branch shipped this week): HEAD `8bfac4a Fixed hero section and
  organized the reveniew cards`. This is the original repo's `main`
  snapshot, fetched into the local tracker but never pushed onward.
- **`audgen-openclaw/main`** (the safe repo's `main` on GitHub):
  HEAD `9732cc2 Initial commit`. A separate orphan history GitHub
  created when the safe repo was first initialized.

Every feature branch on the safe repo branches from the **local-main
baseline** (`8bfac4a`), not from `audgen-openclaw/main`. The cleanest
path forward is to build `develop` from the local-main baseline and
treat `audgen-openclaw/main` as the empty placeholder it is today. We
do **not** force-push or rewrite `audgen-openclaw/main`.

When you're ready to publish a real baseline on `audgen-openclaw`,
that's a separate explicit decision (we'd PR `develop` → `main`).

## Totals

- 48 branches on `audgen-openclaw` (remote).
- 1 local-only working branch (`preview/integrated-demo`, already
  pushed earlier today).

## A. Permanent branches

| Branch | Notes |
|---|---|
| `main` (local + `origin/main`) | Stable baseline at `8bfac4a`. Source-of-truth for every feature branch. Do not push directly. |
| `audgen-openclaw/main` | Orphan single-commit history on the safe repo. Leave alone. |
| `develop` | **Does not exist yet.** This report's job is to plan its creation. |

## B. Security branches (FOLD INTO `develop`)

| Branch | Recommendation | Risk |
|---|---|---|
| `security/admin-auth-hardening` | **MERGE** — admin allowlist gate, session-token scrub, legacy pw rate-limit, CSP/HSTS headers, root-cause auto-elevation fix. Foundation for everything downstream. | low |
| `security/audit-view-hardening` | **MERGE** — signed-token-or-owner gate. | low |
| `security/payment-intent-hardening` | **MERGE** — signed-token-or-owner gate. | low |
| `security/proposals-events-hardening` | **MERGE** — drop client-supplied `workspaceId` IDOR fix. | low |
| `security/communication-events-hardening` | **MERGE** — HMAC webhook + IDOR fix. | low |

## C. Product feature branches

### C1. CRM spine (FOLD INTO `develop`)

| Branch | Recommendation |
|---|---|
| `feature/lead-stage-model` | **MERGE** — `LeadStage` enum + transition helper. |
| `feature/pipeline-counters` | **MERGE** — `getPipelineMetrics()` + pure composer. |
| `feature/reply-logging-manual` | **MERGE** — `logManualReply()`. |

### C2. Visible workflow (FOLD INTO `develop`)

| Branch | Recommendation |
|---|---|
| `feature/dashboard-funnel-tiles` | **MERGE** — tiles row on `/`. |
| `feature/reply-ui-on-prep` | **MERGE** — reply logger on `/prep/[id]`. |
| `feature/outreach-personalization-validator` | **MERGE** — 4-signal validator (pure). |
| `feature/daily-brief-pipeline-state` | **MERGE** — `buildPipelineDailyBrief()`. |

### C3. Intelligence (FOLD INTO `develop`)

| Branch | Recommendation |
|---|---|
| `feature/scoring-feedback-loop-skeleton` | **MERGE** — read-only aggregation. |
| `feature/outcome-analytics-by-vertical-city` | **MERGE** — funnel rollups by vertical + city. |
| `feature/reply-classifier-v1` | **MERGE** — heuristic classifier. |

### C4. Demo / positioning (FOLD INTO `develop`)

| Branch | Recommendation |
|---|---|
| `feature/landing-copy-ai-sales-os` | **MERGE** — public `/about` + brand strings. |
| `feature/demo-data-seed-script` | **MERGE** — idempotent seeder, refuses prod by default. |

### C5. Extras built but NOT in this consolidation pass

These are completed, tested, and on the safe repo but explicitly
**not** in the develop merge list per the new instructions. They stay
on their feature branches and can be merged in a later cycle when we
deliberately scope a `feature/*-wired` round.

| Branch | Why skipped today |
|---|---|
| `feature/outreach-validator-wired` | UI wire on top of the validator; reserve for a UI polish cycle. |
| `feature/daily-brief-on-brief` | UI wire on top of the brief helper. |
| `feature/next-best-action` | Helper. |
| `feature/next-best-action-on-prep` | UI wire. |
| `feature/vertical-pack-scaffold` | Vertical packs (dental/smoke/hvac). |
| `feature/vertical-pack-prep-wiring` | UI wire. |
| `feature/team-roles-permissions-plan` | Helper + migration plan. |
| `feature/usage-limits-plan` | Helper. |
| `feature/billing-plan-enforcement-plan` | Helper. |
| `feature/enforce-import-jobs-billing` | UI wire. |
| `feature/onboarding-wizard-helper` | Helper. |
| `feature/onboarding-wizard-ui` | UI wire. |
| `feature/activity-emit-on-import` | Side-effect wire. |

## D. Docs / report branches

### D1. Source-of-truth docs (FOLD INTO `develop`)

| Branch | Recommendation |
|---|---|
| `docs/saas-roadmap` | **MERGE** — SaaS roadmap v1. |
| `docs/gtm-sales-playbook` | **MERGE**. |
| `docs/onboarding-checklist-agencies` | **MERGE**. |
| `docs/demo-walkthrough` | **MERGE**. |

### D2. Companion docs (SKIP this pass, useful later)

| Branch | Notes |
|---|---|
| `docs/saas-roadmap-v2` | Layered revision on v1; revisit when `develop` is stable. |
| `docs/investor-and-sales-positioning` | Investor framing; keep available, merge in a `docs/*` round. |
| `docs/security-md` | SECURITY policy. Should land soon; not in this initial cleanup. |
| `docs/integration-todo` | Snapshot index; will be replaced by `DEVELOP_INTEGRATION_REPORT.md`. |
| `docs/safe-preview-deploy-report` | Snapshot; superseded by `STAGING_PREVIEW_CHECKLIST.md`. |

### D3. Daily reports (LEAVE)

| Branch | Notes |
|---|---|
| `docs/daily-report-2026-05-15` | Historical snapshot. Keep, do not merge. |
| `docs/daily-report-2026-05-15-cycle2` | Historical snapshot. |
| `docs/daily-report-2026-05-15-cycle3` | Historical snapshot. |
| `docs/daily-report-2026-05-15-cycle4` | Historical snapshot. |
| `docs/daily-report-2026-05-15-cycle6` | Historical snapshot. |
| (cycle5 was never pushed) | Local-only stub. |

These are write-ahead operator logs, not source code. Don't merge.

## E. Broken / conflicting branches

None observed. The 21 branches in the integrated preview pass
(`preview/integrated-demo`) all merged with strategy `ort`, zero
conflicts. The branches in C5 also build cleanly individually; they're
just held back from this cleanup pass by design.

## F. Obsolete / noisy branches

| Branch | Notes |
|---|---|
| `preview/integrated-demo` | One-shot consolidation branch. Now superseded by `develop`. **Do not delete** per policy; archive label can be added later. |

## G. Unknown / out-of-scope

None.

## Recommended merge order into `develop` (this cycle)

1. Security foundation (5 branches, low risk, hardens later code).
2. CRM spine (3 branches, additive new files).
3. Visible workflow (4 branches).
4. Intelligence (3 branches, additive new files).
5. Demo / positioning (2 branches).
6. Docs foundation (4 branches).

Total: **21 branches** (same set as `preview/integrated-demo`).
Empirically merges with zero conflicts in this exact order.

## Risks

- **`audgen-openclaw/main` is an orphan history.** Future PRs from
  `develop` to `main` will be a normal merge once we publish the real
  baseline; until then `develop` is the only meaningful branch on the
  safe repo.
- **`develop` will be the staging branch.** Whatever you point Netlify
  staging at must be `develop`, not `main`. This is documented in
  `STAGING_PREVIEW_CHECKLIST.md` (Phase 2).
- **The 13 branches in C5 are completed but parked.** If we later
  decide to push the full stack to staging, that's a separate
  integration cycle on top of `develop`.

## Next step

Proceed to T2 — create `develop` from local `main` (`8bfac4a`),
inspect, then merge the 21 prioritised branches in the order above.
