import type { PipelineMetrics } from "@/lib/pipeline/counters";

/**
 * Workspace pipeline funnel tiles.
 *
 * Renders the canonical counters from getPipelineMetrics(). The component
 * is a pure presentational server component \u2014 it takes a fully resolved
 * PipelineMetrics object so callers (the page) own the data-fetching and
 * session/workspace authorization. Never accept workspaceId from the
 * client; resolve it from the session at the page layer.
 *
 * Layout: one strip of 6 counter tiles (Imported / Contacted / Replied /
 * Booked / Proposal / Won) plus a small rates row underneath. Plain
 * styling to slot above the existing AuditDashboard without competing
 * with its visual weight.
 */

function pct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  return `${Math.round(n * 1000) / 10}%`;
}

type Tile = { label: string; value: number; hint?: string };

export function PipelineFunnelTiles({ metrics }: { metrics: PipelineMetrics }) {
  const tiles: Tile[] = [
    { label: "Imported", value: metrics.derived.leadsImported, hint: "All leads in this workspace" },
    { label: "Contacted", value: metrics.derived.leadsContacted },
    { label: "Replied", value: metrics.derived.repliesLogged },
    { label: "Booked", value: metrics.derived.callsBooked },
    { label: "Proposal", value: metrics.derived.proposalsSent },
    { label: "Won", value: metrics.derived.won },
  ];

  const rates: Array<{ label: string; value: number }> = [
    { label: "Connection rate", value: metrics.rates.connectionRate },
    { label: "Reply rate", value: metrics.rates.replyRate },
    { label: "Booked-call rate", value: metrics.rates.bookedCallRate },
    { label: "Proposal rate", value: metrics.rates.proposalRate },
    { label: "Close rate", value: metrics.rates.closeRate },
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

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
            title={t.hint}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {t.label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {rates.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-100 bg-white p-2">
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
