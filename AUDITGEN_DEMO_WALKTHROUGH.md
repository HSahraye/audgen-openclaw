# AuditGen — Demo Walkthrough

> A 6-minute click-path for showing AuditGen to a buyer or investor.
> Designed to be runnable against a preview/staging environment seeded
> with `npm run db:seed:demo` (Demo Agency Inc workspace, 5 leads
> across 5 stages). Don't run this script against a real customer
> workspace — the demo leads use synthetic data, but the click-path
> below assumes those exact seeds.

---

## Before the demo

- [ ] Preview environment up at a private URL (not `audgen.netlify.app`).
- [ ] DB seeded: `DATABASE_URL=<preview> npm run db:seed:demo`.
- [ ] Admin email allowlisted via `ADMIN_EMAILS` so you can show
      `/admin` if asked.
- [ ] Logged in as the demo-owner account so you don't show a sign-up
      flow on stage.
- [ ] Browser zoom 110%, no extensions visible, full-screen tab.

---

## Click path (6 minutes total)

### 0:00 — Open `/about` (30 s)

Read the headline aloud:

> "The sales operating system for agencies selling to local businesses.
> Import, score, audit, prep, contact, reply, follow-up, close, learn.
> One loop, one workspace."

Don't scroll the pillars. Click **Start your trial** to skip to the app.

### 0:30 — Land on `/` (the dashboard) (60 s)

Three things to show, in order:

1. **Onboarding wizard card** (top of the page). Point at it:

   > "When a new agency signs up, this is the first 7 days as a
   > checklist. Wizard hides itself once it's complete."

2. **Funnel tiles row**. Read the numbers off the seed data:

   > "Five leads imported. Three contacted. Two replied. One in
   > proposal. One won wouldn't be honest for a demo, so we left it
   > out. The rates row tells you where you're leaking."

3. **Lead list**. Don't open it. Move on.

### 1:30 — `/brief` (60 s)

Open in a new tab. Two things:

1. **Pipeline-state brief**:

   > "This is what to do today, derived from canonical pipeline
   > stages. REPLIED leads on top, then QUALIFIED, then stale
   > PROPOSAL_SENT and CONTACTED. Each row tells the seller why it's
   > there."

2. **Today's Hit List** (existing heuristic):

   > "We kept the old heuristic view because some sellers like it.
   > Eventually the pipeline-state one wins."

Click into the top lead in the brief.

### 2:30 — `/prep/<lead>` (180 s — the centerpiece)

Slow down here. Show, in order:

1. **Next-best-action strip** at the top:

   > "The system reads the last reply and the stage and tells the
   > seller the single next move. Right now: 'Send the proposal —
   > prospect is interested.'"

2. **Vertical-pack playbook**:

   > "The lead is in 'Dental practices,' so we surface the dental
   > playbook: opening angles, top pain points, three objection
   > responses, and the right pricing tier for this vertical. This
   > is what makes the pitch land."

3. **30-Second Pitch** with the **personalization advisory**:

   > "Every pitch is graded. Green means 4/4 personalization signals
   > are present — business name, audit-specific issue, local signal,
   > clear next action. Amber tells the seller what's missing."

4. **Pain Summary / Proposal Outline / Objections** — flip through
   without dwelling. Mention:

   > "Everything below is auto-generated from the audit, but the
   > seller can copy and edit before sending."

5. **Log a reply** card (bottom):

   > "After every call or email, the seller logs what happened.
   > Classification dropdown is 10 canonical values; the system
   > suggests a stage transition. This is where the outcome data
   > comes from."

Demo it live: pick "Interested," type one line, submit. The page
re-renders with the new stage; the funnel tile on `/` will update on
next open.

### 5:30 — `/admin/health` (30 s)

Open the admin health page (you're allowlisted via `ADMIN_EMAILS`):

> "Internal ops view. Queue health, webhook events, audit volume,
> AI failures. This page is gated to platform staff — a regular agency
> owner gets a 404, not a 403, so we don't advertise it."

Then close the tab. Don't open `/admin` itself unless asked.

### 6:00 — Land

End on the docs:

- `AUDITGEN_SAAS_ROADMAP.md` — what's coming.
- `AUDITGEN_INTEGRATION_TODO.md` — what's wired today.
- `AUDITGEN_INVESTOR_POSITIONING.md` — the business framing.

Say:

> "Everything you saw is on the safe repo, on focused branches, with
> tests and a clean build per branch. Nothing is in production yet.
> When you're ready to flip it on, we land them one at a time."

---

## Anti-patterns (do not do)

- **Don't show `/api/*` JSON.** Buyers' eyes glaze.
- **Don't open the schema or Prisma file.** Even if asked, navigate to
  `AUDITGEN_SAAS_ROADMAP.md` section 4 (Data model) instead.
- **Don't run a real CSV import live.** Use the seeded leads. CSV
  parsing is interesting to engineers, not buyers.
- **Don't apologise** for branches not being merged. They're not
  merged on purpose. That's the discipline.
- **Don't compare to specific competitors by name** unless the buyer
  raises one. If they do, use the playbook objections in
  `AUDITGEN_GTM_SALES_PLAYBOOK.md` §9.

---

## Q&A bench (top 8 expected questions)

| Question | One-liner answer |
|---|---|
| Is this just an AI wrapper? | The audit is the wedge. The loop (pipeline + replies + outcomes) is the product. AI is the cheapest part of the stack. |
| Why agencies first? | Acute pain, fast cycle (1–4 weeks), $500–$5k ACV, no enterprise sales motion. Wins per founder hour are highest here. |
| What's the moat? | Outcome data feeding the scorer + workspace history + vertical packs. Hard to clone in a weekend. |
| How is this not a CRM? | CRMs store contacts. AuditGen runs motion: prioritise → personalise → contact → learn. |
| Pricing? | $99 Starter, $299 Growth (default), $799 Agency, custom Enterprise. Listed on `/about` and `AUDITGEN_INVESTOR_POSITIONING.md`. |
| Security posture? | Workspace isolation server-side, signed audit links, HMAC webhooks, scrubbed session tokens, admin allowlist, CSP/HSTS, SECURITY.md. |
| Path to $1M ARR? | 280 logos at blended $300/mo, three motions (founder inbound, agency outbound, partner). See `AUDITGEN_INVESTOR_POSITIONING.md` §11. |
| Why not just sell audits? | Starter tier does that ($99). 60% of audit-only customers move to Growth in 60 days. The audit is the wedge, not the product. |

---

## Related docs

- `AUDITGEN_SAAS_ROADMAP.md`
- `AUDITGEN_INVESTOR_POSITIONING.md`
- `AUDITGEN_GTM_SALES_PLAYBOOK.md`
- `AUDITGEN_AGENCY_ONBOARDING.md`
- `AUDITGEN_INTEGRATION_TODO.md`
- `SAFE_PREVIEW_DEPLOY_REPORT.md`
