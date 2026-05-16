import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <main
      className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading sign-in…</span>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </main>
  );
}
