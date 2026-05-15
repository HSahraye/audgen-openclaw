import Link from "next/link";
import { AuditGenLogo } from "@/components/brand/auditgen-logo";

export const dynamic = "force-static";

export const metadata = {
  title: "AuditGen — AI Sales OS for agencies",
  description:
    "Import leads, score them, generate evidence-backed audits, prep personalised outreach, track replies, and close. One loop. One workspace.",
};

const PILLARS = [
  {
    title: "Prioritise the right lead",
    body: "Score every business in your list by vertical, geography, and audit signal. Stop guessing which 25 to call today.",
  },
  {
    title: "Audit that earns the first reply",
    body: "Every lead gets a credible, evidence-backed presence audit in seconds. Mobile, trust, conversion, local — the gaps that actually move money.",
  },
  {
    title: "Outreach that doesn't read templated",
    body: "Personalisation is enforced: every prep references a real audit finding, the prospect's name, a local signal, and a clear next step.",
  },
  {
    title: "Pipeline you actually see",
    body: "Canonical stages, activity ledger, daily brief from real funnel state. Funnel tiles on the home screen.",
  },
  {
    title: "Reply intelligence",
    body: "Log a reply, get the next move. Heuristic classifier today, LLM-tuned tomorrow. Outcome feedback into the scoring model.",
  },
  {
    title: "Built multi-tenant from day one",
    body: "Workspace isolation, signed audit links, HMAC webhook ingestion, scrubbed session tokens, admin allowlist. Buyer due diligence passes faster.",
  },
];

const LOOP = [
  "Import",
  "Score",
  "Audit",
  "Prep",
  "Contact",
  "Reply",
  "Follow-up",
  "Close",
  "Learn",
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-center gap-3">
          <AuditGenLogo />
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            AI Sales OS
          </span>
        </div>

        <h1 className="mt-8 text-4xl font-black leading-tight sm:text-5xl">
          The sales operating system for agencies selling to local businesses.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-7 text-slate-700">
          Import leads. Score them. Generate audits. Prep personalised outreach.
          Track replies. Close deals. Learn what works. One loop, one workspace,
          one bill.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800"
          >
            Start your trial
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            The loop
          </p>
          <h2 className="mt-2 text-2xl font-black">
            One workflow, end to end.
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            {LOOP.map((step, i) => (
              <span key={step} className="inline-flex items-center gap-2">
                <span className="rounded-2xl bg-slate-100 px-3 py-1 font-black uppercase tracking-[0.12em] text-slate-700">
                  {step}
                </span>
                {i < LOOP.length - 1 ? (
                  <span aria-hidden="true" className="text-slate-300">
                    →
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Why AuditGen
        </p>
        <h2 className="mt-2 text-2xl font-black">
          Not another CRM. Not another AI wrapper.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
          CRMs store contacts. AI wrappers generate copy. AuditGen runs the
          motion: prioritise, personalise, contact, learn. Built for 1–10
          person agencies selling to local businesses, at $99–$799/mo.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-black text-slate-950">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Built for the agency motion
          </p>
          <h2 className="mt-2 text-2xl font-black">
            From a 500-lead spreadsheet to your first closed deal in week one.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Free trial: 14 days, 50 leads, 25 audits. No credit card.
            Multi-tenant. Workspace-isolated. Owner-only billing. SOC-style
            architecture invariants enforced on every PR.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-2xl bg-emerald-400 px-5 text-sm font-black text-slate-950 hover:bg-emerald-300"
            >
              Start free trial
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-2xl border border-slate-700 bg-slate-900 px-5 text-sm font-black text-slate-100 hover:bg-slate-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 py-10 text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} Presence Labs. AuditGen is an AI Sales
          OS for agencies and inside-sales teams.
        </p>
      </footer>
    </main>
  );
}
