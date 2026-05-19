import Link from "next/link";
import { requireWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalQueue } from "@/components/approval-queue";
import { APPROVALS_PAGE_INTRO } from "@/app/automation/approvals/approvals-empty-state";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const items = await prisma.outboundMessage.findMany({
    where: {
      workspaceId: session.workspaceId,
      status: "pending_approval",
    },
    include: {
      lead: { select: { businessName: true } },
      sequenceState: {
        include: {
          sequence: { select: { name: true } },
        },
      },
      workspace: { select: { name: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 200,
  });

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">Automation</p>
            <h1 className="mt-1 text-2xl font-black">Approval Queue</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{APPROVALS_PAGE_INTRO}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/sequences" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Sequences
            </Link>
            <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>
        <ApprovalQueue
          items={items.map((item) => ({
            id: item.id,
            channel: item.channel,
            subject: item.subject,
            body: item.body,
            scheduledAt: item.scheduledAt?.toISOString() ?? null,
            leadName: item.lead?.businessName ?? null,
            sequenceName: item.sequenceState?.sequence.name ?? null,
            workspaceName: item.workspace?.name ?? null,
          }))}
        />
      </div>
    </main>
  );
}
