import Link from "next/link";
import type { WizardState } from "@/lib/onboarding/wizard";

/**
 * Onboarding wizard card.
 *
 * Pure presentational server component. Caller supplies the WizardState
 * (resolved server-side from the session); we render a progress bar +
 * the 5 steps with a CTA on the current step.
 *
 * Hidden entirely when the wizard is complete (`currentStep` is null).
 * That keeps it from being permanent UI noise once a workspace is
 * activated.
 */

export function OnboardingWizardCard({ state }: { state: WizardState }) {
  if (state.currentStep === null) return null;
  const pctLabel = `${Math.round(state.pctComplete * 100)}%`;

  return (
    <section
      aria-label="Onboarding wizard"
      className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Getting started
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            5 steps to your first reply
          </h2>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{pctLabel}</p>
      </div>

      {/* Progress bar */}
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(state.pctComplete * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: pctLabel }}
        />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {state.steps.map((step, i) => {
          const isCurrent = step.key === state.currentStep;
          const isDone = step.done;
          return (
            <li
              key={step.key}
              className={`rounded-2xl border p-3 text-sm ${
                isDone
                  ? "border-emerald-200 bg-emerald-50"
                  : isCurrent
                    ? "border-slate-300 bg-white shadow-sm"
                    : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-black ${
                    isDone ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span
                  className={`text-xs font-black uppercase tracking-[0.12em] ${
                    isDone ? "text-emerald-700" : "text-slate-700"
                  }`}
                >
                  Step {i + 1}
                </span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-950">{step.label}</p>
              {!isDone ? (
                <p className="mt-1 text-xs text-slate-600">{step.hint}</p>
              ) : null}
              {isCurrent && step.ctaHref ? (
                <Link
                  href={step.ctaHref}
                  className="mt-3 inline-flex h-8 items-center rounded-xl bg-slate-950 px-3 text-[11px] font-black text-white hover:bg-slate-800"
                >
                  Go to step
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
