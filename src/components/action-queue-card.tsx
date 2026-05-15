import Link from "next/link";
import type { ActionQueue } from "@/lib/pipeline/action-queue";

/**
 * Pure presentational server component. Renders three columns:
 *   - Call today    (REPLIED / QUALIFIED / CALL_BOOKED)
 *   - Follow up     (CONTACTED + PROPOSAL_SENT stale)
 *   - Stuck hot     (high-score early-stage leads sitting too long)
 *
 * Returns null if every bucket is empty so the brief page stays clean
 * on day zero.
 */

type ColumnSpec = {
  key: keyof ActionQueue["totals"];
  title: string;
  question: string;
  tone: "high" | "medium" | "low";
};

const COLUMNS: ColumnSpec[] = [
  { key: "callToday", title: "Call today", question: "Who should I call today?", tone: "high" },
  { key: "followUp", title: "Follow up", question: "Who needs a second touch?", tone: "medium" },
  { key: "stuckHot", title: "Stuck hot", question: "Which hot leads are stuck?", tone: "low" },
];

const TONE_STYLES: Record<"high" | "medium" | "low", string> = {
  high: "border-emerald-200 bg-emerald-50",
  medium: "border-amber-200 bg-amber-50",
  low: "border-slate-200 bg-slate-50",
};

function buildPrepHref(leadId: string): string {
  return `/prep/${encodeURIComponent(leadId)}`;
}

export function ActionQueueCard({ queue }: { queue: ActionQueue }) {
  if (queue.totals.callToday + queue.totals.followUp + queue.totals.stuckHot === 0) {
    return null;
  }
  return (
    <section
      aria-label="Today's action queue"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Today&apos;s action queue
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Derived from canonical pipeline state.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {new Date(queue.asOf).toLocaleString()}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = queue[col.key as "callToday" | "followUp" | "stuckHot"];
          return (
            <div
              key={col.key}
              className={`rounded-2xl border p-3 ${TONE_STYLES[col.tone]}`}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
                  {col.title}
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-900">
                  {items.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{col.question}</p>
              <ul className="mt-3 space-y-2">
                {items.slice(0, 5).map((item) => (
                  <li
                    key={item.leadId}
                    className="rounded-xl bg-white p-2 text-xs shadow-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-black text-slate-900">
                        {item.businessName}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                        {item.stage}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-600">{item.reason}</p>
                    <div className="mt-1">
                      <Link
                        href={buildPrepHref(item.leadId)}
                        className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                      >
                        Open prep
                      </Link>
                    </div>
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="text-xs text-slate-500">Nothing here right now.</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
