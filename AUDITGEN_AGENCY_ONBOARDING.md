# AuditGen — Agency Onboarding Checklist

> The 7-day plan to get a new agency from "free trial signed up" to
> "first closed deal attributable to AuditGen." Pair with the in-app
> 5-step wizard (see `feature/onboarding-wizard-ui`); this doc is the
> human-side companion the seller / owner walks through.

## Day 0 — Activation (≤ 30 min)

- [ ] **Create the workspace.** Real agency name, not "Default Workspace."
- [ ] **Invite the first teammate** (or skip if solo). Owner / Admin /
      Member roles map to ownership of pricing, ops, and day-to-day.
- [ ] **Set the timezone** in `Settings → Workspace` so dashboards show
      sensible "today" boundaries.
- [ ] **Connect Stripe** if you want to charge clients through AuditGen
      payment links (optional; not required for trial).
- [ ] **Set `ADMIN_EMAILS`** for platform-staff access. Skip if you're
      the only operator.

## Day 1 — First import + first audit (60 min)

- [ ] **Pick 25 leads** that you'd actually call this week. Real names,
      real websites. Don't dump 5,000 cold leads in on day 1 — start
      where the close cycle is short.
- [ ] **Import the CSV.** Required columns: business name, website,
      phone (optional but useful). Optional: owner name, location,
      category, notes.
- [ ] **Wait for the import to finish** (async; the dashboard shows
      progress). Each row generates an audit; expected throughput is
      ~5/min.
- [ ] **Open one prep page** (`/prep/<lead>`). Scan: does the 30-second
      pitch reference real facts about the business? If the
      personalization badge is amber (X/4 signals missing), good — that's
      the system telling you the prompt needs more lead data. Edit the
      lead notes and re-prep.

## Day 2 — First outreach (90 min)

- [ ] **Pick the top 10 leads by score.** AuditGen's daily brief on
      `/brief` already does this; trust it for the first round.
- [ ] **Use the prep page copy.** Click "Copy pitch" → SMS or call.
      "Copy email" → paste into Gmail. The CTA at the top of the prep
      page tells you which channel + what next move.
- [ ] **Log every outcome.** This is the muscle that makes the rest of
      the loop work. After every call, scroll to "Log a reply" and pick
      the classification + optional one-line note.
- [ ] **Set up your daily cadence.** 25 leads / 5 calls per day for a
      week → review on Friday.

## Day 3-5 — Loop tightens

- [ ] **Use `/brief`** as your morning view. The "Pipeline-state brief"
      section tells you which leads need attention today and why.
- [ ] **Watch the funnel tiles** on `/`. After 3 days of logging
      replies, you should see real numbers in Contacted / Replied /
      Booked.
- [ ] **First reply classification check.** When you log a reply, the
      system suggests a stage transition (REPLIED → QUALIFIED, etc.).
      Accept it unless the suggestion is wrong; the system learns from
      your accepts/overrides.
- [ ] **Send your first proposal.** If the audit identified a real gap
      and the prospect said "tell me more," use the proposal outline
      from the prep page.

## Day 6 — Review

- [ ] **Conversion check.** Open the analytics (when wired up, currently
      only the helper exists at `src/lib/intelligence/analytics/outcomes`).
      Look at close rate by score band. If 80+ scored leads aren't
      closing higher than 0-40 scored leads, something's off with the
      scoring config (or the data isn't large enough yet).
- [ ] **Outcome retro.** For every LOST or DISQUALIFIED lead, add a
      one-line reason. This trains the scorer.
- [ ] **Template tuning.** If a particular opening angle is winning
      replies, lock it into `Templates → Outreach → Save as default`.

## Day 7 — Lock the loop

- [ ] **Schedule the same 25-lead batch for next week** with the
      next-best-action queue. The system will tell you who to follow
      up with, who to nurture, who to disqualify.
- [ ] **Open the SaaS roadmap** (`AUDITGEN_SAAS_ROADMAP.md`) and pick
      one feature to request next. Vertical packs (dental, smoke-shop,
      hvac) are already scaffolded; other verticals are 1-day work.

## Red flags to watch for in week 1

- **Personalization advisory is permanently amber.** Either lead data
  is thin (no notes, no location), or the prompts are too generic.
  Both are fixable; ping me with the lead id.
- **No replies logged in 4 days.** Either outreach isn't going out
  (real cause: forgot to send), or it's getting filtered (check
  spam folders, sending domain reputation), or it's wrong audience.
- **`/admin` reachable to a non-admin teammate.** Should not happen
  with the `security/admin-auth-hardening` branch in place. If it does
  on the preview, file it — that's a hard-stop.

## What "successful onboarding" looks like

By end of day 7:
- 25 leads imported, 25 audits generated.
- At least 15 leads in CONTACTED stage.
- At least 5 replies logged.
- At least 1 lead in QUALIFIED, CALL_BOOKED, or PROPOSAL_SENT.
- The workspace owner can pull up the funnel tiles and explain what
  every number means without help.
- The seller can open `/prep/<lead>` and the recommended next action
  matches what they intuitively know to do.

If those aren't true by day 7, you have a real problem to solve. If
they are, you have an operating system, not a tool. Ship it.

---

## Related docs

- `AUDITGEN_SAAS_ROADMAP.md` — the technical roadmap.
- `AUDITGEN_INVESTOR_POSITIONING.md` — the business framing.
- `AUDITGEN_GTM_SALES_PLAYBOOK.md` — the sales playbook AuditGen uses
  on its own buyers.
- `AUDITGEN_INTEGRATION_TODO.md` — what's shipped vs. wired in the
  safe-repo branches.
