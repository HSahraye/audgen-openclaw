"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import { BRAND } from "@/lib/brand";

/**
 * Public audit error boundary. The default app-wide error.tsx says
 * "The team has been notified" — fine for internal users, wrong for a
 * prospect who just clicked a cold-email link. This boundary uses
 * neutral, prospect-friendly copy and never implies they did anything
 * wrong. It still logs the error (via the redacting logger) so we can
 * triage from the back end.
 */
export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("audit_error_boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">
            Temporary issue
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          This audit didn&rsquo;t load.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          We hit a hiccup loading this page. Try again in a moment, or ask the
          person who shared it to resend the link if the issue keeps happening.
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
            Visit {BRAND.productName}
          </Link>
        </div>
      </div>
    </main>
  );
}
