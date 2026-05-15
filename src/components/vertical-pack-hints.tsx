import { resolveVerticalPack } from "@/lib/verticals";

/**
 * Vertical-pack hints panel for the prep page.
 *
 * Pure server component. Given a lead's category + location, resolves
 * the best vertical pack (or null) and renders the pack's opening
 * angles, top pain points, objection responses, and pricing benchmarks.
 *
 * Renders nothing when no pack matches; the existing prep page renders
 * its generic content in that case.
 */

export function VerticalPackHints({
  category,
  businessName,
}: {
  category: string | null | undefined;
  businessName: string;
}) {
  const pack = resolveVerticalPack(category ?? null);
  if (!pack) return null;

  return (
    <section
      aria-label="Vertical pack hints"
      className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            {pack.name} playbook
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            What works on {businessName}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{pack.description}</p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {pack.slug}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Opening angles
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {pack.outreachHints.openingAngles.slice(0, 3).map((angle, i) => (
              <li key={i}>{angle}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Pain points
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {pack.outreachHints.painPoints.slice(0, 3).map((pain, i) => (
              <li key={i}>{pain}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
          Top objections + answers
        </p>
        <div className="mt-1 grid gap-2">
          {pack.outreachHints.objectionResponses.slice(0, 3).map((o, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
            >
              <p className="font-black text-slate-900">&ldquo;{o.objection}&rdquo;</p>
              <p className="mt-1 text-slate-700">{o.response}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Starter</p>
          <p className="text-sm font-black text-slate-900">
            ${pack.pricing.starterPackageUsd.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Standard</p>
          <p className="text-sm font-black text-slate-900">
            ${pack.pricing.standardPackageUsd.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Premium</p>
          <p className="text-sm font-black text-slate-900">
            ${pack.pricing.premiumPackageUsd.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Cycle</p>
          <p className="text-sm font-black text-slate-900">
            {pack.pricing.typicalCycleDays}d
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-700">
        Proposal framing:{" "}
        <span className="font-normal text-slate-600">{pack.outreachHints.proposalFraming}</span>
      </p>

      {pack.sellerNotes.length > 0 ? (
        <details className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-black text-slate-800">
            Seller notes ({pack.sellerNotes.length})
          </summary>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-700">
            {pack.sellerNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
