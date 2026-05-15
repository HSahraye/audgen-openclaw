import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { listRecentImportJobs, processImportJobChunk, serializeImportJob } from "@/lib/import-jobs";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { getAppOrigin, isAuthEnabled } from "@/lib/env";
import { enforceRateLimit } from "@/lib/request-security";

/**
 * SECURITY notes for this route:
 *
 *  - The workspaceId is always derived from the authenticated session, never
 *    from request body / query / headers. Previously the route called
 *    getWorkspaceContext() which returns the platform Default Workspace
 *    fallback for unauthenticated callers \u2014 that allowed anonymous reads/
 *    writes when auth was enabled but the session was missing.
 *  - POST requires an Origin / Sec-Fetch-Site check to prevent cross-site
 *    submission (better-auth uses the same pattern for its own endpoints).
 *  - POST body must be empty object or include {action:"process-next"}; any
 *    other shape is rejected. Strict zod parse, no implicit no-op.
 *  - Rate-limited per IP.
 */

function unauthorized() {
  // 404 (not 401/403) to avoid advertising route existence to enumerators.
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

async function enforceOrigin() {
  if (!isAuthEnabled()) return null;
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const referer = headerStore.get("referer");
  const fetchSite = headerStore.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return null;
  const expected = getAppOrigin();
  const matchesOrigin = expected && origin && origin.toLowerCase() === expected.toLowerCase();
  const matchesReferer = expected && referer && referer.toLowerCase().startsWith(expected.toLowerCase());
  if (matchesOrigin || matchesReferer) return null;
  return NextResponse.json(
    { ok: false, error: "Cross-site request blocked." },
    { status: 403 },
  );
}

const postSchema = z
  .object({
    action: z.literal("process-next").optional(),
  })
  .strict();

export async function GET() {
  const session = await assertApiSessionWorkspace();
  if (!session || !session.workspaceId) return unauthorized();
  const rateLimited = await enforceRateLimit("import-jobs:get", 60, 60_000, session.userId || undefined);
  if (rateLimited) return rateLimited;
  const jobs = await listRecentImportJobs(12, session.workspaceId);
  return NextResponse.json({ ok: true, jobs: jobs.map(serializeImportJob) });
}

export async function POST(request: Request) {
  const session = await assertApiSessionWorkspace();
  if (!session || !session.workspaceId) return unauthorized();

  const originBlock = await enforceOrigin();
  if (originBlock) return originBlock;

  const rateLimited = await enforceRateLimit(
    "import-jobs:post",
    30,
    60_000,
    session.userId || undefined,
  );
  if (rateLimited) return rateLimited;

  // Body is optional; if present it must conform to postSchema (strict).
  let body: z.infer<typeof postSchema> = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return badRequest("Invalid JSON body.");
    }
    const result = postSchema.safeParse(parsed);
    if (!result.success) return badRequest("Invalid body. Expected {} or {\"action\":\"process-next\"}.");
    body = result.data;
  }
  void body; // shape validated; only one supported action today.

  const jobs = await listRecentImportJobs(1, session.workspaceId);
  const nextQueued = jobs.find((job) => ["Queued", "Running"].includes(job.status));
  if (!nextQueued) return NextResponse.json({ ok: true, processed: false });
  const updated = await processImportJobChunk(nextQueued.id, undefined, session.workspaceId);
  if (!updated) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  return NextResponse.json({ ok: true, processed: true, job: serializeImportJob(updated) });
}
