import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getScoringFeedback } from "@/lib/intelligence/scoring/feedback";

export const dynamic = "force-dynamic";

/**
 * Scoring feedback insights page (admin-gated).
 *
 * Renders the read-only outcome rollups produced by getScoringFeedback():
 *   - baseline close rate
 *   - lift by lead score band (0-20 / 21-40 / 41-60 / 61-80 / 81-100)
 *   - lift by category (vertical)
 *   - lift by location (city)
 *
 * Lift > 1.0 means the signal correlates with closes; < 1.0 means
 * the opposite. Under MIN_DECIDED_FOR_LIFT samples we surface a
 * thin-data note rather than pretend the numbers are reliable.
 *
 * Workspace selection: admins can switch via ?workspace=<slug>. The
 * default picks the most recently updated workspace, matching the
 * existing /admin page convention.
 */

type SearchParams = Promise<{ workspace?: string }>;

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  return `${Math.round(n * 1000) / 10}%`;
}

function fmtLift(lift: number): string {
  if (!Number.isFinite(lift) || lift <= 0) return "—";
  return `${lift.toFixed(2)}\u00d7`;
}

function liftTone(lift: number): string {
  if (!Number.isFinite(lift) || lift <= 0) return "text-slate-500";
  if (lift >= 1.25) return "text-emerald-700";
  if (lift >= 0.85) return "text-slate-700";
  return "text-rose-700";
}

export default async function AdminScoringInsightsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePlatformAdmin();

  const { workspace: workspaceSlug } = await searchParams;

  // Resolve workspace: by ?workspace=slug, else most recently updated.
  const workspace = workspaceSlug
    ? await prisma.workspace.findUnique({
        where: { slug: workspaceSlug },
        select: { id: true, name: true, slug: true },
      })
    : await prisma.workspace.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true },
      });

  if (!workspace) {
    return (
      <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-black">No workspace found.</h1>
          <Link href="/admin" className="mt-4 inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
            Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  // Other workspaces for the switcher.
  const workspaces = await prisma.workspace.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, slug: true },
  });

  const report = await getScoringFeedback(workspace.id);

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">
              Scoring insights
            </p>
            <h1 className="mt-1 text-2xl font-black">Outcome feedback</h1>
            <p className="mt-1 text-xs text-slate-500">
              Workspace: <span className="font-black">{workspace.name}</span>{" "}
              <span className="text-slate-400">({workspace.slug})</span>
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
          >
            Back to Admin
          </Link>
        </div>

        {/* Workspace switcher */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Switch workspace
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/admin/insights/scoring?workspace=${encodeURIComponent(w.slug)}`}
                className={`inline-flex h-8 items-center rounded-xl border px-3 text-xs font-black ${
                  w.id === workspace.id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {w.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Totals */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Decided deals (won + lost)
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Decided" value={String(report.totals.decided)} />
            <Tile label="Won" value={String(report.totals.won)} tone="win" />
            <Tile label="Lost" value={String(report.totals.lost)} tone="lose" />
            <Tile label="Baseline close" value={fmtPct(report.totals.baselineCloseRate)} />
          </div>
          {report.thinDataNotes.length > 0 ? (
            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              {report.thinDataNotes.join(" ")}
            </p>
          ) : null}
        </section>

        {/* By score band */}
        <LiftTable
          title="Lift by lead score band"
          subtitle="0-20, 21-40, 41-60, 61-80, 81-100 score buckets"
          headerLabel="Band"
          rows={report.byScoreBand.map((b) => ({
            key: b.band,
            label: b.band,
            decided: b.decided,
            won: b.won,
            closeRate: b.closeRate,
            lift: b.lift,
          }))}
          baseline={report.totals.baselineCloseRate}
        />

        {/* By category (vertical) */}
        <LiftTable
          title="Lift by vertical (category)"
          subtitle="Lower-cased category bucket"
          headerLabel="Vertical"
          rows={report.byCategory.map((b) => ({
            key: b.category,
            label: b.category,
            decided: b.decided,
            won: b.won,
            closeRate: b.closeRate,
            lift: b.lift,
          }))}
          baseline={report.totals.baselineCloseRate}
        />

        {/* By location (city) */}
        <LiftTable
          title="Lift by location (city)"
          subtitle="Lower-cased location bucket"
          headerLabel="Location"
          rows={report.byLocation.map((b) => ({
            key: b.location,
            label: b.location,
            decided: b.decided,
            won: b.won,
            closeRate: b.closeRate,
            lift: b.lift,
          }))}
          baseline={report.totals.baselineCloseRate}
        />

        <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
          Read-only insight. The live scorer remains rule-based until lift
          coefficients stabilise on enough data. See{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">
            src/lib/intelligence/scoring/feedback.ts
          </code>
          .
        </p>
      </div>
    </main>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "lose";
}) {
  const cls =
    tone === "win"
      ? "bg-emerald-50 border-emerald-100 text-emerald-900"
      : tone === "lose"
        ? "bg-rose-50 border-rose-100 text-rose-900"
        : "bg-slate-50 border-slate-100 text-slate-900";
  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function LiftTable({
  title,
  subtitle,
  headerLabel,
  rows,
  baseline,
}: {
  title: string;
  subtitle: string;
  headerLabel: string;
  rows: Array<{
    key: string;
    label: string;
    decided: number;
    won: number;
    closeRate: number;
    lift: number;
  }>;
  baseline: number;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Baseline {fmtPct(baseline)}
        </p>
      </div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <th className="p-2">{headerLabel}</th>
              <th className="p-2 text-right">Decided</th>
              <th className="p-2 text-right">Won</th>
              <th className="p-2 text-right">Close rate</th>
              <th className="p-2 text-right">Lift</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-2 text-sm text-slate-500">
                  No decided deals yet in this bucket.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="p-2 font-semibold">{row.label}</td>
                  <td className="p-2 text-right">{row.decided}</td>
                  <td className="p-2 text-right">{row.won}</td>
                  <td className="p-2 text-right">{fmtPct(row.closeRate)}</td>
                  <td className={`p-2 text-right font-black ${liftTone(row.lift)}`}>
                    {fmtLift(row.lift)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
