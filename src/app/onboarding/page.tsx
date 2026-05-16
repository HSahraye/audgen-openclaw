import Link from "next/link";
import { requireSessionRole } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const dynamic = "force-dynamic";

/**
 * /onboarding \u2014 day-zero checklist for a fresh workspace.
 *
 * Server-rendered. Workspace resolved from the session (never from a
 * client-supplied id). Failure-isolated: if the helper throws, the
 * page renders a friendly message rather than crashing.
 */
export default async function OnboardingPage() {
  const session = await requireSessionRole(["owner", "admin", "member", "sales", "viewer"]);
  let status: Awaited<ReturnType<typeof getOnboardingStatus>> | null = null;
  let error: string | null = null;
  try {
    status = await getOnboardingStatus(session.workspaceId);
  } catch (e) {
    error = e instanceof Error ? e.message : "unknown error";
  }

  const pctLabel = status ? `${Math.round(status.pctComplete * 100)}%` : "\u2014";

  return (
    <main id="main" className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              Getting started
            </p>
            <h1 className="mt-1 text-2xl font-black">
              4 steps to your first outreach
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Workspace: <span className="font-black">{session.workspaceSlug}</span>
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {error || !status ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">
              Couldn&apos;t load onboarding right now. Try refreshing the page.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Progress
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {pctLabel}
                </p>
              </div>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={Math.round(status.pctComplete * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: pctLabel }}
                />
              </div>
            </section>

            <ol className="space-y-3">
              {status.steps.map((step, i) => {
                const isCurrent = step.key === status.currentStep;
                const isDone = step.done;
                const toneClass = isDone
                  ? "border-emerald-200 bg-emerald-50"
                  : isCurrent
                    ? "border-slate-300 bg-white shadow-sm"
                    : "border-slate-100 bg-slate-50";
                return (
                  <li
                    key={step.key}
                    className={`rounded-3xl border p-4 ${toneClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                        aria-hidden="true"
                      >
                        {isDone ? "\u2713" : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[10px] font-black uppercase tracking-[0.14em] ${
                            isDone ? "text-emerald-700" : "text-slate-500"
                          }`}
                        >
                          Step {i + 1}
                        </p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {step.label}
                        </p>
                        {!isDone ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {step.hint}
                          </p>
                        ) : null}
                      </div>
                      {isCurrent ? (
                        <Link
                          href={step.ctaHref}
                          className="inline-flex h-9 items-center rounded-xl bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800"
                        >
                          Go to step
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {status.currentStep === null ? (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                <p className="font-black">You&apos;re onboarded.</p>
                <p className="mt-1">
                  Head to the daily brief to see what to do today.
                </p>
                <div className="mt-3">
                  <Link
                    href="/brief"
                    className="inline-flex h-10 items-center rounded-xl bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800"
                  >
                    Open daily brief
                  </Link>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
