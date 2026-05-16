"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

export default function SequenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("sequence_error_boundary", {
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
            Sequence didn&rsquo;t load
          </p>
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-950">
          We couldn&rsquo;t load that sequence.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Try again, or head back to the sequence list. Any in-progress
          steps for live leads are unaffected.
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
            href="/sequences"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 hover:bg-slate-50"
          >
            All sequences
          </Link>
        </div>
      </div>
    </main>
  );
}
