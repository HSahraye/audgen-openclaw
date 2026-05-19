"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approveOutboundMessageAction, rejectOutboundMessageAction } from "@/app/actions/automation";
import { ApprovalsEmptyState } from "@/app/automation/approvals/approvals-empty-state";

type ApprovalItem = {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  scheduledAt: string | null;
  leadName: string | null;
  sequenceName: string | null;
  workspaceName: string | null;
};

export function ApprovalQueue({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const approve = (id: string) => {
    startTransition(async () => {
      await approveOutboundMessageAction(id);
      router.refresh();
    });
  };

  const reject = (id: string) => {
    startTransition(async () => {
      await rejectOutboundMessageAction(id);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-3">
      {!items.length ? <ApprovalsEmptyState /> : null}
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{item.channel}</p>
              <p className="mt-1 font-black text-slate-950">{item.subject || "No subject"}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Lead: {item.leadName || "n/a"} · Sequence: {item.sequenceName || "manual"} · Workspace: {item.workspaceName || "current"}
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Scheduled: {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "immediate"}
            </p>
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">{item.body}</pre>
          <div className="mt-3 flex gap-2">
            <button disabled={isPending} onClick={() => approve(item.id)} className="rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-lime-200 disabled:opacity-60">
              Approve
            </button>
            <button disabled={isPending} onClick={() => reject(item.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
