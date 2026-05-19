import Link from "next/link";

export const RESEARCH_PAGE_INTRO =
  "Stash raw prospects here, run AI audits in a batch, then promote the warm ones to leads.";

export const RESEARCH_EMPTY_HEADING = "No prospects in the queue yet";

export const RESEARCH_EMPTY_BODY =
  "This is where you stage businesses to audit before promoting them to leads. Paste a list on the left, or import a batch you discovered on the prospecting page.";

export const RESEARCH_EMPTY_CTA_LABEL = "Discover prospects \u2192";
export const RESEARCH_EMPTY_CTA_HREF = "/leadgen";

export function ResearchEmptyState() {
  return (
    <div
      data-testid="research-empty-state"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"
    >
      <h2 className="text-lg font-black text-slate-950">{RESEARCH_EMPTY_HEADING}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{RESEARCH_EMPTY_BODY}</p>
      <Link
        href={RESEARCH_EMPTY_CTA_HREF}
        className="mt-4 inline-flex h-10 items-center rounded-xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200"
      >
        {RESEARCH_EMPTY_CTA_LABEL}
      </Link>
    </div>
  );
}
