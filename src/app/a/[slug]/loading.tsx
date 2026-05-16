/**
 * Short-link redirect loading state. The page handler resolves the slug to
 * a lead id and redirects to /audit/[id]?token=…, but the resolve step can
 * take a beat on cold DB connections. A bare "Loading…" beats a blank flash.
 */
export default function ShortLinkLoading() {
  return (
    <main
      className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div
          className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm font-bold text-slate-700">Opening audit…</p>
        <p className="mt-1 text-xs text-slate-500">One moment while we verify the link.</p>
      </div>
    </main>
  );
}
