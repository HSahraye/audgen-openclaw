"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // SAFETY NET: the real exception stack is already logged server-side by
    // Next.js into the platform function logs and correlates with `digest`.
    // We additionally emit through the in-app logger so that any client-side
    // log forwarder picks it up, and we surface a console.error so that QA
    // / DevTools sessions can see the digest immediately. The full
    // error.message is never rendered to the end user.
    logger.error("app_error_boundary", {
      message: error.message,
      digest: error.digest,
    });
    // eslint-disable-next-line no-console
    console.error("[audgen:error-boundary]", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Something broke</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Unexpected error</h1>
        <p className="mt-3 text-sm text-slate-600">
          The team has been notified. You can retry this view.
        </p>
        <button
          onClick={reset}
          className="mt-5 h-11 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
        >
          Try again
        </button>
        {error.digest ? (
          <p className="mt-4 select-all text-[11px] font-mono text-slate-400">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
