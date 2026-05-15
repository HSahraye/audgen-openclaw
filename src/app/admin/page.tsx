import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { getOperationalInsights } from "@/lib/automation/insights";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Platform-admin only (ADMIN_EMAILS allowlist). NOT workspace-owner.
  // Non-admins get a standard 404 from notFound() inside the gate.
  await requirePlatformAdmin();
  const [workspaces, failedImports, recentWebhooks, recentAiUsage, recentErrors, insights] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        subscriptions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.importJob.findMany({
      where: { status: "Failed" },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.webhookEvent.findMany({
      orderBy: { processedAt: "desc" },
      take: 30,
    }),
    prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.auditLog.findMany({
      where: { action: { contains: "failed" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    (async () => {
      const workspace = await prisma.workspace.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true } });
      if (!workspace) return null;
      return getOperationalInsights(workspace.id);
    })(),
  ]);

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">Internal Admin</p>
            <h1 className="mt-1 text-2xl font-black">Ops Console</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/health" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Health Dashboard
            </Link>
            <Link href="/admin/insights/scoring" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Scoring Insights
            </Link>
            <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              Back to Dashboard
            </Link>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Workspaces</p>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="p-2">Workspace</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Plan</th>
                  <th className="p-2">Subscription</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-t border-slate-100">
                    <td className="p-2 font-semibold">{workspace.name}</td>
                    <td className="p-2 uppercase">{workspace.status}</td>
                    <td className="p-2 uppercase">{workspace.planTier}</td>
                    <td className="p-2 uppercase">{workspace.subscriptions[0]?.status || "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Failed Jobs</p>
            <ul className="mt-3 space-y-2 text-sm">
              {failedImports.map((job) => (
                <li key={job.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                  {job.id} · {job.errorSummary || "No details"}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Webhook Events</p>
            <ul className="mt-3 space-y-2 text-sm">
              {recentWebhooks.map((event) => (
                <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                  {event.provider}:{event.eventId}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">AI Usage</p>
            <ul className="mt-3 space-y-2 text-sm">
              {recentAiUsage.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                  {entry.provider}/{entry.generationType} · {entry.estimatedTokensIn || 0}+{entry.estimatedTokensOut || 0} tokens · {entry.success ? "ok" : "failed"}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Failure Logs</p>
            <ul className="mt-3 space-y-2 text-sm">
              {recentErrors.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                  {entry.action} · {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {insights ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Operational AI Insights</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[...insights.hotLeads, ...insights.proposalLikelyClose, ...insights.weakSequences].slice(0, 8).map((item) => (
                <div key={item} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
