import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { processImportJobChunk, serializeImportJob } from "@/lib/import-jobs";
import { assertApiSessionWorkspace } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

export async function POST(_request: Request, { params }: Params) {
  const session = await assertApiSessionWorkspace();
  if (!session?.workspaceId) return unauthorized();
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing job id." }, { status: 400 });

  const job = await processImportJobChunk(id, undefined, session.workspaceId);
  if (!job) return NextResponse.json({ ok: false, error: "Import job not found." }, { status: 404 });

  revalidatePath("/");
  return NextResponse.json({ ok: true, job: serializeImportJob(job) });
}
