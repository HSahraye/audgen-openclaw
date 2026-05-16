"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { logger } from "@/lib/logger";
import { BRAND } from "@/lib/brand";

/**
 * Public short-link error boundary. Matches the audit-page tone — neutral,
 * never blames the prospect, suggests asking the sender for a fresh link.
 */
export default function ShortLinkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("audit_short_link_error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <LinkIcon className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">
            Link issue
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          We couldn&rsquo;t open that link.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The short link may have expired. Try again in a moment, or ask
          whoever sent it to share the latest version.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
          >
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
