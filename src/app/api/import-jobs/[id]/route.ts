import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cancelImportJob, retryImportJob, serializeImportJob } from "@/lib/import-jobs";
import { strictWorkspaceScope } from "@/lib/workspace";
import { assertApiSessionWorkspace } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

const postBody = z.object({ action: z.enum(["retry", "cancel"]) }).strict();

export async function GET(_request: Request, { params }: Params) {
  const session = await assertApiSessionWorkspace();
  if (!session?.workspaceId) return unauthorized();
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });

  const job = await prisma.importJob.findFirst({
    where: { id, ...strictWorkspaceScope(session.workspaceId) },
  });
  if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });

  return NextResponse.json({ ok: true, job: serializeImportJob(job) });
}

export async function POST(request: Request, { params }: Params) {
  const session = await assertApiSessionWorkspace();
  if (!session?.workspaceId) return unauthorized();
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });

  const raw = await request.json().catch(() => null);
  const parsed = postBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body. Expected {\"action\":\"retry\"|\"cancel\"}." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "cancel") {
    const job = await cancelImportJob(id, session.workspaceId);
    if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });
    return NextResponse.json({ ok: true, job: serializeImportJob(job) });
  }
  const job = await retryImportJob(id, session.workspaceId);
  if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });
  return NextResponse.json({ ok: true, job: serializeImportJob(job) });
}
