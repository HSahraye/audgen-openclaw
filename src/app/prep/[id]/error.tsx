"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

/**
 * Per-route error boundary for the meeting-prep page. Keeps the rest of
 * the dashboard chrome intact when something goes wrong loading one
 * lead's prep view, and gives reps a clear path back to the queue.
 */
export default function PrepError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("prep_error_boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">
            Couldn&rsquo;t load meeting prep
          </p>
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-950">
          Something hiccuped loading this lead.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The error has been logged. Retry to see if it was transient, or
          head back to the queue and try a different lead.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 hover:bg-slate-50"
          >
            Back to queue
          </Link>
        </div>
      </div>
    </main>
  );
}
