import { DashboardSkeleton } from "@/components/ui/skeleton";

/**
 * Default app-wide loading state. Individual routes can ship their own
 * `loading.tsx` for richer placeholders; this guarantees we never render
 * a blank white screen during data-fetching server components.
 */
export default function GlobalLoading() {
  return <DashboardSkeleton />;
}
