import { AuditGenLogo } from "@/components/brand/auditgen-logo";

// ---------------------------------------------------------------------------
// Brand-anchored constants (kept stable for downstream tests + reuse)
// ---------------------------------------------------------------------------

export const HERO_EYEBROW = "AuditGen · Sales OS";

export const HERO_HEADLINE =
  "The sales OS for agencies selling to local-services businesses.";

export const HERO_SUBHEAD =
  "AuditGen finds the local businesses worth pitching, shows you exactly what's broken on their website, and walks you into every call with the audit, the script, and the offer in hand. One workspace — not a five-tool stack.";

export const DEMO_EMAIL = "Sahrayeh@Salegen.com";

export const HERO_TRUST_STRIP = [
  "14-day free trial",
  "No credit card required",
  "Built for 1–10 person agencies",
];

export const HOW_IT_WORKS_CARDS = [
  {
    step: "01",
    title: "Discover",
    body: "Filter local businesses by city, vertical, need score, and presence-gap signal. Opportunity-scored before you ever pick up the phone, so you spend your day on the 25 that are actually worth a call.",
  },
  {
    step: "02",
    title: "Audit",
    body: "A Claude-powered audit tuned to 15+ verticals names the specific conversion gaps, the cost of inaction, and the fix list — delivered as a branded report you can share in 60 seconds.",
  },
  {
    step: "03",
    title: "Pitch",
    body: "Draft cold email, SMS, and call scripts pulled from real audit findings, plus a meeting-prep page with objections and proposal angles. You approve every send — operator in control, never on autopilot.",
  },
] as const;

export const LOOP_STAGES = [
  {
    label: "Discover",
    sublabel: "By opportunity",
    detail: "Score and filter local businesses by presence gaps, vertical, and geo.",
  },
  {
    label: "Audit",
    sublabel: "AI report",
    detail: "Branded, vertical-specific audit with findings and a fix list.",
  },
  {
    label: "Outreach",
    sublabel: "Drafts + prep",
    detail: "Email, SMS, and call scripts grounded in the actual audit.",
  },
  {
    label: "Close",
    sublabel: "Brief & pipeline",
    detail: "Daily brief, call queue, follow-ups, and revenue tracking.",
  },
] as const;

export const FEATURE_GROUPS = [
  {
    eyebrow: "Find",
    title: "Lead generation, scored by opportunity",
    body: "Discover and filter local businesses the way an agency actually qualifies them — not by name, by gap.",
    points: [
      "Filter by city, category, need score, website status, and Google Business Profile status",
      "Critical / High / Medium opportunity levels you can act on",
      "CSV import, saved views, and bulk add to your workspace",
      "Google Places & Yelp connectors available when API keys are configured",
    ],
  },
  {
    eyebrow: "Audit",
    title: "AI audits with branded shareable reports",
    body: "Every lead gets a credible, evidence-backed conversion audit — built to earn the first reply.",
    points: [
      "Claude-powered, vertical-aware findings across 15+ industries",
      "Two-layer scoring: opportunity score before, 1–100 conversion score after",
      "Branded public audit page with view tracking + payment CTA",
      "Vertical falls back to a deterministic templated audit when LLM is unavailable",
    ],
  },
  {
    eyebrow: "Plan the day",
    title: "Daily Brief + Call Today",
    body: "Open the app, see what to do. No staring at a list of 800 leads wondering where to start.",
    points: [
      "Daily Brief: calls due, ghost leads, warm audit views, weighted pipeline $",
      "Top close-priority leads ranked by recent intent signal",
      "Call Today dialer queue for due, overdue, and hot leads",
      "One-tap call logging with status, next follow-up, and notes",
    ],
  },
  {
    eyebrow: "Reach out",
    title: "Outreach toolkit, operator-approved",
    body: "Drafts the homework, you approve the send. Outreach is operator-controlled — never autonomous.",
    points: [
      "Generated cold email drafts, SMS, and call scripts tied to audit findings",
      "Meeting prep with audit gaps, objection handlers, follow-up recs, proposal intel",
      "Multi-step sequences (email / SMS / call / task) with an approval gate",
      "Reply logger to keep the pipeline current as conversations move",
    ],
  },
  {
    eyebrow: "Track",
    title: "Pipeline & revenue tracking",
    body: "A real funnel you can read at a glance — not 30 dashboards you stop opening.",
    points: [
      "10-stage funnel from Imported → Won/Lost with conversion rates",
      "Follow-up dates, last-contacted timestamps, payment-click signals",
      "Won revenue MTD and weighted pipeline value per workspace",
      "Activity timeline per lead: views, sends, replies, status changes",
    ],
  },
  {
    eyebrow: "Run the agency",
    title: "Team workspaces + white-label studio",
    body: "Multi-tenant from day one. White-label the audit your client sees.",
    points: [
      "Template + branding studio: audit, outreach, and offer templates",
      "Team workspaces with role-based access and email invites",
      "Bulk CSV import with a background job queue (resumable, retried)",
      "Onboarding checklist that walks a fresh workspace to first audit",
    ],
  },
] as const;

export const SAMPLE_AUDIT = {
  business: "Magnolia Family Dentistry",
  category: "Dentist · Walnut Creek, CA",
  score: 78,
  scoreLabel: "Strong opportunity",
  needBadge: "High need",
  gaps: [
    {
      label: "No online booking",
      detail: "New-patient form lives behind a phone call — losing after-hours intent.",
    },
    {
      label: "Reviews not visible above the fold",
      detail: "94 5-star Google reviews are 3 scrolls deep; trust signal is wasted.",
    },
    {
      label: "Pricing absent on insurance page",
      detail: "Visitors bounce when they can't gauge cost before calling the office.",
    },
    {
      label: "Mobile CTA undersized",
      detail: "Click-to-call button under 36px on iPhone; missed taps on 60%+ of sessions.",
    },
    {
      label: "Service pages thin",
      detail: "Implants and Invisalign rank below local competitors with deeper service pages.",
    },
  ],
  package: "Conversion Upgrade — 6-week sprint",
  packageValue: "$2,800 one-time + $399 / mo",
} as const;

export const FAQ_ITEMS = [
  {
    q: "What is a presence audit, exactly?",
    a: "A short, branded report on a local business's online presence — mobile, trust signals, conversion, reviews, booking, services — generated from a real scan of their site. AuditGen scores the gaps that move money, names the fixes, and frames the offer. You can hand it to a prospect in 60 seconds.",
  },
  {
    q: "How does the 14-day free trial work?",
    a: "Create a workspace, get full access to discovery, audits, outreach drafts, sequences, and the pipeline for 14 days. No credit card required. When the trial ends, pick a plan — your data stays put.",
  },
  {
    q: "Does AuditGen send messages on its own?",
    a: "No. Outreach is operator-controlled: AuditGen drafts emails, SMS, and call scripts grounded in the audit, queues them in the approval queue, and only sends once you approve. There is no hands-off auto-sending mode.",
  },
  {
    q: "Where does my data live and who can see it?",
    a: "Each workspace is isolated — leads, audits, and pipeline never cross tenants. Sessions use HttpOnly cookies; session tokens are scrubbed from JSON responses. Public audit links are HMAC-signed and bound to the lead they reference.",
  },
  {
    q: "What about the AI audit — what model, and what does it cost?",
    a: "AuditGen uses Anthropic Claude under the hood, vertical-tuned across 15+ industries. When the LLM is unavailable, the engine falls back to a deterministic templated audit so the workflow never breaks. AI usage is metered per plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel directly from the in-app billing portal — no email back-and-forth, no retention dance.",
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$79",
    period: "/mo",
    audits: "25 audits / mo",
    cta: "Get started",
    ctaHref: "#signin" as const,
    highlight: false as const,
  },
  {
    name: "Pro",
    price: "$199",
    period: "/mo",
    audits: "100 audits / mo",
    cta: "Get started",
    ctaHref: "#signin" as const,
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Scale",
    price: "$399",
    period: "/mo",
    audits: "300 audits / mo",
    cta: "Get started",
    ctaHref: "#signin" as const,
    highlight: false as const,
  },
  {
    name: "Custom",
    price: "Contact sales",
    period: "",
    audits: "Negotiated limits",
    cta: "Contact sales",
    ctaHref: `mailto:${DEMO_EMAIL}?subject=AuditGen%20Custom%20plan`,
    highlight: false as const,
  },
] as const;

export const SOCIAL_PROOF =
  "Built for the 1–10 person agency selling to local-services businesses. The homework and the workflow, in one workspace — so the cold call sounds like you actually did your research, because you did.";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function LandingNav({ next }: { next?: string }) {
  const signInHref = `#signin${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#f5f7f2]/85 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8"
      >
        <a href="#top" className="flex items-center gap-2" aria-label="AuditGen home">
          <AuditGenLogo variant="horizontal" className="h-7" />
        </a>
        <div className="hidden items-center gap-1 md:flex">
          <a
            href="#loop"
            className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            How it works
          </a>
          <a
            href="#features"
            className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`mailto:${DEMO_EMAIL}?subject=AuditGen%20demo`}
            className="hidden rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:text-slate-950 sm:inline-flex"
          >
            Talk to sales
          </a>
          <a
            href={signInHref}
            className="rounded-xl px-3 py-2 text-xs font-black text-slate-700 transition hover:text-slate-950"
          >
            Sign in
          </a>
          <a
            href={signInHref}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
          >
            Start free trial
          </a>
        </div>
      </nav>
    </header>
  );
}

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.18) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 80%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-16 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-700">
              {HERO_EYEBROW}
            </p>
            <h1 className="mt-4 text-[2.4rem] font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]">
              {HERO_HEADLINE}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-[1.05rem]">
              {HERO_SUBHEAD}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#signin"
                className="inline-flex h-12 items-center rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
              >
                Start 14-day free trial
              </a>
              <a
                href="#sample-audit"
                className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
              >
                See a sample audit
              </a>
              <a
                href={`mailto:${DEMO_EMAIL}?subject=AuditGen%20demo`}
                className="inline-flex h-12 items-center px-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
              >
                or book a 15-min walkthrough →
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {HERO_TRUST_STRIP.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full bg-lime-500"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreviewCard />
        </div>
      </div>
    </section>
  );
}

function HeroPreviewCard() {
  return (
    <div
      aria-hidden="false"
      className="relative isolate w-full rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-100"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Daily Brief · Tuesday
        </p>
        <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-lime-800">
          Live
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Calls due", value: "12", tone: "bg-lime-100 text-lime-800" },
          { label: "Warm audit views", value: "4", tone: "bg-sky-100 text-sky-800" },
          { label: "Ghost leads", value: "7", tone: "bg-amber-100 text-amber-900" },
          { label: "Weighted pipeline", value: "$28.4k", tone: "bg-slate-900 text-white" },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {tile.label}
            </p>
            <p
              className={`mt-2 inline-flex items-baseline rounded-xl px-2 py-1 text-lg font-black ${tile.tone}`}
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Top close priority
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              Magnolia Family Dentistry
            </p>
            <p className="text-[11px] text-slate-500">Walnut Creek, CA · viewed audit 18m ago</p>
          </div>
          <span className="rounded-xl bg-slate-950 px-2.5 py-1 text-[11px] font-black text-lime-300">
            78 / 100
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">
            Next move
          </p>
          <p className="mt-0.5 truncate text-xs font-bold">
            Call Magnolia — reference the booking gap and 94 Google reviews.
          </p>
        </div>
        <span
          aria-hidden
          className="ml-3 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-lime-400 text-slate-950"
        >
          →
        </span>
      </div>
    </div>
  );
}

export function LoopSection() {
  return (
    <section id="loop" className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">
          The whole loop
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Find, audit, reach out, close — in one place.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Most agencies stitch this together across a scraper, a CRM, a cold-email tool, an
          AI writing app, and a spreadsheet. AuditGen is the loop, not another box in it.
        </p>
      </div>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LOOP_STAGES.map((stage, idx) => (
          <li
            key={stage.label}
            className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Stage {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-700">
                {stage.sublabel}
              </span>
            </div>
            <p className="mt-4 text-2xl font-black text-slate-950">{stage.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{stage.detail}</p>
            <span
              aria-hidden
              className="absolute right-5 top-5 size-2.5 rounded-full bg-lime-400 opacity-0 transition group-hover:opacity-100"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="relative border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            From cold list to warm conversation — without the five-tab dance.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Three deliberate stages, each grounded in real signal from the prospect&apos;s
            site. No fluff, no generic templates, no autonomous outreach.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {HOW_IT_WORKS_CARDS.map((card) => (
            <article
              key={card.step}
              className="relative rounded-3xl border border-slate-200 bg-[#f5f7f2] p-6"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-lime-300">
                  {card.step}
                </span>
                <h3 className="text-lg font-black text-slate-950">{card.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGroupsSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">
          What you get
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          A full sales OS, not another AI wrapper.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Six modules, one workspace. Built to replace the scraper + the CRM + the cold-email
          tool + the AI writer + the spreadsheet you&apos;re juggling today.
        </p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURE_GROUPS.map((group) => (
          <article
            key={group.title}
            className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-700">
              {group.eyebrow}
            </p>
            <h3 className="mt-3 text-lg font-black leading-snug text-slate-950">
              {group.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{group.body}</p>
            <ul className="mt-5 flex-1 space-y-2 border-t border-slate-100 pt-4">
              {group.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-[13px] leading-6 text-slate-700"
                >
                  <span
                    aria-hidden
                    className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-lime-500"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SampleAuditSection() {
  return (
    <section
      id="sample-audit"
      className="relative border-y border-slate-200 bg-slate-950 text-slate-100"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(190, 242, 100, 0.18) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
            Sample audit
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            The deliverable that earns the first reply.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Every prospect gets a branded, vertical-tuned report. Specific findings, fix list,
            and a packaged offer — the reason they pick up your second call.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Vertical-aware findings across 15+ industries",
              "Signed, shareable link with view tracking",
              "Branded with your workspace colors and sender identity",
              "Payment CTA — collect the deposit straight from the report",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-slate-300">
                <span
                  aria-hidden
                  className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-lime-400"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Example below — replace with your own once you start your trial.
          </p>
        </div>

        <SampleAuditCard />
      </div>
    </section>
  );
}

function SampleAuditCard() {
  return (
    <div className="rounded-[2rem] bg-white p-6 text-slate-950 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-700">
            Online presence audit
          </p>
          <h3 className="mt-2 text-xl font-black leading-snug text-slate-950 sm:text-2xl">
            {SAMPLE_AUDIT.business}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {SAMPLE_AUDIT.category}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-lime-300">
            {SAMPLE_AUDIT.score} / 100
          </span>
          <span className="mt-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-900">
            {SAMPLE_AUDIT.needBadge}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-900">
          Opportunity
        </p>
        <p className="mt-1 text-sm font-bold leading-6 text-amber-950">
          {SAMPLE_AUDIT.scoreLabel} — five fixable conversion gaps that are likely costing
          this practice new-patient bookings every week.
        </p>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          What we found
        </p>
        <ul className="mt-3 space-y-3">
          {SAMPLE_AUDIT.gaps.map((gap) => (
            <li
              key={gap.label}
              className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <span
                aria-hidden
                className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-black text-rose-700"
              >
                !
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-950">{gap.label}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-slate-600">{gap.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-800">
          Recommended package
        </p>
        <p className="mt-1 text-sm font-black text-slate-950">{SAMPLE_AUDIT.package}</p>
        <p className="text-xs font-semibold text-slate-600">{SAMPLE_AUDIT.packageValue}</p>
      </div>
    </div>
  );
}

export function SocialProofSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <figure className="overflow-hidden rounded-3xl border border-lime-200 bg-lime-50 px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-800">
          Who it&apos;s for
        </p>
        <blockquote className="mt-3 text-lg font-bold leading-8 text-slate-900 sm:text-xl">
          {SOCIAL_PROOF}
        </blockquote>
        <figcaption className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Customer quotes coming soon — bring yours.
        </figcaption>
      </figure>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Simple monthly pricing. Cancel anytime.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Start with a 14-day free trial — no card. Pick the tier that matches your monthly
          audit volume. Talk to us when you outgrow Scale.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => {
          const isDark = tier.highlight;
          return (
            <div
              key={tier.name}
              className={`relative flex h-full flex-col rounded-3xl border p-6 ${
                isDark
                  ? "border-lime-400 bg-slate-950 text-white shadow-[0_30px_60px_-25px_rgba(15,23,42,0.55)]"
                  : "border-slate-200 bg-white"
              }`}
            >
              {"badge" in tier && tier.badge ? (
                <span className="absolute -top-3 left-6 rounded-full bg-lime-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-950">
                  {tier.badge}
                </span>
              ) : null}
              <p
                className={`text-xs font-black uppercase tracking-[0.2em] ${
                  isDark ? "text-lime-400" : "text-slate-500"
                }`}
              >
                {tier.name}
              </p>
              <p
                className={`mt-4 text-3xl font-black ${
                  isDark ? "text-white" : "text-slate-950"
                }`}
              >
                {tier.price}
                {tier.period ? (
                  <span
                    className={`text-sm font-semibold ${
                      isDark ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {tier.period}
                  </span>
                ) : null}
              </p>
              <p
                className={`mt-1 text-xs font-bold ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {tier.audits}
              </p>
              <ul
                className={`mt-5 flex-1 space-y-2 border-t pt-4 text-[13px] leading-6 ${
                  isDark ? "border-slate-800 text-slate-200" : "border-slate-100 text-slate-700"
                }`}
              >
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${
                      isDark ? "bg-lime-400" : "bg-lime-500"
                    }`}
                  />
                  Full LeadGen, audits, outreach, sequences
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${
                      isDark ? "bg-lime-400" : "bg-lime-500"
                    }`}
                  />
                  Branded audit pages + custom templates
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${
                      isDark ? "bg-lime-400" : "bg-lime-500"
                    }`}
                  />
                  Daily Brief, pipeline, approval queue
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${
                      isDark ? "bg-lime-400" : "bg-lime-500"
                    }`}
                  />
                  Team workspaces + email invites
                </li>
              </ul>
              <a
                href={tier.ctaHref}
                className={`mt-6 block rounded-xl px-4 py-3 text-center text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500 ${
                  isDark
                    ? "bg-lime-400 text-slate-950 hover:bg-lime-300"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                {tier.cta}
              </a>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Prices in USD. Plans are monthly · Cancel from the in-app billing portal.
      </p>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Honest answers to the obvious questions.
          </h2>
        </div>
        <dl className="mt-10 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-[#f9faf7]">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group px-5 py-5 sm:px-7 sm:py-6 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                <dt className="text-base font-black leading-snug text-slate-950 sm:text-lg">
                  {item.q}
                </dt>
                <span
                  aria-hidden
                  className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-black text-slate-600 transition group-open:rotate-45 group-open:border-lime-500 group-open:text-lime-700"
                >
                  +
                </span>
              </summary>
              <dd className="mt-3 text-sm leading-7 text-slate-600">{item.a}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-400">
              Get started
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Run your next agency week from one workspace.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Spin up a workspace, import your list, and ship your first three audits before
              lunch. 14 days, no credit card, your data stays yours.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <a
              href="#signin"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-lime-400 px-6 text-sm font-black text-slate-950 transition hover:bg-lime-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start 14-day free trial
            </a>
            <a
              href={`mailto:${DEMO_EMAIL}?subject=AuditGen%20demo`}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-6 text-sm font-black text-slate-100 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Talk to sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-[#f5f7f2]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <AuditGenLogo variant="horizontal" className="h-7" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
              AuditGen is the sales operating system for agencies selling to local-services
              businesses. The homework and the workflow, in one workspace.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Product
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>
                <a href="#loop" className="hover:text-slate-950">
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-950">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-slate-950">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-slate-950">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Contact
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>
                <a
                  href={`mailto:${DEMO_EMAIL}`}
                  className="underline-offset-2 hover:text-slate-950 hover:underline"
                >
                  {DEMO_EMAIL}
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-slate-950">
                  About
                </a>
              </li>
              <li>
                <a href="/privacy" className="hover:text-slate-950">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-slate-950">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-6 text-[11px] text-slate-500 sm:flex-row sm:items-center">
          <p>© {year} AuditGen. Made for agencies that sell to local-services businesses.</p>
          <p className="font-bold uppercase tracking-[0.14em]">
            Built in California · Operator-controlled outreach
          </p>
        </div>
      </div>
    </footer>
  );
}
