import Link from "next/link";

export const APPROVALS_PAGE_INTRO =
  "Read every AI-drafted email or SMS your sequences want to send before it actually goes out.";

export const APPROVALS_EMPTY_HEADING = "Nothing waiting for review";

export const APPROVALS_EMPTY_BODY =
  "When a sequence is set to 'approval required' and drafts an outbound message, it lands here for you to read before it ships. Until then, the queue stays empty.";

export const APPROVALS_EMPTY_CTA_LABEL = "Open Sequences \u2192";
export const APPROVALS_EMPTY_CTA_HREF = "/sequences";

export function ApprovalsEmptyState() {
  return (
    <div
      data-testid="approvals-empty-state"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <h2 className="text-lg font-black text-slate-950">{APPROVALS_EMPTY_HEADING}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{APPROVALS_EMPTY_BODY}</p>
      <Link
        href={APPROVALS_EMPTY_CTA_HREF}
        className="mt-4 inline-flex h-10 items-center rounded-xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200"
      >
        {APPROVALS_EMPTY_CTA_LABEL}
      </Link>
    </div>
  );
}
