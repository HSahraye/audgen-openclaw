import { AuditGenLogo } from "@/components/brand/auditgen-logo";

export const HERO_HEADLINE =
  "Close more local-services clients without the manual prospecting grind.";

export const HERO_SUBHEAD =
  "AuditGen finds high-need HVAC, dental, roofing, and other local-services prospects, generates a Claude-powered conversion audit you can hand them in 60 seconds, and runs the follow-up sequences for you.";

export const DEMO_EMAIL = "Sahrayeh@Salegen.com";

export const HOW_IT_WORKS_CARDS = [
  {
    step: "01",
    title: "Discover",
    body: "Find local-services businesses with conversion gaps. Filter by vertical, location, and need score to surface the highest-value prospects in your territory.",
  },
  {
    step: "02",
    title: "Audit",
    body: "Claude generates a vertical-specific audit naming the gap, the cost of inaction, and the fix list. Credible, personalised, and ready to send. $0.05 per audit.",
  },
  {
    step: "03",
    title: "Pitch",
    body: "Auto-generated cold call scripts, email templates, and objection handlers. Auto-enroll prospects into 5-step follow-up sequences without lifting a finger.",
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
  "Built for the 1–10 person marketing/web design agency. If you're tired of guessing what to say on the cold call, AuditGen does the homework.";

export function LandingNav({ next }: { next?: string }) {
  const signInHref = `#signin${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
      <AuditGenLogo variant="horizontal" className="h-8" />
      <div className="flex items-center gap-3">
        <a
          href={`mailto:${DEMO_EMAIL}`}
          className="rounded-xl px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-900"
        >
          Book a 15-min demo
        </a>
        <a
          href={signInHref}
          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
        >
          Sign in
        </a>
      </div>
    </nav>
  );
}

export function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-14 text-center sm:py-20">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">AuditGen</p>
      <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
        {HERO_HEADLINE}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-600">
        {HERO_SUBHEAD}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#signin"
          className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-slate-800"
        >
          Sign in
        </a>
        <a
          href={`mailto:${DEMO_EMAIL}`}
          className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Book a 15-min demo
        </a>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">How it works</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
        Three steps from cold list to warm conversation.
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {HOW_IT_WORKS_CARDS.map((card) => (
          <div
            key={card.step}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-600">
              {card.step}
            </p>
            <h3 className="mt-2 text-lg font-black text-slate-900">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SocialProofSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl bg-lime-50 px-8 py-7 ring-1 ring-lime-200">
        <p className="text-sm font-semibold leading-7 text-slate-800">{SOCIAL_PROOF}</p>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-700">Pricing</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
        Simple, usage-based pricing.
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl border p-6 ${tier.highlight ? "border-lime-400 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.2em] ${tier.highlight ? "text-lime-400" : "text-slate-500"}`}
            >
              {tier.name}
            </p>
            {"badge" in tier && tier.badge ? (
              <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.15em] ${tier.highlight ? "text-lime-300" : "text-lime-700"}`}>
                {tier.badge}
              </p>
            ) : null}
            <p
              className={`mt-3 text-2xl font-black ${tier.highlight ? "text-white" : "text-slate-900"}`}
            >
              {tier.price}
              {tier.period && (
                <span className={`text-sm font-semibold ${tier.highlight ? "text-slate-300" : "text-slate-500"}`}>
                  {tier.period}
                </span>
              )}
            </p>
            <p
              className={`mt-1 text-xs font-semibold ${tier.highlight ? "text-slate-300" : "text-slate-500"}`}
            >
              {tier.audits}
            </p>
            <a
              href={tier.ctaHref}
              className={`mt-5 block rounded-xl px-4 py-2.5 text-center text-xs font-black ${
                tier.highlight
                  ? "bg-lime-400 text-slate-900 hover:bg-lime-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-10">
      <div className="border-t border-slate-200 pt-8 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          AuditGen · Made for agencies that sell to local services
        </p>
        <p className="mt-1">
          Email:{" "}
          <a
            href={`mailto:${DEMO_EMAIL}`}
            className="text-slate-600 underline hover:text-slate-900"
          >
            {DEMO_EMAIL}
          </a>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="/privacy" className="underline hover:text-slate-900">
            Privacy Policy
          </a>
          <span aria-hidden>·</span>
          <a href="/terms" className="underline hover:text-slate-900">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
