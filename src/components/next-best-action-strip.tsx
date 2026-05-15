import type { NextBestAction } from "@/lib/pipeline/next-best-action";

/**
 * Colored CTA strip rendered at the top of /prep/[id]. The seller
 * should see the recommended next move before they scroll. Pure
 * presentational. Hidden when the action is 'do_nothing' so we don't
 * waste vertical space on quiet states.
 */

const KIND_LABEL: Record<NextBestAction["kind"], string> = {
  send_proposal: "Send the proposal",
  book_call: "Book / prep the call",
  follow_up_email: "Send a follow-up email",
  follow_up_call: "Make a follow-up call",
  prepare_outreach: "Prep the outreach",
  send_first_outreach: "Send the first outreach",
  log_outcome: "Log the outcome",
  nurture_pause: "Move to nurture",
  disqualify: "Disqualify",
  do_nothing: "",
};

const URGENCY_STYLES: Record<NextBestAction["urgency"], string> = {
  high: "bg-emerald-50 border-emerald-200 text-emerald-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-slate-50 border-slate-200 text-slate-700",
};

export function NextBestActionStrip({ action }: { action: NextBestAction }) {
  if (action.kind === "do_nothing") return null;
  return (
    <section
      aria-label="Recommended next action"
      className={`mb-4 rounded-3xl border p-4 ${URGENCY_STYLES[action.urgency]}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em]">
            Next best action
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            {action.cta || KIND_LABEL[action.kind] || "Move it forward"}
          </h2>
          <p className="mt-1 text-sm">{action.reason}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
          {action.urgency}
        </span>
      </div>
    </section>
  );
}
