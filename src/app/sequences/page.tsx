import Link from "next/link";
import { requireWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SequencesDashboard } from "@/components/sequences-dashboard";
import { SEQUENCES_PAGE_INTRO } from "@/app/sequences/sequences-empty-state";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const sequences = await prisma.sequence.findMany({
    where: { workspaceId: session.workspaceId },
    include: {
      steps: true,
      leadStates: {
        where: { status: "active" },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">Automation</p>
            <h1 className="mt-1 text-2xl font-black">Sequence Builder</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{SEQUENCES_PAGE_INTRO}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/automation/approvals" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Approval Queue
            </Link>
            <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Back to Dashboard
            </Link>
          </div>
        </div>
        <SequencesDashboard
          sequences={sequences.map((sequence) => ({
            id: sequence.id,
            name: sequence.name,
            category: sequence.category,
            status: sequence.status,
            autoMode: sequence.autoMode,
            updatedAt: sequence.updatedAt.toISOString(),
            stepCount: sequence.steps.length,
            activeLeadCount: sequence.leadStates.length,
          }))}
        />
      </div>
    </main>
  );
}
