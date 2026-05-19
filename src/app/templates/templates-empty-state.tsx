import Link from "next/link";

export const TEMPLATES_PAGE_INTRO =
  "Save the audit, outreach, and offer formats that work so the next rep isn't starting from scratch.";

export const TEMPLATES_EMPTY_HEADING = "No templates saved yet";

export const TEMPLATES_EMPTY_BODY =
  "This is where the cold-email scripts, audit layouts, and proposal blurbs that actually closed deals live, so you can reuse them. Hit Seed system templates above to start with a baseline, then edit.";

export const TEMPLATES_EMPTY_CTA_LABEL = "Generate an audit \u2192";
export const TEMPLATES_EMPTY_CTA_HREF = "/research";

export function TemplatesEmptyState() {
  return (
    <div
      data-testid="templates-empty-state"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <h2 className="text-lg font-black text-slate-950">{TEMPLATES_EMPTY_HEADING}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{TEMPLATES_EMPTY_BODY}</p>
      <Link
        href={TEMPLATES_EMPTY_CTA_HREF}
        className="mt-4 inline-flex h-10 items-center rounded-xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200"
      >
        {TEMPLATES_EMPTY_CTA_LABEL}
      </Link>
    </div>
  );
}
