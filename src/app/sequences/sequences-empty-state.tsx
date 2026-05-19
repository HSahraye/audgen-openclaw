import Link from "next/link";

export const SEQUENCES_PAGE_INTRO =
  "Build the cold-email cadences you drop new leads into after the first audit lands.";

export const SEQUENCES_EMPTY_HEADING = "No sequences yet";

export const SEQUENCES_EMPTY_BODY =
  "Once you've audited a few prospects, this is where you queue them into a 5-step cadence so follow-ups don't fall through the cracks.";

export const SEQUENCES_EMPTY_CTA_LABEL = "Discover prospects \u2192";
export const SEQUENCES_EMPTY_CTA_HREF = "/leadgen";

export function SequencesEmptyState() {
  return (
    <div
      data-testid="sequences-empty-state"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <h2 className="text-lg font-black text-slate-950">{SEQUENCES_EMPTY_HEADING}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{SEQUENCES_EMPTY_BODY}</p>
      <Link
        href={SEQUENCES_EMPTY_CTA_HREF}
        className="mt-4 inline-flex h-10 items-center rounded-xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200"
      >
        {SEQUENCES_EMPTY_CTA_LABEL}
      </Link>
    </div>
  );
}
