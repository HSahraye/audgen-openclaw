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
    // SAFETY NET. By Next.js construction `app/error.tsx` MUST be a client
    // component, so this useEffect runs in the browser, not on the server.
    // The real server-side stack trace is captured automatically by Next.js
    // and emitted into the platform function logs alongside the same
    // `digest`. We saw exactly that during the 7d33cee P0:
    //
    //   ⨯ Error: A "use server" file can only export async functions, found object.
    //   ...
    //   digest: '1198092769@E352'
    //
    // Callers correlate the production reference shown to the user with
    // that digest. We also emit a structured client log here so any
    // browser-side forwarder (PostHog / Sentry / etc.) picks it up. We
    // intentionally do NOT render the stack to the end user.
    logger.error("app_error_boundary", {
      message: error.message,
      digest: error.digest,
      url: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
      ts: new Date().toISOString(),
    });
    // eslint-disable-next-line no-console
    console.error("[audgen:error-boundary]", {
      digest: error.digest,
      message: error.message,
      url: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
    });
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
