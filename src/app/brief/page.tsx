import Link from "next/link";
import { ArrowRight, Phone, Ghost, Eye, Clock, Target, TrendingUp } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { estimatedDealValue, formatMoney, weightedDealValue } from "@/lib/money";
import { requireSessionRole } from "@/lib/auth";
import { getCloseProbability, getLeadPriorityState } from "@/lib/intelligence/selectors";
import { buildPrepPath } from "@/lib/prep-links";
import { strictWorkspaceScope } from "@/lib/workspace";
import { buildPipelineDailyBrief } from "@/lib/pipeline/daily-brief";
import { buildActionQueue } from "@/lib/pipeline/action-queue";
import { ActionQueueCard } from "@/components/action-queue-card";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function BriefPage() {
  // SECURITY: session-scoped workspaceId only. See SECURITY note on /leadgen.
  const session = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const workspaceId = session.workspaceId;

  // Pipeline-state action queue. Non-fatal: if the helper throws, the
  // existing heuristic hit list still renders.
  let actionQueue: Awaited<ReturnType<typeof buildActionQueue>> | null = null;
  try {
    const brief = await buildPipelineDailyBrief(workspaceId);
    actionQueue = buildActionQueue(brief);
  } catch {
    actionQueue = null;
  }
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    callsTodayLeads,
    ghostLeads,
    warmViewLeads,
    awaitingLeads,
    wonThisMonth,
    activeLeads,
    topLeads,
  ] = await Promise.all([
    // Calls due today
    prisma.lead.count({
      where: {
        ...strictWorkspaceScope(workspaceId),
        status: { notIn: ["Won", "Lost"] },
        OR: [
          { nextFollowUpAt: { lte: endOfToday } },
          { AND: [{ score: { gte: 8 } }, { nextFollowUpAt: null }] },
          { AND: [{ status: { in: ["Contacted", "Follow-up"] } }, { lastContactedAt: { lte: threeDaysAgo } }, { nextFollowUpAt: null }] },
        ],
      },
    }),
    // Ghost leads
    prisma.lead.count({
      where: {
        ...strictWorkspaceScope(workspaceId),
        status: { in: ["Contacted", "Follow-up"] },
        lastContactedAt: { lte: threeDaysAgo },
      },
    }),
    // Warm: viewed audit in last 24h
    prisma.lead.count({
      where: {
        ...strictWorkspaceScope(workspaceId),
        status: { notIn: ["Won", "Lost"] },
        viewLogs: { some: { createdAt: { gte: oneDayAgo } } },
      },
    }),
    // Awaiting: shared but viewed recently (48h)
    prisma.lead.count({
      where: {
        ...strictWorkspaceScope(workspaceId),
        status: { notIn: ["Won", "Lost"] },
        outreachLogs: { some: { type: { in: ["Share", "Email"] } } },
        viewLogs: { some: { createdAt: { gte: twoDaysAgo } } },
      },
    }),
    // Won this month
    prisma.lead.findMany({
      where: { ...strictWorkspaceScope(workspaceId), status: "Won", updatedAt: { gte: startOfMonth } },
      select: { packageName: true, customPrice: true },
    }),
    // Active pipeline
    prisma.lead.findMany({
      where: { ...strictWorkspaceScope(workspaceId), status: { notIn: ["Won", "Lost"] } },
      select: { status: true, score: true, packageName: true, customPrice: true },
      orderBy: { score: "desc" },
      take: 5,
    }),
    // Top leads for the hit list
    prisma.lead.findMany({
      where: { ...strictWorkspaceScope(workspaceId), status: { notIn: ["Won", "Lost"] } },
      select: {
        id: true,
        shortSlug: true,
        businessName: true,
        score: true,
        packageName: true,
        customPrice: true,
        intelligenceJson: true,
        phone: true,
        nextFollowUpAt: true,
        lastContactedAt: true,
        viewLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        paymentLogs: { take: 1 },
        outreachLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { score: "desc" },
      take: 20,
    }),
  ]);

  const wonRevenue = wonThisMonth.reduce((sum, l) => sum + estimatedDealValue(l.packageName, l.customPrice), 0);
  const totalPipeline = activeLeads.reduce((sum, l) => sum + estimatedDealValue(l.packageName, l.customPrice), 0);
  const weightedPipeline = activeLeads.reduce((sum, l) => sum + weightedDealValue(l.status, estimatedDealValue(l.packageName, l.customPrice)), 0);

  // Score top leads by close likelihood
  const scoredTopLeads = topLeads
    .map((lead) => {
      let s = lead.score * 6;
      if (lead.viewLogs[0]) {
        const ago = now.getTime() - lead.viewLogs[0].createdAt.getTime();
        if (ago < 24 * 3600_000) s += 25;
        else if (ago < 72 * 3600_000) s += 15;
      }
      if (lead.paymentLogs.length) s += 20;
      s += Math.round(getCloseProbability(lead) * 0.35);
      if (lead.nextFollowUpAt && lead.nextFollowUpAt <= endOfToday) s += 15;
      if (lead.phone) s += 5;
      return { ...lead, closePriority: s };
    })
    .sort((a, b) => b.closePriority - a.closePriority)
    .slice(0, 5);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const statCards = [
    { label: "Calls due today", value: callsTodayLeads, href: "/call-today", color: callsTodayLeads > 0 ? "bg-lime-300 text-slate-950" : "bg-slate-100 text-slate-500", icon: Phone, cta: "Open dialer" },
    { label: "Ghost leads", value: ghostLeads, href: "/call-today", color: ghostLeads > 0 ? "bg-orange-200 text-orange-900" : "bg-slate-100 text-slate-500", icon: Ghost, cta: "Revive" },
    { label: "Viewed audit (24h)", value: warmViewLeads, href: "/", color: warmViewLeads > 0 ? "bg-sky-200 text-sky-900" : "bg-slate-100 text-slate-500", icon: Eye, cta: "View leads" },
    { label: "Awaiting response", value: awaitingLeads, href: "/", color: awaitingLeads > 0 ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-500", icon: Clock, cta: "Follow up" },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">{BRAND.productName}</p>
            <h1 className="mt-1 text-2xl font-black">{greeting()}, Hamid 🦾</h1>
            <p className="mt-0.5 text-sm text-slate-500">{dateStr}</p>
          </div>
          <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
            Back to Home
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map(({ label, value, href, color, icon: Icon, cta }) => (
            <Link key={label} href={href} className={`rounded-[2rem] p-4 transition hover:opacity-90 ${color}`}>
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-4 opacity-70" />
                <span className="text-2xl font-black">{value}</span>
              </div>
              <p className="mt-2 text-xs font-black">{label}</p>
              {value > 0 && <p className="mt-0.5 text-xs opacity-70">{cta} →</p>}
            </Link>
          ))}
        </div>

        {/* Revenue snapshot */}
        <div className="rounded-[2rem] bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-lime-300" />
            <p className="text-xs font-black uppercase tracking-wide text-lime-300">This Month</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-lime-300">{formatMoney(wonRevenue)}</p>
              <p className="text-xs text-white/50 mt-1">Won</p>
            </div>
            <div>
              <p className="text-xl font-black">{formatMoney(weightedPipeline)}</p>
              <p className="text-xs text-white/50 mt-1">Weighted</p>
            </div>
            <div>
              <p className="text-xl font-black">{formatMoney(totalPipeline)}</p>
              <p className="text-xs text-white/50 mt-1">Total pipe</p>
            </div>
          </div>
        </div>

        {actionQueue ? <ActionQueueCard queue={actionQueue} /> : null}

        {/* Hit list */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="size-4 text-slate-600" />
            <h2 className="font-black">Today&apos;s Hit List</h2>
            <span className="ml-auto text-xs text-slate-400">Top {scoredTopLeads.length} by priority</span>
          </div>
          <div className="space-y-2">
            {scoredTopLeads.length === 0
              ? <p className="text-sm text-slate-500">No active leads — add some from the dashboard.</p>
              : scoredTopLeads.map((lead, i) => {
                const viewedRecently = lead.viewLogs[0] && (now.getTime() - lead.viewLogs[0].createdAt.getTime()) < 24 * 3600_000;
                const dueToday = lead.nextFollowUpAt && lead.nextFollowUpAt <= endOfToday;
                return (
                  <div key={lead.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-sm">{lead.businessName}</p>
                      <p className="text-xs text-slate-500">
                        Score {lead.score} · {formatMoney(estimatedDealValue(lead.packageName, lead.customPrice))}
                        {viewedRecently ? " · 👁️ viewed" : ""}
                        {lead.paymentLogs.length ? " · 💳 clicked" : ""}
                        {dueToday ? " · 📅 due" : ""}
                        {` · ${getLeadPriorityState(lead)}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-lime-300 text-slate-950 hover:bg-lime-200">
                          <Phone className="size-3.5" />
                        </a>
                      )}
                      <Link href={buildPrepPath({ id: lead.id, shortSlug: lead.shortSlug })} className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                        Internal prep
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
          <Link href="/call-today" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-black text-white transition hover:bg-slate-800">
            Start calling <ArrowRight className="size-3.5" />
          </Link>
        </div>

      </div>
    </main>
  );
}
