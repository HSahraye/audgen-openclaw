import type { PipelineMetrics } from "@/lib/pipeline/counters";

/**
 * Workspace pipeline funnel tiles.
 *
 * 10-stage row that mirrors the canonical sales motion from import to
 * close, followed by a row of derived rates. Pure presentational
 * server component; takes a fully resolved PipelineMetrics so the page
 * owns data-fetching and workspace authorisation.
 *
 * Layout:
 *  - 10 counter tiles in a responsive grid (2 cols on mobile, 5 on
 *    small, 10 on large).
 *  - 5 derived rates underneath. All clamped to [0, 1]; never NaN.
 *  - "asOf" timestamp on the right.
 */

function pct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  return `${Math.round(n * 1000) / 10}%`;
}

type Tile = {
  label: string;
  value: number;
  hint?: string;
  /** Tailwind background class for the tile body. */
  tone: "neutral" | "active" | "warm" | "win" | "lose";
};

const TONE_STYLES: Record<Tile["tone"], string> = {
  neutral: "border-slate-100 bg-slate-50",
  active: "border-emerald-100 bg-emerald-50",
  warm: "border-amber-100 bg-amber-50",
  win: "border-emerald-200 bg-emerald-100",
  lose: "border-rose-100 bg-rose-50",
};

export function PipelineFunnelTiles({ metrics }: { metrics: PipelineMetrics }) {
  const tiles: Tile[] = [
    { label: "Imported",  value: metrics.derived.leadsImported,    tone: "neutral", hint: "All leads in this workspace" },
    { label: "Scored",    value: metrics.derived.leadsScored,      tone: "neutral", hint: "Leads with a non-zero score" },
    { label: "Audited",   value: metrics.derived.auditsGenerated,  tone: "neutral", hint: "Audit-generated activity count" },
    { label: "Prepared",  value: metrics.derived.outreachPrepared, tone: "neutral", hint: "Outreach-prepared activity count" },
    { label: "Contacted", value: metrics.derived.leadsContacted,   tone: "active" },
    { label: "Replied",   value: metrics.derived.repliesLogged,    tone: "active" },
    { label: "Booked",    value: metrics.derived.callsBooked,      tone: "active" },
    { label: "Proposal",  value: metrics.derived.proposalsSent,    tone: "warm" },
    { label: "Won",       value: metrics.derived.won,              tone: "win" },
    { label: "Lost",      value: metrics.derived.lost,             tone: "lose" },
  ];

  const rates: Array<{ label: string; value: number; hint: string }> = [
    { label: "Connection rate",  value: metrics.rates.connectionRate, hint: "contacted / imported" },
    { label: "Reply rate",       value: metrics.rates.replyRate,      hint: "replied / contacted" },
    { label: "Booked-call rate", value: metrics.rates.bookedCallRate, hint: "booked / replied" },
    { label: "Proposal rate",    value: metrics.rates.proposalRate,   hint: "proposal / booked" },
    { label: "Close rate",       value: metrics.rates.closeRate,      hint: "won / proposal" },
  ];

  return (
    <section
      aria-label="Pipeline funnel"
      className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Pipeline funnel
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Workspace-scoped. Updated on every page load.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {new Date(metrics.asOf).toLocaleString()}
        </p>
      </div>

      {/* 10-stage tile row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`rounded-2xl border p-3 ${TONE_STYLES[t.tone]}`}
            title={t.hint}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {t.label}
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Derived rates */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {rates.map((r) => (
          <div
            key={r.label}
            className="rounded-xl border border-slate-100 bg-white p-2"
            title={r.hint}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {r.label}
            </p>
            <p className="mt-0.5 text-base font-black text-slate-900">{pct(r.value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
