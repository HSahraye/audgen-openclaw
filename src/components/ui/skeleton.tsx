import { clsx } from "clsx";

/**
 * Lightweight skeleton block. Used by route-level loading.tsx files to
 * communicate "the page is coming" without flashing empty layout.
 *
 * Tailwind-only, no client JS. Animation is the built-in `animate-pulse`.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "animate-pulse rounded-2xl bg-slate-200/70",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Common dashboard-shaped placeholder: a header row, three KPI tiles, and a
 * stack of card rows. Cheap, predictable layout to put inside `loading.tsx`.
 */
export function DashboardSkeleton({ title }: { title?: string }) {
  return (
    <main
      className="min-h-screen bg-[#f5f7f2] p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          {title ? (
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              {title}
            </p>
          ) : (
            <Skeleton className="h-4 w-32" />
          )}
          <Skeleton className="h-9 w-72" />
          <span className="sr-only">Loading {title ?? "page"}…</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>

        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    </main>
  );
}
