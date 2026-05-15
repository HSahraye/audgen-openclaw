import { NextResponse } from "next/server";
import { listRecentImportJobs, processImportJobChunk, serializeImportJob } from "@/lib/import-jobs";
import { getWorkspaceContext } from "@/lib/workspace";
import { enforcePlanForAction } from "@/lib/billing/enforcement";

/**
 * NOTE: workspace authentication hardening for this route lives on the
 * `security/admin-auth-hardening` branch (assertApiSessionWorkspace,
 * strict Origin checks, strict body validation). When that lands on
 * main, this file should be rebased to derive workspaceId from the
 * session rather than getWorkspaceContext().
 *
 * This branch adds the BILLING enforcement gate. On POST we call
 * enforcePlanForAction(workspaceId, 'import_lead') before processing
 * any queued job. Behaviour:
 *  - over-limit  -> 402 Payment Required with reason + upgradePrompt
 *  - warning     -> 200 ok with a `warning` string in the response (the
 *                   action still runs)
 *  - operational (suspended/delinquent/trial-expired) -> 402 with the
 *    'Update billing' upgrade prompt.
 */

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const jobs = await listRecentImportJobs(12, workspaceId);
  return NextResponse.json({ ok: true, jobs: jobs.map(serializeImportJob) });
}

export async function POST() {
  const { workspaceId } = await getWorkspaceContext();

  // Billing gate.
  const decision = await enforcePlanForAction(workspaceId, "import_lead");
  if (!decision.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: decision.reason,
        upgradePrompt: decision.upgradePrompt,
      },
      { status: 402 },
    );
  }

  const jobs = await listRecentImportJobs(1, workspaceId);
  const nextQueued = jobs.find((job) => ["Queued", "Running"].includes(job.status));
  if (!nextQueued) {
    return NextResponse.json({
      ok: true,
      processed: false,
      ...(decision.soft ? { warning: decision.warning } : {}),
    });
  }
  const updated = await processImportJobChunk(nextQueued.id, undefined, workspaceId);
  if (!updated) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    processed: true,
    job: serializeImportJob(updated),
    ...(decision.soft ? { warning: decision.warning } : {}),
  });
}
