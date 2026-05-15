# AuditGen — Pricing & Packaging

> Single source of truth for plans, limits, value framing, and
> discounting. Codifies the numbers already used in `PLAN_LIMITS`
> (`src/lib/billing/plans.ts`), the investor positioning doc, and the
> GTM playbook so we don't end up with three versions of the same
> price on three surfaces.
>
> Update this file when the canonical numbers change, then propagate
> to `src/lib/billing/plans.ts` and any landing-page copy in the same
> PR.

---

## TL;DR

| Plan | Monthly | Yearly (2 mo free) | Audience |
|---|---|---|---|
| **Free Trial** | $0 / 14 days | n/a | New agencies kicking the tires |
| **Starter** | $99 | $990 | Solo operators / freelancers |
| **Growth** | $299 *(default)* | $2,990 | 1–10 person agencies (the ICP) |
| **Agency** | $799 | $7,990 | Mid agencies with white-label needs |
| **Enterprise** | custom | custom | Inside-sales teams, multi-brand parents |

Pricing posture: **anchor Growth, never discount Growth, downgrade to
Starter instead of discounting.** Annual = 2 months free, no other
discounting in the first 6 months.

---

## What each plan includes

Volumes match the canonical table in `src/lib/billing/plans.ts`.

### Free Trial (14 days, $0)

- 50 leads
- 25 audits
- 2 seats
- 8 templates
- Full feature access (signed audit links, prep pages, reply logger,
  funnel tiles, action queue, scoring insights)
- No credit card required

Purpose: prove the wedge in days, not weeks. If a trial doesn't
generate 5 audits + 1 logged reply in the first 48 hours, the
seller / owner isn't going to convert.

### Starter — $99 / month

- 500 leads / month
- 200 audits / month
- 1 seat
- 25 templates
- 600 outreach generations / month
- 240 proposal generations / month

For: a solo founder running their own outbound on a small list. The
"my agency is just me, but I'm serious about it" tier.

### Growth — $299 / month (default recommendation)

- 2,000 leads / month
- 800 audits / month
- 5 seats
- 80 templates
- 2,500 outreach generations / month
- 800 proposal generations / month

For: the primary ICP — 1–10 person digital agencies selling to local
businesses. **This is what a discovery call should close on by
default.** Sellers don't justify it; they recommend it.

### Agency — $799 / month

- 10,000 leads / month
- 4,000 audits / month
- 15 seats
- 200 templates
- 9,000 outreach generations / month
- 3,000 proposal generations / month
- White-label audit pages
- Custom audit domain (planned; see Roadmap)

For: mid-stage agencies (5–25 people) running outbound at real
volume across multiple verticals. White-label is the trigger
upgrade from Growth.

### Enterprise — custom

- Unlimited usage tiers
- 10,000+ seats
- Dedicated infra + SLA
- Custom onboarding + a named CSM
- Direct DB / API access if required

For: inside-sales teams at SMB-tier SaaS, multi-location franchise
parents, and any deal where the buyer expects a procurement cycle.
Minimum quote: $24k/year. Below that, sell them Agency.

---

## Unit economics (working numbers)

These are working assumptions, not guarantees. Revise when real cost
data lands from a month of paid traffic.

| Cost item | Target | Notes |
|---|---|---|
| LLM tokens / audit | < $0.05 | Multi-LLM fallback + deterministic local. |
| Lead ingest | < $0.005 | Dedupe + 1 row + optional enrichment. |
| Storage / lead / month | < $0.001 | Postgres row + JSON blobs. |
| Stripe + payment fees | 2.9% + $0.30 / charge | Standard. |
| Gross margin @ Growth | ≥ 80% | At 2k leads + 800 audits / mo. |
| Variable cost / Growth customer | ≤ $60 / mo | Most is LLM tokens for audits. |

Net at Growth: $299 − $60 variable − $9 Stripe fee ≈ **$230 / mo
contribution**. At 280 paying logos blended $300 ≈ $77k MRR / $930k
ARR. Path-to-$1M-ARR math in `AUDITGEN_INVESTOR_POSITIONING.md` §11.

---

## Add-ons (post-launch, Phase 6+)

Each one is optional; none are required to operate.

| Add-on | Price | Limit / behaviour |
|---|---|---|
| Enrichment credits | $0.05 / lead | Overage past plan cap. |
| Voicemail drops | $0.15 / drop | Via Twilio; SMS-capable plans only. |
| SMS volume overage | $0.025 / SMS | Past plan cap. |
| Custom audit domain | $49 / mo | Agency tier and above. |
| White-label audit branding | included in Agency | — |
| Vertical pack (per vertical) | $99 / vertical / mo | Phase 7 ship; dental / smoke-shop / hvac live, others on request. |

---

## Discount discipline

Three rules, in order:

1. **Never discount Growth.** Downgrade to Starter instead.
2. **Annual discount is 2 months free, period.** Don't negotiate
   beyond that in the first 6 months.
3. **Strategic discounts on Agency only.** Reason must fit in one
   sentence ("first 10 logos in dental vertical, locked in for 12
   months"). Document in `STRATEGIC_DISCOUNTS.md` when you grant one.

If a prospect pushes hard on price, the GTM playbook §9 objection #3
applies: math, not discount.

---

## Plan-tier limits enforcement

The application enforces caps via:

- `getWorkspaceUsageForecast(workspaceId)` — read-only forecast.
- `enforcePlanForAction(workspaceId, action)` — allow / soft / block.

Today these helpers exist (parked on `feature/usage-limits-plan` and
`feature/billing-plan-enforcement-plan`). When merged onto `develop`,
revenue-critical action handlers can call the gate before mutating
state and over-limit workspaces get a clean 402 + upgrade prompt.

Until enforcement is wired everywhere, the plan limits act as a
**soft cap** — the dashboard surfaces usage but doesn't block. This
is fine for the first 100 logos; it becomes a real revenue lever at
scale.

---

## Future pricing changes

Things we may revisit when real data lands:

- **Per-seat pricing on Agency.** Right now Agency is fixed-seat (15).
  If teams routinely need 25+, switch to fixed + per-seat after that.
- **Vertical pack pricing.** Today the plan is $99 / vertical / mo
  (Phase 7). May become a 5-vertical bundle at $299 once we have
  enough verticals shipped.
- **Pay-as-you-grow tier.** A $49 micro-tier under Starter (250 leads
  / 100 audits / 1 seat) for very-small operators. Only if discovery
  calls keep surfacing "too expensive at $99."
- **Annual prepayment for Enterprise.** Standard now; formalise when
  the first Enterprise deal is in flight.

---

## Related docs

- `AUDITGEN_INVESTOR_POSITIONING.md` — §10 pricing model.
- `AUDITGEN_GTM_SALES_PLAYBOOK.md` — §4 pricing posture.
- `AUDITGEN_CUSTOMER_DISCOVERY_SCRIPT.md` — pricing-surprise section.
- `src/lib/billing/plans.ts` — the canonical `PLAN_LIMITS` table.
- `prisma/MIGRATION_PLAN_ROLES.md` — seat / role model.
