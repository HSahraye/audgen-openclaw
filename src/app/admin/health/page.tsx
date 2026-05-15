import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  // Platform-admin only (ADMIN_EMAILS allowlist). NOT workspace-owner.
  await requirePlatformAdmin();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [queueRunning, queueFailed, webhookCount, auditVolume, aiFailures, activeWorkspaces] = await Promise.all([
    prisma.importJob.count({ where: { status: { in: ["Queued", "Running"] } } }),
    prisma.importJob.count({ where: { status: "Failed" } }),
    prisma.webhookEvent.count({ where: { processedAt: { gte: last24h } } }),
    prisma.eventLog.count({ where: { eventType: { in: ["lead_created", "audit_regenerated"] }, createdAt: { gte: last24h } } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: last24h }, success: false } }),
    prisma.workspace.count({ where: { status: { in: ["trialing", "active"] } } }),
  ]);

  const cards = [
    { label: "Queue Running", value: queueRunning },
    { label: "Queue Failed", value: queueFailed },
    { label: "Webhook Events (24h)", value: webhookCount },
    { label: "Audit Volume (24h)", value: auditVolume },
    { label: "AI Failures (24h)", value: aiFailures },
    { label: "Active Workspaces", value: activeWorkspaces },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">System Health</p>
            <h1 className="mt-1 text-2xl font-black">Operational Status</h1>
          </div>
          <Link href="/admin" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
            Back to Admin
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{card.label}</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
