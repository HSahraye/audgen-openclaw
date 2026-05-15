# AuditGen — Integration TODO

Single index of "what's built vs. wired vs. shipped" across the safe
repo's branches. Pair with `AUDITGEN_SAAS_ROADMAP.md` (the plan) and
`DAILY_OPENCLAW_REPORT.md` (the daily delta). The intent is to make it
easy to decide which two branches to merge next without re-reading the
whole tree.

Legend:
- ✅ branch shipped to safe repo (HSahraye/audgen-openclaw), tests + build green
- 🔌 wired into a UI surface (visible to the user once branches merge)
- 🧪 backend helper only; UI integration pending
- 📄 docs/plan only; not enforced yet
- ⏳ proposed-not-executed migration

## Phase 0 — Security ✅

| Item | Branch | State |
|---|---|---|
| Admin allowlist gate (/admin, /admin/health) | `security/admin-auth-hardening` | ✅ |
| Cross-tenant auto-elevation removed | `security/admin-auth-hardening` | ✅ |
| `/api/auth/list-sessions` token scrubbed | `security/admin-auth-hardening` | ✅ |
| Legacy shared-password rate-limited + gated out of /admin | `security/admin-auth-hardening` | ✅ |
| Default CSP / Referrer-Policy / Permissions-Policy / COOP / CORP / XFO / HSTS / nosniff | `security/admin-auth-hardening` | ✅ |
| `withWorkspaceFallbackScope` strict by default | `security/admin-auth-hardening` | ✅ |
| `POST /api/import-jobs` strict auth + body + origin + rate-limit | `security/admin-auth-hardening` | ✅ |
| `/api/audit-view` signed-token-or-owner | `security/audit-view-hardening` | ✅ |
| `/api/payment-intent` signed-token-or-owner | `security/payment-intent-hardening` | ✅ |
| `/api/proposals/events` workspaceId IDOR fix | `security/proposals-events-hardening` | ✅ |
| `/api/communication/events` HMAC + IDOR fix | `security/communication-events-hardening` | ✅ |
| SECURITY.md disclosure policy | `docs/security-md` | ✅ |

## Phase 1 — Pipeline measurement

| Item | Branch | State |
|---|---|---|
| Canonical LeadStage enum + transition helper | `feature/lead-stage-model` | ✅ 🧪 |
| Activity model helpers (canonical types + builder) | `feature/lead-stage-model` | ✅ 🧪 |
| Pipeline metrics helper (`getPipelineMetrics`) | `feature/pipeline-counters` | ✅ 🧪 |
| Manual reply logger helper (`logManualReply`) | `feature/reply-logging-manual` | ✅ 🧪 |
| Funnel tiles on home dashboard | `feature/dashboard-funnel-tiles` | ✅ 🔌 |
| Reply logger UI on /prep/[id] | `feature/reply-ui-on-prep` | ✅ 🔌 |
| Pipeline-state daily brief helper | `feature/daily-brief-pipeline-state` | ✅ 🧪 |
| /brief surfaced pipeline-state brief | `feature/daily-brief-on-brief` | ✅ 🔌 |
| Emit LEAD_IMPORTED / AUDIT_GENERATED / LEAD_SCORED activities on import | `feature/activity-emit-on-import` | ✅ |

## Phase 2 — Outcome + reply intelligence

| Item | Branch | State |
|---|---|---|
| Scoring feedback skeleton (lift by score band / category / location) | `feature/scoring-feedback-loop-skeleton` | ✅ 🧪 |
| Outcome analytics by vertical + city | `feature/outcome-analytics-by-vertical-city` | ✅ 🧪 |
| Heuristic reply classifier v1 | `feature/reply-classifier-v1` | ✅ 🧪 |
| Next-best-action engine | `feature/next-best-action` | ✅ 🧪 |
| NBA strip at top of /prep/[id] | `feature/next-best-action-on-prep` | ✅ 🔌 |
| LLM-backed reply classifier (replace heuristic with model under the same interface) | — | ⏳ |
| OutcomeSignal write-back into scoring weights | — | ⏳ |

## Phase 3 — Outreach quality

| Item | Branch | State |
|---|---|---|
| Personalization validator (four-signal rule) | `feature/outreach-personalization-validator` | ✅ 🧪 |
| Validator advisory on /prep/[id] | `feature/outreach-validator-wired` | ✅ 🔌 |
| Vertical pack scaffold + dental/smoke-shop/hvac | `feature/vertical-pack-scaffold` | ✅ 🧪 |
| Vertical pack hints on /prep/[id] | `feature/vertical-pack-prep-wiring` | ✅ 🔌 |
| Hard-gate personalization at outreach-generation time (block prep that fails 4/4) | — | ⏳ |
| Per-vertical scoring weight overrides applied in `scoreSignals()` | — | ⏳ |

## Phase 4 — Team / SaaS readiness

| Item | Branch | State |
|---|---|---|
| Workspace permission matrix (5 roles × 24 actions) | `feature/team-roles-permissions-plan` | ✅ 🧪 |
| Roles DB migration (sales / viewer enum values + Invite + role-change UI) | `prisma/MIGRATION_PLAN_ROLES.md` | 📄 ⏳ |
| Usage forecast helper (`getWorkspaceUsageForecast`) | `feature/usage-limits-plan` | ✅ 🧪 |
| Plan enforcement gate (`enforcePlanForAction`) | `feature/billing-plan-enforcement-plan` | ✅ 🧪 |
| Import-jobs wired to enforcement (402 on over-limit) | `feature/enforce-import-jobs-billing` | ✅ 🔌 |
| Audit generation wired to enforcement | — | ⏳ |
| Outreach send wired to enforcement | — | ⏳ |
| Proposal send wired to enforcement | — | ⏳ |
| Onboarding wizard state helper | `feature/onboarding-wizard-helper` | ✅ 🧪 |
| Onboarding wizard card on home dashboard | `feature/onboarding-wizard-ui` | ✅ 🔌 |

## Phase 5 — Scale + reliability

| Item | Branch | State |
|---|---|---|
| Move rate-limit + failed-auth state out of in-memory | — | ⏳ |
| Structured request logs (JSON line per request) | — | ⏳ |
| Synthetic monitoring against public ingest + audit-view | — | ⏳ |
| Per-workspace usage + cost dashboards | — | ⏳ |
| Nonce-based CSP via middleware (drop `'unsafe-inline'` on script) | — | ⏳ |

## Docs

| Item | Branch | State |
|---|---|---|
| SaaS roadmap | `docs/saas-roadmap`, `docs/saas-roadmap-v2` | ✅ 📄 |
| Investor positioning | `docs/investor-and-sales-positioning` | ✅ 📄 |
| GTM sales playbook | `docs/gtm-sales-playbook` | ✅ 📄 |
| Daily operator report | `docs/daily-report-2026-05-15` (and cycles 2/3/4) | ✅ 📄 |
| SECURITY.md | `docs/security-md` | ✅ 📄 |
| This integration TODO | `docs/integration-todo` | ✅ 📄 |
| LeadStage migration plan | `prisma/MIGRATION_PLAN_LEAD_STAGE.md` | 📄 ⏳ |
| Reply table migration plan | `prisma/MIGRATION_PLAN_REPLY_MODEL.md` | 📄 ⏳ |
| Roles migration plan | `prisma/MIGRATION_PLAN_ROLES.md` | 📄 ⏳ |

## Recommended merge order (when ready)

1. `security/admin-auth-hardening`
2. `security/audit-view-hardening`
3. `security/payment-intent-hardening`
4. `security/proposals-events-hardening`
5. `security/communication-events-hardening`
6. `docs/security-md`
7. `feature/lead-stage-model`
8. `feature/activity-emit-on-import`
9. `feature/pipeline-counters`
10. `feature/reply-logging-manual`
11. `feature/dashboard-funnel-tiles`
12. `feature/reply-ui-on-prep`
13. `feature/daily-brief-pipeline-state`
14. `feature/daily-brief-on-brief`
15. `feature/outreach-personalization-validator`
16. `feature/outreach-validator-wired`
17. `feature/vertical-pack-scaffold`
18. `feature/vertical-pack-prep-wiring`
19. `feature/reply-classifier-v1`
20. `feature/next-best-action`
21. `feature/next-best-action-on-prep`
22. `feature/scoring-feedback-loop-skeleton`
23. `feature/outcome-analytics-by-vertical-city`
24. `feature/team-roles-permissions-plan`
25. `feature/usage-limits-plan`
26. `feature/billing-plan-enforcement-plan`
27. `feature/enforce-import-jobs-billing`
28. `feature/onboarding-wizard-helper`
29. `feature/onboarding-wizard-ui`
30. `docs/saas-roadmap`, `docs/saas-roadmap-v2`, `docs/investor-and-sales-positioning`, `docs/gtm-sales-playbook`, `docs/integration-todo`

Merge each into the safe repo's `main` first (one PR at a time), run
the verification script + a smoke test on a fresh DB, then propagate
to the original repo only after explicit owner approval.
