import { Skeleton } from "@/components/ui/skeleton";

/**
 * Public audit page loading state. Mirrors the actual /audit/[id] layout:
 * dark hero, KPI strip, body cards. We want this surface to feel "premium"
 * even mid-fetch because it's customer-facing and often the first thing a
 * prospect sees from a cold reach-out.
 */
export default function AuditLoading() {
  return (
    <main className="min-h-screen bg-[#f5f7f2]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading audit…</span>
      <section className="bg-slate-950 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-4 w-40 bg-white/15" />
          <Skeleton className="h-10 w-3/4 bg-white/15" />
          <Skeleton className="h-5 w-1/2 bg-white/15" />
          <div className="flex flex-wrap gap-3 pt-4">
            <Skeleton className="h-11 w-40 bg-white/15" />
            <Skeleton className="h-11 w-32 bg-white/10" />
          </div>
        </div>
      </section>
      <section className="px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
