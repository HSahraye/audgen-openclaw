import { shouldShowDemoBanner } from "@/lib/demo-mode";

/**
 * Slim banner that renders only when the caller's workspace is the
 * demo workspace or PREVIEW_MODE is on. Pure server component. No
 * client JS. No DB calls.
 *
 * Drop into any layout; renders null on production data.
 */
export function DemoModeBanner({
  workspaceSlug,
}: {
  workspaceSlug?: string | null;
}) {
  if (!shouldShowDemoBanner({ workspaceSlug })) return null;
  return (
    <div
      role="status"
      aria-label="Demo / preview mode"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-amber-900"
    >
      DEMO / PREVIEW MODE \u2014 sample data only; no real outreach or billing.
    </div>
  );
}
