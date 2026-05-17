import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, strictWorkspaceScope } from "@/lib/workspace";

type Params = { params: Promise<{ id: string }> };

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "https://presencelabs.net",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: Request, { params }: Params) {
  const origin = request.headers.get("origin");
  const { id } = await params;
  // PUBLIC route — no authenticated session. The import-job id IS the
  // capability here (Prisma cuid, not enumerable). We retain a default-
  // workspace partition (existing behaviour) but use strictWorkspaceScope
  // so the leaky `withWorkspaceFallbackScope` is not the active pattern.
  // A separate review will move this route to a per-job opaque token.
  const { workspaceId } = await getWorkspaceContext();
  const job = await prisma.importJob.findFirst({ where: { id, ...strictWorkspaceScope(workspaceId) } });
  if (!job) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404, headers: corsHeaders(origin) });
  return NextResponse.json(
    {
      ok: true,
      status: job.status,
      progress: {
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        importedRows: job.importedRows,
        skippedRows: job.skippedRows,
        failedRows: job.failedRows,
      },
      completedAt: job.completedAt?.toISOString() ?? null,
      errorSummary: job.errorSummary ?? "",
    },
    { headers: corsHeaders(origin) },
  );
}
