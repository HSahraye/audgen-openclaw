# AuditGen — Investor & Sales Positioning

> Internal working document. Treat as v1 draft. Sharp claims welcome;
> revise as the data sharpens.

---

## 1. One-line description

**AuditGen is an AI sales operating system that turns raw lead lists into
prioritized actions, evidence-backed audits, personalized outreach,
tracked pipeline, and a closed-loop learning engine.**

Not another CRM. Not another "AI audit tool." A system that runs the
entire pre-close sales motion for agencies and SMB-tier inside-sales teams.

## 2. Problem

Agencies and inside-sales teams selling to local businesses lose deals
the same way every time:

- They get lead lists they cannot prioritize. A 500-row CSV is a wall.
- They cold-call without context. The pitch is generic. The prospect can
  tell.
- They send "audits" that are templated PDFs no one reads.
- They drop the ball on follow-up. 60% of replies never get worked.
- They never learn which signals close. The scoring model in their head
  doesn't improve year over year.
- Their CRM is a contact database, not a sales operating system.

The pain is felt acutely by the boutique-to-mid agency: 1–10 people,
$500–$5,000 ACV, selling websites / SEO / ads / automation / AI to local
businesses. They have to be efficient. They cannot afford a Salesforce
admin. They cannot afford to send a generic audit and hope.

## 3. Customer

**Primary ICP:** Boutique digital agencies and freelance operators (1–10
people) selling to local US businesses. Vertical mix is open: smoke
shops, dental, HVAC, auto repair, real estate, restaurants, home
services. ACV $500–$5,000. Cycle 1–4 weeks.

**Secondary ICP (Phase 7+ in the roadmap):** MSPs, B2B consultants,
recruiters, insurance brokers, home-service sales teams, franchise sales
teams, and SMB-tier SaaS SDR teams. Same buyer behaviour: local,
relationship-led, sub-$5k ACV, no enterprise sales motion.

**Anti-ICP:** F500 enterprise sales (different motion entirely),
e-commerce DTC (different stack), anyone needing 50k leads/day on day one.

## 4. Current wedge

The unfair starting point is a **credible, business-specific audit** that
walks into the conversation already 80% of the way there:

- Mobile experience scoring
- Trust / review signal coverage
- Conversion-blocker checklist
- Competitor density
- Pain summary with concrete dollar implications

The prospect reads it and thinks "they know our shop." That's the wedge.
Everything after — outreach, sequences, pipeline, reply intelligence —
builds on the credibility the audit creates.

## 5. Why now

- **LLM audit cost collapsed.** Generating a per-business audit used to
  cost $5–$15 in API spend; today it's $0.02–$0.10. The unit economics
  for $99–$799/mo SaaS finally work.
- **Agencies are getting squeezed.** Local businesses are buying fewer
  websites and more "presence packages." Agencies need a way to convert
  more of the lead lists they already have.
- **The CRM market is stagnant for SMBs.** HubSpot Starter is $20/seat
  but doesn't do prep. Pipedrive is $25/seat but doesn't do audits.
  Apollo is $80/seat but doesn't do scoring tuned to local. There is no
  category leader for "sales OS for the 1–10 person agency."
- **Multi-LLM availability** (OpenAI, Anthropic, Google, deterministic
  local fallback) means we are not a single-vendor wrapper. Margins are
  durable.

## 6. Product workflow

The product is one loop run repeatedly:

1. **Import** — CSV upload, public API ingest from `presencelabs.net`,
   partner CRM connectors.
2. **Score** — rule-based scorer today (vertical, location, completeness,
   review density); ML-fed scorer once outcome data accumulates.
3. **Audit** — multi-section audit generated from public website +
   review data + manual signals; deterministic fallback when LLM
   tokens fail.
4. **Prep** — per-lead 30-second pitch, three real pain points,
   conversation outline, post-call email, proposal frame, recommended
   price.
5. **Contact** — email / SMS / call templates that require per-lead
   specifics (Phase 3 outreach quality rules).
6. **Reply intelligence** — manual reply logging today; email/SMS/voice
   integrations soon; classifier + next-best-action.
7. **Follow-up** — sequence engine with per-vertical cadence and quiet
   hours.
8. **Close** — proposals auto-personalised from the audit, pricing
   suggested by historical wins.
9. **Learn** — every outcome (won/lost/no-reply) writes back to the
   scoring model and the template performance table.

Each step is a module. The modules share canonical entities (Workspace,
Lead, Audit, Prep, Activity, Reply, Opportunity). The dashboard surfaces
real funnel metrics, not vanity counts.

## 7. Moat

In order of strength:

1. **Outcome data.** Every closed deal teaches the scorer and the copy
   picker. After 10k closed-won outcomes, AuditGen out-performs any
   generic LLM prompt because it has seen what worked in **this**
   vertical, in **this** geography, at **this** price. New entrants
   start at zero.
2. **Workflow lock-in.** Pipeline + reply history + sequences become the
   rep's working memory. Once a team's last 90 days of outreach are
   inside AuditGen, churn is expensive.
3. **Audit credibility.** A real, evidence-grounded audit page that
   reads like a human wrote it is genuinely hard to clone in a weekend.
4. **Per-vertical playbooks.** Phase 7 ships vertical packs. Each
   vertical pack is a quarter of moat compounding — the templates,
   scoring weights, and pricing benchmarks come from real wins in that
   vertical, not a copywriter's guesses.
5. **Integration breadth.** Stripe, Resend/Postmark, Twilio, public
   ingest, partner CRMs. Each is a small wall; together they are the
   moat.

Not the moat: LLM choice, "AI" in the name, fancy UI, lead-scraping
volume.

## 8. Competitor categories

- **CRMs (HubSpot, Pipedrive, Close).** Strong at contact storage and
  pipeline UI. Weak at prep, audits, scoring, outcome feedback. They
  expect *you* to bring the strategy.
- **Sales prospecting tools (Apollo, ZoomInfo, Lemlist).** Strong at
  lead data and outbound. Weak at the audit and the post-reply loop.
- **AI sales assistants (Clay, Apollo AI, MagicalAI).** Strong at
  enrichment and copy generation. Weak at the audit, pipeline, and the
  feedback loop. Often single-vertical or single-step.
- **Agency-specific tools (DashClicks, GoHighLevel).** Strong at
  white-label fulfilment. Weak at pre-close: lead intelligence, scoring,
  audit-first prep, structured pipeline analytics.

AuditGen sits in the gap: pre-close sales intelligence + audit-first
prep + sales-OS workflow, packaged for the 1–10 person agency.

## 9. Why AuditGen is different

- **The audit is the wedge product, not an upsell.** A credible audit
  changes the conversation from cold call to consultation.
- **The loop closes.** Win/loss feeds back into scoring and template
  selection. Almost no SMB-tier tool does this.
- **Workspace-first.** Multi-tenant from day one. Agencies can host their
  clients' workflows without sales-ops gymnastics. Hardened in Phase 0.
- **Multi-LLM, deterministic fallback.** Not held hostage to one vendor's
  rate limits or pricing.
- **Per-vertical extensibility.** Templates, scoring, and pricing are
  modular by vertical. The agency-only product is a wedge; the platform
  scales.
- **Security posture from day one.** Workspace isolation, signed audit
  links, HMAC webhook ingestion, scrubbed session tokens, admin
  allowlist. Buyer due diligence (a real blocker at $5k+ ACV) clears
  faster.

## 10. Pricing model

| Tier | Price/month | Includes | Designed for |
|---|---|---|---|
| Free Trial | $0 / 14 days | 50 leads, 25 audits, full feature access | new agencies |
| Starter | $99 | 500 leads/mo, 200 audits/mo, 1 seat | solo operators |
| Growth | $299 | 2,000 leads/mo, 800 audits/mo, 3 seats, sequences | small agencies |
| Agency | $799 | 10,000 leads/mo, 4,000 audits/mo, 10 seats, white-label audit pages | mid agencies |
| Enterprise | custom | unlimited + SLA + dedicated support | inside-sales teams |

**Unit economics targets:**
- Variable cost per audit: < $0.05 (LLM tokens + render + storage).
- Variable cost per lead ingest: < $0.005.
- Gross margin at Growth tier: ≥ 80%.

**Add-ons (post-launch):** enrichment credits, SMS / voicemail-drop
volume, custom-domain audit links, white-label audit branding,
vertical-specific playbook packs.

## 11. Path to $1M ARR

Roughly 280 paying customers at a blended $300/mo, or about half that at
agency tier. Built in three motions:

- **Motion A — Founder-led inbound** ($0–$200k ARR). Twitter / agency
  community posts of real audit examples. "Here's a 90-second audit of
  your top competitor — DM for one of yours." Inbound conversion of
  agencies who already think the audit is the wedge.
- **Motion B — Outbound to agency-owner networks** ($200k–$600k ARR).
  Hand-run cold outreach to 5,000 boutique agencies (Twitter, LinkedIn,
  community lists). 1% conversion to trial, 30% trial-to-paid, gets us
  ~15 new logos / month.
- **Motion C — Partner integrations** ($600k–$1M ARR). One or two
  agency-tooling brands (GoHighLevel-adjacent, vertical-specialist
  communities) embed AuditGen as the audit engine and refer traffic.

Levers to compress time: (a) ship Phase 1–3 fast so first 100 logos see
the pipeline payoff inside week 1; (b) free public "audit my site" page
with conversion to trial.

## 12. Path to $10M ARR

Three things have to be true:

1. **Per-vertical packs ship.** Dental, HVAC, auto repair, real estate,
   smoke shops, restaurants. Each pack opens a 500–2,000 agency segment
   and adds defensibility.
2. **Reply intelligence is best-in-class.** Manual logging today;
   email/SMS/voice integrations by month 9. By $5M ARR, the reply
   classifier and next-best-action are demonstrably better than humans
   on cycle time.
3. **Inside-sales teams adopt.** Tertiary ICP — SMB-tier B2B SaaS SDR
   teams, recruiters, insurance brokers — start treating AuditGen as
   their sales OS. This is the second category expansion and unlocks
   $5k–$25k ACV.

Expansion ARR per existing customer becomes the lever: from $299 → $799
as the agency grows seats, then $799 → $2,000+ as they buy vertical
packs and enrichment.

## 13. First 90-day GTM plan

**Days 1–30 — Build the wedge moment.**
- Ship Phase 0 (security) and Phase 1 (pipeline measurement). DONE for
  security; in progress for pipeline.
- Land 10 design-partner agencies. Hand-onboard. Charge $99–$299.
- Public landing page with a "free audit of your own site" hook.
- Record 5 case-study audits of well-known local businesses (with
  permission). Post them everywhere.

**Days 31–60 — Tighten the loop.**
- Ship Phase 2 (reply intelligence) — manual logging UI + classifier.
- Convert design partners to paid. Target 8 of 10.
- Run a 1,000-prospect outbound test using AuditGen on AuditGen
  ("eat our own audits"). Publish results.
- Ship the public audit page with conversion to trial.

**Days 61–90 — Earn the next 50 logos.**
- Ship Phase 3 (outreach personalization). Every prep includes one
  audit-specific issue + one business detail + one local signal + one
  clear next action.
- Public pricing page goes live.
- Twitter / Discord / community presence is daily, not weekly.
- Two partner conversations open. One vertical-specialist agency
  community signed as a referral partner.

KPIs at day 90:
- 30+ paying logos.
- $10k+ MRR.
- < 5% monthly logo churn.
- > 50% of leads with a logged reply (not just sent).
- A real conversion funnel chart with non-zero numbers at every stage.

## 14. Risks

In rough order of severity:

1. **Audit quality drift.** If LLM output becomes generic or wrong, the
   wedge dies. Mitigations: deterministic fallback, audit-specific
   evidence requirements, automated audit QA tests.
2. **Outreach quality drift.** If outreach reads templated, prospect
   replies drop and so does the loop's value. Mitigations: Phase 3
   four-item rule enforced as a validator; reject prep that doesn't
   include real per-lead signals.
3. **Vertical concentration.** Smoke shops are a great wedge but a
   declining/regulated category. Mitigation: vertical-pack roadmap is
   funded the moment we hit $200k ARR.
4. **CAC / channel risk.** If founder-led inbound stalls, paid acquisition
   on agency-owner audiences may not work. Mitigation: keep payback
   under 6 months; lean on partner motion.
5. **LLM pricing or policy shock.** Mitigations: multi-LLM, deterministic
   fallback, fixed per-audit token budget.
6. **Security/tenant-isolation regression.** Mitigations: Phase 0
   security work is comprehensive; new routes use `assertApiSessionWorkspace`;
   architecture invariants documented; tests required for every new
   workspace-scoped path.
7. **Founder bandwidth.** Single-operator company that ships agency,
   product, security, GTM all at once. Mitigation: every feature must
   support the loop; nothing else ships.

## 15. What to build next

In order. Each one fits in a single focused branch.

1. **Dashboard integration of pipeline counters.** `getPipelineMetrics()`
   exists; surface it on the home dashboard. Tiles + small funnel chart.
2. **Reply logging UI on `/prep/[id]`.** Manual classification + free-text
   note. Writes through `logManualReply()`. The first user-visible piece
   of reply intelligence.
3. **Onboarding wizard.** 5 steps: name workspace → import sample CSV →
   run first audit → send first email → log first reply.
4. **Outreach personalization validator.** Reject any generated outreach
   that doesn't include all four required signals (audit-specific issue,
   business detail, local signal, clear next action).
5. **Reply classifier (heuristic v1).** Rule-based mapping from reply
   body text → classification, used as a default when the user logs a
   reply. Phase 2 swaps in an LLM classifier.
6. **Stripe trial enforcement.** Plan-tier limits surfaced in the UI;
   over-limit actions blocked with a "upgrade" prompt.
7. **Public landing + "audit my site" hook.** Marketing surface lives in
   a separate site; the in-app trial path is the conversion.
8. **First vertical pack: dental.** Templates + scoring weights + audit
   evidence checks tuned to dental practices.
9. **Email/SMS provider integrations** (Resend, Postmark, Twilio). Use
   the HMAC webhook contract added in Phase 0.
10. **Outcome write-back into scoring.** Closed deals feed a coefficient
    table per (vertical, score band, template). Phase 2 of revenue
    intelligence.

---

## Working notes

- This doc lives alongside `AUDITGEN_SAAS_ROADMAP.md`. The roadmap is the
  technical plan; this doc is the business framing. Update both when
  positioning shifts.
- Numbers in the pricing table and pathway estimates are working
  assumptions, not commitments. Revise as design-partner data lands.
- Source repo: https://github.com/HSahraye/PresenceLabs-AuditGenerator (do
  not push without explicit approval). Safe operator repo:
  https://github.com/HSahraye/audgen-openclaw.
