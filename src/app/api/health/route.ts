import { NextResponse } from "next/server";

/**
 * Public health endpoint for uptime monitors, Netlify status checks, and
 * any external watchdog that needs to know if this deployment is alive.
 *
 * Design choices:
 *  - Always responds 200 OK with a small JSON payload. The classic
 *    contract for a liveness probe — no DB call, no secrets, no auth.
 *  - Includes the deploy commit when COMMIT_REF / GITHUB_SHA /
 *    VERCEL_GIT_COMMIT_SHA / NETLIFY_COMMIT_REF is set so an on-call
 *    engineer can quickly correlate a check with a specific build. We
 *    never include user data.
 *  - Cache-Control: no-store so monitors get fresh signal.
 *  - If you ever want a deeper 'readiness' probe that pings Postgres /
 *    Stripe / Resend, build it as /api/health/ready so liveness stays
 *    fast and uncoupled from external availability.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function commitRef(): string | null {
  const raw =
    process.env.COMMIT_REF ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NETLIFY_COMMIT_REF ||
    "";
  return raw ? raw.slice(0, 12) : null;
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "auditgen",
      ts: new Date().toISOString(),
      commit: commitRef(),
      env: process.env.NODE_ENV ?? "unknown",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
