import { Skeleton } from "@/components/ui/skeleton";

export default function AcceptInviteLoading() {
  return (
    <main
      className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading invite…</span>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-3 h-7 w-full" />
        <Skeleton className="mt-2 h-7 w-3/4" />
        <Skeleton className="mt-6 h-11 w-40" />
      </div>
    </main>
  );
}
