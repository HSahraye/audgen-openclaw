# AuditGen — 5-Minute Investor Demo Script

> Tighter, performance-tuned variant of `AUDITGEN_DEMO_WALKTHROUGH.md`.
> Designed for investors / serious partners on a staging preview seeded
> with `npm run db:seed:demo` (Demo Agency Inc, 5 leads across 5
> stages, 5 verticals).
>
> Speak quietly, click confidently. The product carries the room; the
> founder's job is not to oversell it.

---

## Goal of the demo

Get the investor / partner to one conclusion:
**"This is not a CRM. It's an operating system that runs the sales
motion for SMB-tier agencies."**

Everything you click should reinforce that one sentence. If it doesn't,
skip it.

---

## Before the room

- [ ] Staging URL up, signed in as `demo-owner@auditgen.local`.
- [ ] `npm run db:seed:demo` run against the preview DB (5 seeded leads).
- [ ] Funnel tiles show non-zero numbers.
- [ ] Browser zoom 110%, one tab, no extensions visible.
- [ ] `AUDITGEN_INVESTOR_POSITIONING.md` open in a second tab — you'll
      pivot there if asked for the framing rather than the product.

---

## The 5 minutes (with one-line cues)

### 0:00 — `/about` (20s)

Click. Read aloud only the headline:

> "The sales operating system for agencies selling to local
> businesses. Import → score → audit → prep → contact → reply →
> follow-up → close → learn. One loop, one workspace."

Don't read the pillars. Click **Start your trial** to land in-app.

---

### 0:20 — `/` dashboard (60s)

Three beats, in order.

**Beat 1 — funnel tiles (15s):**

> "Five leads imported. Three contacted. Two replied. One in proposal.
> That's the funnel, not a vanity chart. The rates below tell you
> where the leak is."

Point at the rates row. Move on.

**Beat 2 — lead list (15s):**

> "Each row is a real business. AuditGen scored it, generated its
> audit, and wrote the pitch. The seller's job is to pick one and call."

**Beat 3 — onboarding wizard (only if visible; 10s):**

> "Day-one experience. We measure conversion at every step of that
> five-step wizard."

Don't click into anything yet.

---

### 1:20 — `/brief` (45s)

Open in the same tab. Point at the **Action queue** card:

> "Three columns, three questions every seller asks every morning. Who
> should I call today? Who needs a second touch? Which hot leads are
> stuck? Each card has a one-line reason and a deep-link into the
> prep page."

Don't scroll. Click "Open prep" on one of the call-today rows.

---

### 2:05 — `/prep/<lead>` (180s — the centerpiece)

This is where the room sees the product. Slow down.

**Beat 1 — action card (30s):**

Point at the top strip.

> "Stage, next move, urgency, personalization score, last contacted,
> next follow-up, audit gaps cited. Every seller sees this at the top
> of every prep page. Notice the personalization score: 4 of 4. The
> pitch isn't templated; it cites a real audit finding for this
> business."

**Beat 2 — pitch + audit (60s):**

Scroll to the 30-second pitch. Click "Copy pitch."

> "That's what goes into the seller's email or SMS. Behind it, the
> audit: mobile, trust, conversion, local SEO. Every check is a real
> evidence-grounded signal. This is the wedge — the audit is what
> makes the first reply happen."

Scroll past the pain summary briefly.

**Beat 3 — log a reply, live (60s):**

Scroll to the bottom **Log a reply** card.

> "After every call, the seller logs what happened. Ten classifications.
> Watch what happens when I pick INTERESTED."

Pick **Interested** in the dropdown. Type:

> "Yes, send the proposal."

Submit. The page refreshes. Stage moves CONTACTED → QUALIFIED.

> "That stage move just updated the funnel tile on the home dashboard,
> the action queue on the brief page, the analytics in the admin
> insights view, and the next-best-action rule for this lead. One
> click. One database transaction. One loop closed."

**Beat 4 — close the lead (30s):**

> "If we'd picked BOOKED_CALL, the lead would have moved to
> CALL_BOOKED. WRONG_CONTACT or BOUNCED would have disqualified it
> automatically. The classifications themselves are tuned per
> classification because every one of them maps to a different next
> move."

Move on.

---

### 5:05 — `/admin/insights/scoring` (30s)

Open the admin scoring insights page (you're allowlisted via
`ADMIN_EMAILS`).

> "This is what compounds. Every won-lost outcome teaches the scorer
> which signals predict close, by score band, by vertical, by city.
> Today the scorer is rule-based; the loop here is the moat. After
> 10,000 closed deals, AuditGen out-scores any generic LLM on this
> exact buyer."

Don't drill into the table; the existence is the point.

---

### 5:35 — Land

End back on the docs tab. One line:

> "Everything you saw runs on workspace-isolated multi-tenant
> infrastructure with signed audit links, HMAC webhook ingestion, and
> an admin allowlist. Buyer security review clears in days, not weeks.
> The technical roadmap and 90-day GTM are in those docs."

Stop. Let them ask the next question.

---

## Common questions in the room

Pulled from the broader GTM playbook (§9). One-line answers only.

| Q | A |
|---|---|
| Is it just an AI wrapper? | The audit is the wedge; the loop is the product. |
| Why agencies first? | Acute pain, fast cycle, sub-$5k ACV, no enterprise motion. |
| Moat? | Outcome data feeds the scorer + vertical packs compound. |
| Not a CRM? | CRMs store contacts. We run the motion. |
| Pricing? | $99 / $299 / $799 / custom. Growth is the default. |
| Security? | Workspace isolation + signed links + HMAC + admin allowlist + SECURITY.md. |
| $1M ARR path? | ~280 logos at blended $300/mo across three motions; see positioning doc §11. |
| Per-vertical packs? | Three shipped (dental / smoke-shop / HVAC), expandable. |

---

## Do NOT in the demo

- Don't open `/api/*` JSON.
- Don't open Prisma schema or migration plan docs.
- Don't import a real CSV live; use the seed.
- Don't compare to competitors by name unless asked.
- Don't apologise that branches aren't merged; that's discipline.

---

## After the demo

- [ ] Send the investor positioning doc as a follow-up (not before).
- [ ] If they say "send pricing": pricing page link, no negotiation.
- [ ] If they say "show me the code": `https://github.com/HSahraye/audgen-openclaw/tree/develop` (the safe repo only).
- [ ] If they ask about original repo: don't share; it's separate IP.

---

## Related docs

- `AUDITGEN_INVESTOR_POSITIONING.md` — the strategic frame.
- `AUDITGEN_GTM_SALES_PLAYBOOK.md` — the GTM playbook AuditGen uses
  on its own buyers.
- `AUDITGEN_DEMO_WALKTHROUGH.md` — longer 6-min walkthrough with the
  Q&A bench.
- `AUDITGEN_AGENCY_ONBOARDING.md` — 7-day customer onboarding plan.
- `AUDITGEN_SAAS_ROADMAP.md` — technical roadmap.
