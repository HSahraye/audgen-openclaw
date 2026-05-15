# AuditGen — Onboarding Flow Plan

> Plan + scaffold for the day-zero customer onboarding flow. The
> goal: a new agency owner can go from "just signed up" to "first
> reply logged" inside one session.
>
> This doc is the spec. Implementation is incremental:
>  - Phase A (this branch): plan doc + minimal `/onboarding` route
>    + pure helper `getOnboardingStatus()`.
>  - Phase B (later): wire onboarding card into the home dashboard
>    (the parked `feature/onboarding-wizard-helper` and
>    `feature/onboarding-wizard-ui` branches are richer; merge them
>    when the wider integration round runs).
>  - Phase C (later still): live progress bar, deep-link CTAs into
>    each step, and a "welcome to AuditGen" email on workspace
>    creation.

---

## What "onboarded" means

A workspace is onboarded when **all four** of these are true:

| # | Step | Done when | UI deep-link |
|---|---|---|---|
| 1 | Import a lead list | >= 1 Lead in the workspace | `/research` |
| 2 | Pick a vertical | Workspace has a non-default `name` and at least one Lead with a `category` matching a known vertical pack | `/settings/billing` |
| 3 | Generate the first audit | >= 1 Lead with `generatedContextJson` set | `/` (open any lead from the list) |
| 4 | Send the first outreach prep | >= 1 OutreachLog row in the workspace | `/prep/<lead>` |

These four checks come from data we already store. No new schema. The
helper does four cheap `count` / `findFirst` queries.

Optional fifth step (added once `feature/reply-logging-manual` is the
default flow): **log the first reply** (>= 1 Activity row of type
`REPLY_LOGGED`). Doing it as four + one keeps the wizard short for
fresh signups; the fifth surfaces only when the user has reached the
manual reply UI.

---

## Why these four (not more)

- They map directly to the core loop's first half:
  import → score → audit → prep. (Score is implicit; if a lead is
  imported the scorer ran.)
- Each one is achievable in under 5 minutes by a motivated owner.
- They are independent of the parked `feature/outreach-validator-wired`,
  `feature/next-best-action-on-prep`, etc., so this flow ships on
  today's `develop`.
- Avoiding a "set up Stripe" or "invite a teammate" step in onboarding
  keeps friction low; both are nudged from `/settings/billing`
  separately once a customer is paid.

---

## Routes

| Route | Purpose | Auth |
|---|---|---|
| `/onboarding` | Server-rendered checklist with status from `getOnboardingStatus()`. Shows what's done + a CTA for the next undone step. | Internal session (any role). |

Existing routes that the wizard deep-links into are unchanged. We
intentionally do **not** invent a multi-page wizard UI here — the
existing app routes are the steps; the `/onboarding` page is the index.

---

## API / helper contract

```ts
type OnboardingStep =
  | "import_first_lead"
  | "pick_vertical"
  | "first_audit"
  | "first_outreach";

type OnboardingStatus = {
  workspaceId: string;
  steps: Array<{
    key: OnboardingStep;
    label: string;
    done: boolean;
    ctaHref: string;
    hint: string;
  }>;
  currentStep: OnboardingStep | null; // null = fully onboarded
  pctComplete: number; // 0..1
};

export async function getOnboardingStatus(workspaceId: string): Promise<OnboardingStatus>;
```

Pure server helper. Strict workspace scope. Throws on missing
`workspaceId`. No writes. Failure-isolated at the page level so a
helper throw never breaks the rest of the dashboard.

---

## Relationship to the parked `feature/onboarding-wizard-*` branches

Two branches in the parked set are similar:

- `feature/onboarding-wizard-helper` — already has
  `getOnboardingWizardState()` returning a 5-step shape including
  "name workspace" and "first sequence."
- `feature/onboarding-wizard-ui` — wires the helper as a card on `/`.

This Phase-A branch ships an **independent, narrower** 4-step helper +
`/onboarding` index route so we stop blocking on the wider integration
round. When that round happens, the two helpers merge into one (drop
the narrower one in favour of the richer one).

---

## What ships in this branch

1. `AUDITGEN_ONBOARDING_PLAN.md` (this file).
2. `src/lib/onboarding/status.ts` — `getOnboardingStatus(workspaceId)`
   with the contract above.
3. `src/lib/onboarding/status.test.ts` — fail-closed + each step
   detection.
4. `src/app/onboarding/page.tsx` — server-rendered checklist; uses
   the existing session helpers to resolve the workspace from the
   signed-in user; renders four cards with done/next/pending states
   and a deep-link to the right surface.

No new envs. No schema change. No migrations. No tests outside the
helper.

---

## Acceptance criteria

- Lint clean, test clean, build clean.
- `/onboarding` renders for an authenticated user.
- Steps update on the next page load after the user does any of the
  four actions.
- Workspace-scoped: an owner of workspace A never sees workspace B's
  onboarding status.

---

## Out of scope (deferred)

- "Welcome to AuditGen" email on workspace create.
- Progress bar animation.
- Multi-step modal flow.
- Stripe connect / team invites in onboarding.
- Wiring the card into `/` (covered by the parked
  `feature/onboarding-wizard-ui` branch).

---

## Related docs

- `AUDITGEN_AGENCY_ONBOARDING.md` — the human-side 7-day plan.
- `AUDITGEN_SAAS_ROADMAP.md` §5 Phase 4 — Team / SaaS readiness.
- `AUDITGEN_INTEGRATION_TODO.md` — onboarding wizard helper / UI rows.
