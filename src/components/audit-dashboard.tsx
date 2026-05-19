"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, memo, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, BarChart3, CheckCircle2, ChevronDown, Copy, ExternalLink, Filter, Loader2, Mail, Phone, Radar, RefreshCw, Search, Share2, Sparkles, Trash2, XCircle } from "lucide-react";
import { createCaseStudyAction } from "@/app/actions/case-studies";
import { startLeadSequenceAction } from "@/app/actions/automation";
import { createLeadAction, deleteLeadAction, importLeadsCsvAction, logOutreachAction, regenerateLeadAction, updateLeadNotesAction, updateLeadOfferAction, updateLeadShortSlugAction, updateLeadStatusAction } from "@/app/actions/leads";
import { BRANDING_CONFIG } from "@/config/branding";
import { AuditGenBrandLockup } from "@/components/brand/auditgen-brand-lockup";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { sanitizePublicBrandCopy } from "@/lib/branding";
import { parseLeadForDashboard } from "@/components/audit-dashboard-utils";
import { buildMailtoHref, buildSmsHref, buildWhatsAppHref } from "@/lib/communication/links";
import { getCloseProbability, getLeadHealthState, getLeadPriorityState, getMomentumLevel, getUrgencyLevel } from "@/lib/intelligence/selectors";
import { toCsv } from "@/lib/csv";
import { estimatedDealValue, formatMoney, weightedDealValue } from "@/lib/money";
import { buildPrepPath } from "@/lib/prep-links";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditChecks, GeneratedAssets } from "@/lib/types";

type LeadStatus = "New" | "Contacted" | "Follow-up" | "Won" | "Lost";

type CaseStudyRow = { id: string; title: string; result: string; description: string; imageUrl: string | null; category: string | null };

type LeadRow = {
  id: string;
  businessName: string;
  ownerName: string | null;
  category: string | null;
  location: string | null;
  websiteUrl: string | null;
  googleProfileUrl: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  score: number;
  shortSlug: string | null;
  publicAuditPath: string;
  packageName: string;
  customPrice: number | null;
  stripePaymentUrl: string | null;
  attachedCaseStudyId: string | null;
  attachedCaseStudy: CaseStudyRow | null;
  painSummary: string;
  auditJson: string;
  assetsJson: string;
  intelligenceJson: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  outreachLogs: Array<{ id: string; type: string; notes: string | null; createdAt: string }>;
  viewCount: number;
  lastViewedAt: string | null;
  paymentClickCount: number;
  lastPaymentClickedAt: string | null;
  paymentStatus: string;
  lastPaymentAt: string | null;
  sequenceStates: Array<{
    id: string;
    sequenceId: string;
    sequenceName: string;
    status: string;
    currentStep: number;
    nextRunAt: string | null;
    lastError: string | null;
    lastMessageStatus: string | null;
    lastMessageRetryCount: number;
    lastMessageAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

type LeadView = LeadRow & {
  status: LeadStatus;
  audit: {
    checks: AuditChecks;
    websiteSignals: string[];
    warnings: string[];
    source: string;
    aiGenerated?: boolean;
    vertical?: string | null;
    verticalDisplayName?: string | null;
    pending?: boolean;
    requestedAt?: string | null;
  };
  assets: GeneratedAssets;
  intelligence?: { momentumScore?: number; urgencyScore?: number; closeProbability?: number } | null;
};

type CreateLeadState = { ok: boolean; error: string };
const initialState: CreateLeadState = { ok: false, error: "" };
const importInitialState = { ok: false as const, imported: 0, skipped: 0, failed: 0, duplicateCount: 0, invalidCount: 0, limitSkipped: 0, queued: false, jobId: "", error: "" };
const offerInitialState = { ok: false as const, error: "", leadId: "" };
const shortSlugInitialState = { ok: false as const, error: "", leadId: "" };
const caseStudyInitialState = { ok: false as const, error: "" };
const statuses: LeadStatus[] = ["New", "Contacted", "Follow-up", "Won", "Lost"];
const standardPackages = ["Presence Labs Launch Package", "Presence Labs Conversion Upgrade", "Presence Labs Local Trust Tune-Up"];

type ImportJobView = {
  id: string;
  status: string;
  mode: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errorSummary: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

type SequenceOption = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived";
};

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60">
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? "Importing..." : "Import CSV"}
    </button>
  );
}

function OfferSaveButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60">{pending ? "Saving..." : "Save offer"}</button>;
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-rose-500 text-white";
  if (score >= 70) return "bg-amber-400 text-slate-950";
  return "bg-lime-300 text-slate-950";
}

function statusTone(status: LeadStatus) {
  const tones: Record<LeadStatus, string> = {
    New: "bg-slate-100 text-slate-700 border-slate-200",
    Contacted: "bg-sky-50 text-sky-700 border-sky-100",
    "Follow-up": "bg-amber-50 text-amber-800 border-amber-100",
    Won: "bg-lime-50 text-lime-800 border-lime-100",
    Lost: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return tones[status];
}

function Field({ label, name, placeholder, type = "text" }: { label: string; name: string; placeholder: string; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input name={name} type={type} placeholder={placeholder} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none ring-lime-300/40 transition placeholder:text-slate-400 focus:border-lime-400 focus:ring-4" />
    </label>
  );
}

function CheckItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {value ? <CheckCircle2 className="size-5 text-lime-600" /> : <XCircle className="size-5 text-rose-500" />}
    </div>
  );
}

function NotesSaveButton({ saved, saving }: { saved: boolean; saving: boolean }) {
  return (
    <button disabled={saving} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:opacity-60 ${saved ? "bg-lime-300 text-slate-950" : "bg-slate-950 text-white hover:bg-slate-800"}`}>
      {saving ? <Loader2 className="size-4 animate-spin" /> : null}
      {saving ? "Saving..." : saved ? "Saved!" : "Save notes"}
    </button>
  );
}

function ScriptBox({ title, value, copyLabel }: { title: string; value: string; copyLabel?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{title}</h3>
        <button onClick={() => navigator.clipboard.writeText(value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-950" aria-label={`Copy ${title}`}>
          <Copy className="size-4" /> {copyLabel ?? "Copy"}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

const MonthlyGoalCard = memo(function MonthlyGoalCard({ wonRevenue }: { wonRevenue: number }) {
  const [monthlyGoal, setMonthlyGoal] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem("pl-monthly-goal");
    return stored ? Number(stored) : 0;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const saveGoal = () => {
    const val = Math.max(0, parseInt(goalInput.replace(/[^0-9]/g, ""), 10) || 0);
    setMonthlyGoal(val);
    localStorage.setItem("pl-monthly-goal", String(val));
    setEditingGoal(false);
  };

  const clearGoal = () => {
    setMonthlyGoal(0);
    setGoalInput("");
    setEditingGoal(false);
    localStorage.removeItem("pl-monthly-goal");
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-900">Monthly Goal</p>
        <button
          onClick={() => {
            setGoalInput(monthlyGoal > 0 ? String(monthlyGoal) : "");
            setEditingGoal(true);
          }}
          className="text-xs font-black text-slate-500 hover:text-slate-700"
        >
          {monthlyGoal > 0 ? "Edit" : "Set goal"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Set a monthly won-revenue target to track progress.</p>
      {editingGoal ? (
        <div className="mt-2 flex gap-2">
          <input
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveGoal();
              if (e.key === "Escape") setEditingGoal(false);
            }}
            placeholder="e.g. 5000"
            className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-lime-400"
          />
          <button onClick={saveGoal} className="h-9 rounded-xl bg-lime-300 px-3 text-xs font-black text-slate-950 hover:bg-lime-200">Save</button>
          <button onClick={clearGoal} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Clear</button>
        </div>
      ) : monthlyGoal > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <p className={`text-3xl font-black ${wonRevenue >= monthlyGoal ? "text-lime-600" : "text-slate-950"}`}>
              {Math.round((wonRevenue / monthlyGoal) * 100)}%
            </p>
            <p className="text-sm font-bold text-slate-500">
              {formatMoney(wonRevenue)} / {formatMoney(monthlyGoal)}
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${wonRevenue >= monthlyGoal ? "bg-lime-400" : wonRevenue / monthlyGoal >= 0.5 ? "bg-yellow-400" : "bg-rose-400"}`}
              style={{ width: `${Math.min(100, (wonRevenue / monthlyGoal) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {wonRevenue >= monthlyGoal ? "🎉 Goal hit!" : `${formatMoney(monthlyGoal - wonRevenue)} to go`}
          </p>
          <button onClick={clearGoal} className="mt-2 text-xs font-black text-slate-500 underline underline-offset-2 hover:text-slate-700">
            Clear goal
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-500">No goal set yet</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-0 rounded-full bg-slate-200" />
          </div>
        </>
      )}
    </div>
  );
});

export function AuditDashboard({
  leads,
  caseStudies,
  todayActivity,
  latestImportJob,
  importJobs,
  opsMetrics,
  activeWorkspaceId,
  workspaceOptions,
  canManageWorkspace,
  sequences,
  publicBaseUrl,
  senderCompanyName,
}: {
  leads: LeadRow[];
  caseStudies: CaseStudyRow[];
  todayActivity: { calls: number; sms: number; emails: number };
  latestImportJob: ImportJobView | null;
  importJobs: ImportJobView[];
  opsMetrics: { queueDepth: number; failedJobsCount: number; eventsLast24h: number };
  activeWorkspaceId: string;
  workspaceOptions: Array<{ workspaceId: string; workspaceSlug: string; workspaceName: string; role: string }>;
  canManageWorkspace: boolean;
  sequences: SequenceOption[];
  publicBaseUrl: string;
  senderCompanyName: string;
}) {
  const router = useRouter();
  const [importState, importFormAction] = useActionState(importLeadsCsvAction, importInitialState);
  const [offerState, offerFormAction] = useActionState(updateLeadOfferAction, offerInitialState);
  const [shortSlugState, shortSlugFormAction] = useActionState(updateLeadShortSlugAction, shortSlugInitialState);
  const [caseStudyState, caseStudyFormAction] = useActionState(createCaseStudyAction, caseStudyInitialState);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [isSavingNotes, startNotesTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();
  // Tracks WHICH lead is currently regenerating so the per-row button
  // can show a spinner on only that row while keeping the Lead-Notes
  // panel button in sync. Combined with the global `isRegenerating`
  // transition flag, this guarantees only one regen runs at a time
  // (preventing accidental double-charges if a user clicks two rows in
  // quick succession before the first call returns).
  const [regeneratingLeadId, setRegeneratingLeadId] = useState<string | null>(null);
  const [copiedLeadId, setCopiedLeadId] = useState("");
  const [copiedPrepLeadId, setCopiedPrepLeadId] = useState("");
  const [notesSavedLeadId, setNotesSavedLeadId] = useState("");
  const [notesError, setNotesError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [minimumScore, setMinimumScore] = useState(0);
  const [dailyOnly, setDailyOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [closePrompt, setClosePrompt] = useState<{ id: string; status: "Won" | "Lost"; businessName: string } | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [enrollLeadId, setEnrollLeadId] = useState("");
  const [enrollSequenceId, setEnrollSequenceId] = useState("");
  const [enrollSchedule, setEnrollSchedule] = useState("");
  const [openOutreachLeadId, setOpenOutreachLeadId] = useState("");
  const [createLeadState, setCreateLeadState] = useState(initialState);
  const [isCreatingLead, startCreateLeadTransition] = useTransition();
  const [isEnrolling, startEnrollTransition] = useTransition();
  const [activeImportJob, setActiveImportJob] = useState<ImportJobView | null>(latestImportJob);
  const [recentImportJobs, setRecentImportJobs] = useState<ImportJobView[]>(importJobs);
  const isImportTickingRef = useRef(false);
  const didRefreshCompletedImportRef = useRef(false);
  const queuedImportJobId = importState.ok && importState.queued ? importState.jobId : "";
  const trackedImportJobId = queuedImportJobId || activeImportJob?.id || "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNowMs(Date.now());
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (offerState.ok && offerState.leadId) {
      router.refresh();
    }
  }, [offerState.ok, offerState.leadId, router]);

  useEffect(() => {
    if (shortSlugState.ok && shortSlugState.leadId) {
      router.refresh();
    }
  }, [shortSlugState.ok, shortSlugState.leadId, router]);

  useEffect(() => {
    if (!trackedImportJobId) return;
    if (
      activeImportJob?.id === trackedImportJobId &&
      (activeImportJob.status === "Completed" || activeImportJob.status === "Failed")
    ) {
      return;
    }
    if (activeImportJob?.id !== trackedImportJobId) {
      didRefreshCompletedImportRef.current = false;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled || isImportTickingRef.current) return;
      isImportTickingRef.current = true;
      try {
        await fetch("/api/import-jobs", { method: "POST" });
        const statusRes = await fetch(`/api/import-jobs/${trackedImportJobId}`, { cache: "no-store" });
        if (!statusRes.ok) return;
        const payload = (await statusRes.json()) as { ok?: boolean; job?: ImportJobView };
        if (!cancelled && payload.job) setActiveImportJob(payload.job);
        const listRes = await fetch("/api/import-jobs", { cache: "no-store" });
        if (listRes.ok) {
          const listPayload = (await listRes.json()) as { jobs?: ImportJobView[] };
          if (!cancelled && listPayload.jobs) setRecentImportJobs(listPayload.jobs);
        }
      } finally {
        isImportTickingRef.current = false;
      }
    };

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeImportJob?.id, activeImportJob?.status, trackedImportJobId]);

  useEffect(() => {
    if (!activeImportJob) return;
    if (activeImportJob.status !== "Completed") return;
    if (didRefreshCompletedImportRef.current) return;
    didRefreshCompletedImportRef.current = true;
    router.refresh();
  }, [activeImportJob, router]);

  const updateImportJob = async (jobId: string, action: "cancel" | "retry") => {
    await fetch(`/api/import-jobs/${jobId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const listRes = await fetch("/api/import-jobs", { cache: "no-store" });
    if (listRes.ok) {
      const payload = (await listRes.json()) as { jobs?: ImportJobView[] };
      if (payload.jobs) setRecentImportJobs(payload.jobs);
      const active = payload.jobs?.find((job) => job.status === "Queued" || job.status === "Running") ?? null;
      setActiveImportJob(active);
    }
  };

  const parsedLeads = useMemo<LeadView[]>(
    () =>
      leads.map((lead) => {
        // Defensive — `parseLeadForDashboard` handles the entire
        // assetsJson + auditJson decoding with a hard isolation
        // boundary: malformed/partial JSON renders with empty
        // placeholders + a console.warn rather than crashing the
        // entire dashboard. See the contract test
        // `parse-lead-for-dashboard.test.ts` for the orphan-data
        // regression guard. History note in audit-dashboard-utils.ts.
        const parsed = parseLeadForDashboard({
          id: lead.id,
          businessName: lead.businessName,
          status: lead.status,
          auditJson: lead.auditJson,
          assetsJson: lead.assetsJson,
          intelligenceJson: lead.intelligenceJson ?? null,
        });
        return {
          ...lead,
          status: parsed.status,
          audit: parsed.audit,
          assets: parsed.assets,
          intelligence: parsed.intelligence,
        };
      }),
    [leads],
  );

  // Polling: while ANY visible lead has an in-flight LLM
  // regeneration (audit.pending === true), refresh the dashboard
  // every 8 seconds so the new audit appears as soon as the
  // Background Function completes. Polling stops automatically when
  // no lead is pending.
  //
  // 8 seconds is the right balance: short enough that the user sees
  // the new audit within ~10s of the LLM finishing, long enough that
  // we don't hammer the server during the typical 30-90s LLM call.
  // The effect is keyed on the boolean (any pending) so it only
  // re-arms when that boolean transitions, not on every leads
  // re-render.
  const anyLeadAuditPending = parsedLeads.some((lead) => lead.audit.pending === true);
  useEffect(() => {
    if (!anyLeadAuditPending) return;
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 8_000);
    return () => window.clearInterval(intervalId);
  }, [anyLeadAuditPending, router]);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return parsedLeads.filter((lead) => {
      const searchable = [lead.businessName, lead.websiteUrl, lead.googleProfileUrl, lead.location, lead.category, lead.notes, lead.painSummary, lead.auditJson, lead.assetsJson].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = query ? searchable.includes(query) : true;
      const matchesStatus = statusFilter === "All" ? true : lead.status === statusFilter;
      const matchesScore = lead.score >= minimumScore;
      const matchesDaily = dailyOnly ? Boolean(lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= nowMs) : true;
      const matchesHot = hotOnly ? Boolean(lead.lastViewedAt && nowMs - new Date(lead.lastViewedAt).getTime() <= 48 * 60 * 60 * 1000) : true;
      return matchesSearch && matchesStatus && matchesScore && matchesDaily && matchesHot;
    });
  }, [dailyOnly, hotOnly, minimumScore, nowMs, parsedLeads, searchQuery, statusFilter]);

  const selected = filteredLeads.find((lead) => lead.id === selectedId) ?? filteredLeads[0] ?? undefined;
  const bestLead = parsedLeads[0];
  const statusCounts = useMemo(() => Object.fromEntries(statuses.map((status) => [status, parsedLeads.filter((lead) => lead.status === status).length])) as Record<LeadStatus, number>, [parsedLeads]);
  const moneyStats = useMemo(() => {
    const openStatuses: LeadStatus[] = ["New", "Contacted", "Follow-up"];
    return parsedLeads.reduce(
      (stats, lead) => {
        const value = estimatedDealValue(lead.packageName || lead.assets.recommendedPackage, lead.customPrice);
        if (openStatuses.includes(lead.status)) stats.totalPipeline += value;
        stats.weightedPipeline += weightedDealValue(lead.status, value);
        if (lead.status === "Won") stats.wonRevenue += value;
        return stats;
      },
      { totalPipeline: 0, weightedPipeline: 0, wonRevenue: 0 },
    );
  }, [parsedLeads]);
  const warmLeads = useMemo(() => parsedLeads
    .filter((lead) => lead.lastViewedAt && nowMs - new Date(lead.lastViewedAt).getTime() <= 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.lastViewedAt ?? 0).getTime() - new Date(a.lastViewedAt ?? 0).getTime())
    .slice(0, 5), [nowMs, parsedLeads]);

  // Ghost Hunter: Contacted/Follow-up leads with no outreach in 3+ days
  const ghostLeads = useMemo(() => parsedLeads
    .filter((lead) => {
      if (!(["Contacted", "Follow-up"] as string[]).includes(lead.status)) return false;
      const priority = getLeadPriorityState(lead);
      if (priority === "REENGAGE" || priority === "STALE" || priority === "COOLING") return true;
      const lastTouch = lead.lastContactedAt ? new Date(lead.lastContactedAt).getTime() : new Date(lead.createdAt).getTime();
      return nowMs - lastTouch >= 3 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6), [nowMs, parsedLeads]);

  // Awaiting Response: shared audit but not yet converted
  const awaitingLeads = useMemo(() => parsedLeads
    .filter((lead) => {
      if ((["Won", "Lost"] as string[]).includes(lead.status)) return false;
      const hasShare = lead.outreachLogs.some((log) => log.type === "Share" || log.type === "Email");
      return hasShare;
    })
    .map((lead) => ({
      ...lead,
      viewed: Boolean(lead.lastViewedAt),
      viewedRecently: lead.lastViewedAt ? nowMs - new Date(lead.lastViewedAt).getTime() < 48 * 60 * 60 * 1000 : false,
      urgency: getUrgencyLevel(lead),
      lastSharedAt: lead.outreachLogs
        .filter((log) => log.type === "Share" || log.type === "Email")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ?? null,
    }))
    .sort((a, b) => {
      // Viewed recently = call NOW (highest priority)
      if (a.viewedRecently !== b.viewedRecently) return a.viewedRecently ? -1 : 1;
      // Viewed at all > not viewed
      if (a.viewed !== b.viewed) return a.viewed ? -1 : 1;
      if (a.urgency !== b.urgency) return a.urgency === "high" ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 6), [nowMs, parsedLeads]);

  // Strike Window: leads that viewed the audit in the last 2 hours — golden closing window
  const strikeLeads = useMemo(() => parsedLeads
    .filter((lead) => {
      if (([ "Won", "Lost"] as string[]).includes(lead.status)) return false;
      if (!lead.lastViewedAt) return false;
      return nowMs - new Date(lead.lastViewedAt).getTime() <= 2 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.lastViewedAt ?? 0).getTime() - new Date(a.lastViewedAt ?? 0).getTime()),
  [nowMs, parsedLeads]);

  // Top Closes This Week: composite priority rank
  const topCloseLeads = useMemo(() => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return parsedLeads
      .filter((l) => !([ "Won", "Lost"] as string[]).includes(l.status))
      .map((lead) => {
        let score = lead.score * 6; // 0–60 base
        // Viewed audit recently
        if (lead.lastViewedAt) {
          const agoMs = nowMs - new Date(lead.lastViewedAt).getTime();
          if (agoMs < oneDayMs) score += 25;
          else if (agoMs < 3 * oneDayMs) score += 15;
          else if (agoMs < 7 * oneDayMs) score += 8;
        }
        // Payment intent click
        if (lead.paymentClickCount > 0) score += 20;
        if (getMomentumLevel(lead) === "rising") score += 10;
        if (getMomentumLevel(lead) === "cooling") score -= 6;
        if (getUrgencyLevel(lead) === "high") score += 10;
        score += Math.round(getCloseProbability(lead) * 0.25);
        // Follow-up due soon
        if (lead.nextFollowUpAt) {
          const dueMs = new Date(lead.nextFollowUpAt).getTime() - nowMs;
          if (dueMs <= 0) score += 15; // overdue
          else if (dueMs < 2 * oneDayMs) score += 10;
          else if (dueMs < sevenDays) score += 5;
        }
        // Has contact info
        if (lead.phone) score += 5;
        // Status bonus
        if (lead.status === "Follow-up") score += 8;
        if (lead.status === "Contacted") score += 4;
        return { lead: { ...lead, priorityState: getLeadPriorityState(lead), healthState: getLeadHealthState(lead) }, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ lead }) => lead);
  }, [nowMs, parsedLeads]);

  const auditUrl = (lead: LeadView) => `${publicBaseUrl}${lead.publicAuditPath}`;
  const prepUrl = (lead: LeadView) => `${publicBaseUrl}${buildPrepPath({ id: lead.id, shortSlug: lead.shortSlug })}`;

  const copyAuditUrl = async (lead: LeadView) => {
    await navigator.clipboard.writeText(auditUrl(lead));
    setCopiedLeadId(lead.id);
    void logOutreachAction(lead.id, "Share", "Copied public audit link");
    window.setTimeout(() => setCopiedLeadId((current) => (current === lead.id ? "" : current)), 1800);
  };

  const copyPrepUrl = async (lead: LeadView) => {
    await navigator.clipboard.writeText(prepUrl(lead));
    setCopiedPrepLeadId(lead.id);
    window.setTimeout(() => setCopiedPrepLeadId((current) => (current === lead.id ? "" : current)), 1800);
  };

  const deleteLead = (id: string, name: string) => {
    if (!window.confirm(`Delete lead for ${name}? This removes it from the local SQLite database.`)) return;
    setActionError("");
    startDeleteTransition(async () => {
      try {
        const result = await deleteLeadAction(id);
        if (!result.ok) {
          setActionError(result.error ?? "Lead could not be deleted.");
          return;
        }
        if (selectedId === id) setSelectedId("");
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Lead could not be deleted.");
      }
    });
  };

  const updateStatus = (id: string, status: LeadStatus, skipPrompt = false) => {
    setActionError("");
    // Intercept Won/Lost for close reason capture
    if ((status === "Won" || status === "Lost") && !skipPrompt) {
      const lead = parsedLeads.find((l) => l.id === id);
      setCloseReason("");
      setClosePrompt({ id, status, businessName: lead?.businessName ?? "" });
      return;
    }
    startStatusTransition(async () => {
      try {
        const result = await updateLeadStatusAction(id, status);
        if (!result.ok) setActionError(result.error ?? "Lead status could not be updated.");
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Lead status could not be updated.");
      }
    });
  };

  const confirmClose = () => {
    if (!closePrompt) return;
    const { id, status } = closePrompt;
    setClosePrompt(null);
    startStatusTransition(async () => {
      try {
        await updateLeadStatusAction(id, status);
        if (closeReason.trim()) {
          const prefix = status === "Won" ? "🎉 WON" : "❌ LOST";
          await logOutreachAction(id, "Note", `${prefix}: ${closeReason.trim()}`);
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not update lead.");
      }
    });
    setCloseReason("");
  };

  const wonReasons = ["Sent audit + followed up", "Referral", "Cold call", "In-person / networking", "Email outreach", "They reached out to me"];
  const lostReasons = ["Price too high", "Wrong timing", "Using someone else", "No budget", "Went silent / ghosted", "Not interested", "Chose competitor"];

  const exportLeadsCsv = () => {
    const headers = ["id", "business name", "website", "city", "industry/category", "lead score", "status", "notes", "audit summary", "pain points", "recommended offer", "cold call script", "sms script", "email draft", "created date", "updated date"];
    const rows = parsedLeads.map((lead) => ({
      id: lead.id,
      "business name": lead.businessName,
      website: lead.websiteUrl ?? "",
      city: lead.location ?? "",
      "industry/category": lead.category ?? "",
      "lead score": String(lead.score),
      status: lead.status,
      notes: lead.notes ?? "",
      "audit summary": lead.painSummary,
      "pain points": lead.assets.painPointSummary,
      "recommended offer": lead.assets.recommendedPackage,
      "cold call script": lead.assets.coldCallScript,
      "sms script": lead.assets.textMessageScript,
      "email draft": lead.assets.emailScript,
      "created date": lead.createdAt,
      "updated date": lead.updatedAt,
    }));
    const blob = new Blob([toCsv(rows, headers)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${BRANDING_CONFIG.appName.toLowerCase()}-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeSequences = useMemo(() => sequences.filter((sequence) => sequence.status === "active"), [sequences]);

  const enrollLeadInSequence = () => {
    if (!enrollLeadId || !enrollSequenceId) {
      setActionError("Select a lead and active sequence before enrolling.");
      return;
    }
    setActionError("");
    startEnrollTransition(async () => {
      const formData = new FormData();
      formData.set("leadId", enrollLeadId);
      formData.set("sequenceId", enrollSequenceId);
      if (enrollSchedule) formData.set("scheduledStartAt", enrollSchedule);
      const result = await startLeadSequenceAction(formData);
      if (!result.ok) {
        setActionError(result.error || "Could not enroll lead.");
        return;
      }
      setEnrollLeadId("");
      setEnrollSequenceId("");
      setEnrollSchedule("");
    });
  };

  const markEmailDrafted = (id: string) => {
    void logOutreachAction(id, "Email", "Opened email draft with public audit link");
  };

  const smsDraftUrl = (lead: LeadView) =>
    buildSmsHref(lead.phone ?? "", `Hi, this is Hamid with ${senderCompanyName}. I made a quick online presence audit for ${lead.businessName}: ${auditUrl(lead)}`);
  const whatsappDraftUrl = (lead: LeadView) =>
    buildWhatsAppHref(lead.phone ?? "", `Hi, this is Hamid with ${senderCompanyName}. I made a quick online presence audit for ${lead.businessName}: ${auditUrl(lead)}`);

  const emailDraftUrl = (lead: LeadView) => {
    const subject = `Online Presence Audit: ${lead.category || "Local Business"} - ${lead.businessName}`;
    const body = `Hi,\n\nI put together a quick online presence audit for ${lead.businessName}. It highlights a few ways the business may be able to turn more Google/profile visitors into calls or booked jobs.\n\nAudit link: ${auditUrl(lead)}\n\nBest,\nHamid\n${senderCompanyName}`;
    return buildMailtoHref(subject, body);
  };

  const saveNotes = (formData: FormData, id: string) => {
    setNotesError("");
    startNotesTransition(async () => {
      try {
        const result = await updateLeadNotesAction(formData);
        if (result.ok) {
          setNotesSavedLeadId(id);
          window.setTimeout(() => setNotesSavedLeadId((current) => (current === id ? "" : current)), 1800);
          return;
        }
        setNotesError(result.error ?? "Notes could not be saved.");
      } catch (error) {
        setNotesError(error instanceof Error ? error.message : "Notes could not be saved.");
      }
    });
  };

  const regenerateLead = (id: string, form?: HTMLFormElement | null) => {
    setActionError("");
    setRegeneratingLeadId(id);
    const notes = form ? String(new FormData(form).get("notes") ?? "") : undefined;
    startRegenerateTransition(async () => {
      try {
        const result = await regenerateLeadAction(id, notes);
        if (!result.ok) setActionError(result.error ?? "Audit could not be regenerated.");
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Audit could not be regenerated.");
      } finally {
        // Always clear the per-row spinner, even on error — otherwise
        // the row stays stuck on "Regenerating..." until a page reload.
        setRegeneratingLeadId(null);
      }
    });
  };

  const submitCreateLead = (form: HTMLFormElement) => {
    setCreateLeadState(initialState);
    startCreateLeadTransition(async () => {
      const result = await createLeadAction(undefined, new FormData(form));
      if (!result.ok) {
        setCreateLeadState({ ok: false, error: result.error || "Could not create lead. Please try again." });
        return;
      }
      setCreateLeadState({ ok: true, error: "" });
      if (result.leadId) setSelectedId(result.leadId);
      form.reset();
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f7f2] text-slate-950">
      {/* Win/Loss Close Reason Modal */}
      {closePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${
              closePrompt.status === "Won" ? "bg-lime-300 text-slate-950" : "bg-rose-100 text-rose-700"
            }`}>
              {closePrompt.status === "Won" ? "🎉 Marking Won" : "❌ Marking Lost"}
            </div>
            <h2 className="text-lg font-black">{closePrompt.businessName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {closePrompt.status === "Won" ? "How did you close it?" : "What killed the deal?"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(closePrompt.status === "Won" ? wonReasons : lostReasons).map((reason) => (
                <button key={reason} onClick={() => setCloseReason(reason)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    closeReason === reason
                      ? closePrompt.status === "Won" ? "bg-lime-300 text-slate-950" : "bg-rose-200 text-rose-800"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}>
                  {reason}
                </button>
              ))}
            </div>
            <input
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Or type a custom reason..."
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-lime-400"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={confirmClose}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black text-white transition ${
                  closePrompt.status === "Won" ? "bg-lime-500 hover:bg-lime-400" : "bg-rose-500 hover:bg-rose-400"
                }`}>
                Confirm {closePrompt.status}
              </button>
              <button onClick={() => setClosePrompt(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="w-full px-3 py-4 sm:px-4 lg:px-6">
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/70 to-emerald-50/40 p-4 shadow-sm sm:p-5">
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)", backgroundSize: "18px 18px" }} />
            <div className="pointer-events-none absolute -left-8 top-8 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="pointer-events-none absolute left-44 top-10 h-40 w-40 rounded-full bg-sky-100/40 blur-3xl" />
            <div className="relative grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <AuditGenBrandLockup />
                <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.05rem]">
                  Find, qualify, and close high-fit local business leads with one AI Sales OS.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#64748B]">
                  Stop wasting hours switching between scraping tools, cold outreach software, and CRMs. Discover local business service opportunities, score their online presence gaps, generate conversion-focused AI audits, and manage your entire sales motion inside AudGen.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">AI audits</span>
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">Lead scoring</span>
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">Outreach workflows</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link href="/call-today" className="rounded-2xl bg-[#10B981] px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400">📞 Call Today</Link>
                  <Link href="/brief" className="rounded-2xl bg-[#0F172A] px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800">📅 Daily Brief</Link>
                  <Link href="/leadgen" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">LeadGen Command Center</Link>
                  <Link href="/outreach" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Start Outreach</Link>
                  <Link href="/research" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Lead Research Queue</Link>
                  <Link href="/sequences" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Sequences</Link>
                  <Link href="/automation/approvals" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Approvals</Link>
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">How {BRANDING_CONFIG.appName} works</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {["Find Leads", "Qualify Gaps", "Generate AI Audits", "Run Outreach", "Track Revenue"].map((step, index, steps) => (
                      <Fragment key={step}>
                        <span className={`inline-flex h-9 items-center rounded-xl px-3 text-xs font-black ${
                          index === steps.length - 1
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}>
                          {step}
                        </span>
                        {index < steps.length - 1 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500">→</span>
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 gap-2.5">
                <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Workspace</p>
                  <div className="mt-2">
                    <WorkspaceSwitcher activeWorkspaceId={activeWorkspaceId} items={workspaceOptions} canManageWorkspace={canManageWorkspace} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-4 text-[#10B981]" />
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Saved leads</p>
                    </div>
                    <p className="mt-2 text-xl font-black text-[#0F172A]">{parsedLeads.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Intent events</p>
                    <p className="mt-2 text-xl font-black text-[#0F172A]">{opsMetrics.eventsLast24h}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Top lead preview</p>
                  <p className="mt-2 text-sm font-black text-[#0F172A]">{bestLead?.businessName ?? "No leads yet"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">Audit score {bestLead?.score ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 items-start gap-4 px-3 py-6 sm:px-4 lg:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="w-full xl:max-w-[320px] flex flex-col rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto">
          <div className="order-1 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">Lead list tools</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Import, paste, and manage lead sources.</p>
              </div>
              <button type="button" onClick={exportLeadsCsv} className="rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-lime-200">Export CSV</button>
            </div>
            <form action={importFormAction} className="mt-4 grid gap-3">
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Upload CSV
                <input type="file" name="csvFile" accept=".csv,text/csv" className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold normal-case tracking-normal text-slate-700" />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Or paste CSV
                <textarea name="csvText" rows={5} placeholder="business name,website,city,industry/category,phone,email,notes" className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none focus:border-lime-400" />
              </label>
              <ImportButton />
              {importState.ok ? <p className="rounded-xl bg-lime-50 p-3 text-xs font-black text-lime-800">Imported {importState.imported} • Skipped {importState.skipped} • Failed {importState.failed}{importState.duplicateCount ? ` • Duplicates ${importState.duplicateCount}` : ""}{importState.invalidCount ? ` • Invalid ${importState.invalidCount}` : ""}</p> : null}
              {importState.limitSkipped ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-black text-amber-800">Skipped {importState.limitSkipped} rows due to current plan capacity.</p> : null}
              {importState.ok && importState.error ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-black text-amber-800">{importState.error}</p> : null}
              {!importState.ok && importState.error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-black text-rose-700">{importState.error}</p> : null}
              {activeImportJob ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-black text-sky-900">
                  <p>
                    Background import: {activeImportJob.status} • {activeImportJob.processedRows}/{activeImportJob.totalRows || "?"} processed
                  </p>
                  <p className="mt-1 text-sky-700">
                    Imported {activeImportJob.importedRows} • Skipped {activeImportJob.skippedRows} • Failed {activeImportJob.failedRows}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${activeImportJob.totalRows > 0 ? Math.min(100, (activeImportJob.processedRows / activeImportJob.totalRows) * 100) : 0}%` }}
                    />
                  </div>
                  {activeImportJob.errorSummary ? <p className="mt-2 text-[11px] font-bold text-rose-700">{activeImportJob.errorSummary}</p> : null}
                </div>
              ) : null}
              {recentImportJobs.length ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Recent import jobs</p>
                  <div className="mt-2 grid gap-2">
                    {recentImportJobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px]">
                        <p className="font-black text-slate-700">
                          {job.status} • {job.processedRows}/{job.totalRows}
                        </p>
                        <p className="text-slate-500">
                          Imported {job.importedRows} • Failed {job.failedRows}
                        </p>
                        <div className="mt-1 flex gap-2">
                          {job.status === "Running" || job.status === "Queued" ? (
                            <button
                              type="button"
                              onClick={() => {
                                void updateImportJob(job.id, "cancel");
                              }}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 font-black text-rose-700"
                            >
                              Cancel
                            </button>
                          ) : null}
                          {job.status === "Failed" || job.status === "Cancelled" ? (
                            <button
                              type="button"
                              onClick={() => {
                                void updateImportJob(job.id, "retry");
                              }}
                              className="rounded-md border border-lime-200 bg-lime-50 px-2 py-1 font-black text-lime-700"
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>
          </div>

          <div className="order-2 mt-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-lime-300 text-slate-950"><Radar className="size-5" /></div>
              <div>
                <h2 className="font-black">New lead audit</h2>
                <p className="text-sm text-slate-500">Create a single lead and generate an audit.</p>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitCreateLead(event.currentTarget);
              }}
              className="grid gap-4"
            >
              <div className="sticky top-2 z-10 -mx-1 rounded-2xl bg-white/90 p-1 backdrop-blur">
                <button disabled={isCreatingLead} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-5 text-sm font-black text-slate-950 shadow-lg shadow-lime-950/10 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60">
                  {isCreatingLead ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {isCreatingLead ? "Generating..." : "Generate audit"}
                </button>
              </div>
              <Field label="Business name" name="businessName" placeholder="e.g. Bay Area Mobile Detail" />
              <Field label="Owner name" name="ownerName" placeholder="e.g. Sam" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field label="Category" name="category" placeholder="detailer, barber..." />
                <Field label="Location" name="location" placeholder="San Jose, CA" />
              </div>
              <Field label="Website URL" name="websiteUrl" placeholder="https://example.com" />
              <Field label="Google Business Profile" name="googleProfileUrl" placeholder="Google Maps / GBP link" />
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Notes / observations
                <textarea name="notes" placeholder="No booking link, old photos, good reviews, hard to find phone number..." rows={6} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-950 outline-none ring-lime-300/40 transition placeholder:text-slate-400 focus:border-lime-400 focus:ring-4" />
              </label>
              {createLeadState && !createLeadState.ok && createLeadState.error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{createLeadState.error}</p> : null}
              {createLeadState && createLeadState.ok ? <p className="rounded-2xl bg-lime-50 p-3 text-sm font-bold text-lime-800">Lead audit created successfully.</p> : null}
            </form>
          </div>

          <form action={caseStudyFormAction} className="order-3 mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black">Success Stories</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Add proof points for proposals and audits. {caseStudies.length} saved.</p>
            <div className="mt-4 grid gap-3">
              <input name="title" placeholder="Bay Area Detailer" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" />
              <input name="result" placeholder="+40% booking clicks in 30 days" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" />
              <input name="category" placeholder="detailer, contractor..." className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" />
              <textarea name="description" rows={4} placeholder="Short proof paragraph Hamid can show prospects..." className="rounded-xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-lime-400" />
              <button className="h-10 rounded-xl bg-slate-950 px-3 text-xs font-black text-white">Add success story</button>
              {caseStudyState.ok ? <p className="rounded-xl bg-lime-50 p-3 text-xs font-black text-lime-800">Success story saved.</p> : null}
              {!caseStudyState.ok && caseStudyState.error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-black text-rose-700">{caseStudyState.error}</p> : null}
            </div>
          </form>
        </section>

        <section className="min-w-0 w-full grid gap-6">

          <div className="grid gap-5">
            <div>
              <h2 className="text-lg font-black text-slate-900">Revenue Overview</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Total Pipeline</p><p className="mt-2 text-4xl font-black">{formatMoney(moneyStats.totalPipeline)}</p><p className="mt-1 text-xs font-bold text-slate-500">New + Contacted + Follow-up</p></div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Weighted Pipeline</p><p className="mt-2 text-4xl font-black text-lime-700">{formatMoney(moneyStats.weightedPipeline)}</p><p className="mt-1 text-xs font-bold text-slate-500">20/40/70% stage weighting</p></div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Won Revenue</p><p className="mt-2 text-4xl font-black">{formatMoney(moneyStats.wonRevenue)}</p><p className="mt-1 text-xs font-bold text-slate-500">Closed won work</p></div>
              </div>
            </div>
            <MonthlyGoalCard wonRevenue={moneyStats.wonRevenue} />
            <div>
              <h2 className="text-lg font-black text-slate-900">System Health</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Import Queue</p><p className="mt-2 text-xl font-black">{opsMetrics.queueDepth}</p><p className="mt-1 text-xs font-bold text-slate-500">Queued/Running imports</p></div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Failed Jobs</p><p className="mt-2 text-xl font-black">{opsMetrics.failedJobsCount}</p><p className="mt-1 text-xs font-bold text-slate-500">Import jobs needing retry</p></div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Events (24h)</p><p className="mt-2 text-xl font-black">{opsMetrics.eventsLast24h}</p><p className="mt-1 text-xs font-bold text-slate-500">Tracked lead/payment events</p></div>
              </div>
            </div>
          </div>

          {/* ⚡ Strike Window — 2-hour golden closing window */}
          {strikeLeads.length > 0 && (
            <div className="rounded-[2rem] border-2 border-amber-400 bg-amber-50 p-5 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse text-xl">⚡</span>
                    <h2 className="font-black text-amber-900">Strike Window — {strikeLeads.length} audit{strikeLeads.length > 1 ? "s" : ""} just viewed</h2>
                  </div>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Call or text NOW — 2-hour conversion window is open</p>
                </div>
                <span className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950">🔥 ACT NOW</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {strikeLeads.map((lead) => {
                  const viewedMinAgo = Math.floor((nowMs - new Date(lead.lastViewedAt ?? 0).getTime()) / 60000);
                  const strikeCallScript = `Hey, this is Hamid from ${senderCompanyName}. I saw someone just reviewed the online presence audit I put together for ${lead.businessName}. I wanted to make sure you got it — did you have a chance to look it over? I found ${lead.score >= 70 ? "several" : "a few"} conversion gaps that are costing you calls. Happy to walk you through the findings in 5 minutes.`;
                  const strikeSmsBody = `Hey! This is Hamid with ${senderCompanyName} — just noticed someone reviewed the audit I put together for ${lead.businessName}. Did you get a chance to see it? Happy to answer any questions or jump on a quick call. Here's the audit link: ${auditUrl(lead)}`;
                  const strikeSmsUrl = lead.phone ? buildSmsHref(lead.phone, strikeSmsBody) : "";
                  return (
                    <div key={lead.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{lead.businessName}</p>
                          <p className="text-xs font-bold text-amber-700">Viewed {viewedMinAgo < 1 ? "< 1 min" : `${viewedMinAgo} min`} ago · Score {lead.score}</p>
                        </div>
                        <button onClick={() => setSelectedId(lead.id)} className="shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-xs font-black text-white transition hover:bg-slate-700">Details</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={() => { void logOutreachAction(lead.id, "Call", `Strike window call — viewed audit ${viewedMinAgo} min ago`, (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); })()); }} className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-lime-400 px-3 text-xs font-black text-slate-950 transition hover:bg-lime-300">
                            <Phone className="size-3.5" /> Call Now
                          </a>
                        )}
                        {strikeSmsUrl && (
                          <a href={strikeSmsUrl} onClick={() => { void logOutreachAction(lead.id, "SMS", `Strike window SMS — viewed audit ${viewedMinAgo} min ago`, (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); })()); }} className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-sky-500 px-3 text-xs font-black text-white transition hover:bg-sky-400">
                            <Mail className="size-3.5" /> Strike SMS
                          </a>
                        )}
                        <button
                          onClick={async () => { await navigator.clipboard.writeText(strikeCallScript); setCopiedLeadId(`strike-${lead.id}`); setTimeout(() => setCopiedLeadId(""), 2000); }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 transition hover:bg-amber-100"
                        >
                          <Copy className="size-3.5" /> {copiedLeadId === `strike-${lead.id}` ? "Copied!" : "Copy call script"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Closes This Week */}
          <div className="rounded-[2rem] border border-lime-300 bg-lime-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">🎯 Top Closes This Week</h2>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">Ranked by close likelihood</p>
              </div>
              <span className="rounded-full bg-lime-300 px-2.5 py-1 text-xs font-black text-slate-950">{topCloseLeads.length} leads</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {topCloseLeads.length === 0
                ? <p className="col-span-3 rounded-2xl bg-white p-3 text-sm text-slate-500">No active leads in pipeline yet.</p>
                : topCloseLeads.map((lead, i) => (
                  <button key={lead.id} onClick={() => setSelectedId(lead.id)}
                    className="flex items-start gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition hover:shadow-md hover:scale-[1.01]">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-950">{lead.businessName}</span>
                      <span className="block text-xs text-slate-500">
                        Score {lead.score}
                        {lead.lastViewedAt && nowMs - new Date(lead.lastViewedAt).getTime() < 24 * 60 * 60 * 1000 ? " · 👁️ viewed" : ""}
                        {lead.paymentClickCount > 0 ? " · 💳 clicked" : ""}
                        {lead.phone ? " · 📞" : ""}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-lime-700">{formatMoney(estimatedDealValue(lead.packageName, lead.customPrice))}</span>
                    </span>
                  </button>
                ))}
            </div>
            {topCloseLeads.length > 0 && (
              <Link href="/call-today" className="mt-4 inline-flex h-9 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800">
                Start calling →
              </Link>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-black">Warm leads</h2><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Viewed audit in last 24h</p></div>{warmLeads.length ? <button onClick={() => setHotOnly(true)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">Filter hot</button> : null}</div>
              <div className="mt-4 grid gap-2">
                {warmLeads.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">No warm audit views in the last 24 hours.</p> : null}
                {warmLeads.map((lead) => {
                  const viewedAgoMs = nowMs - new Date(lead.lastViewedAt ?? 0).getTime();
                  return <button key={lead.id} onClick={() => setSelectedId(lead.id)} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-lime-50"><span><span className="font-black">{lead.businessName}</span><span className="block text-xs font-bold text-slate-500">Viewed {formatRelativeTime(lead.lastViewedAt ?? lead.updatedAt)} • {formatMoney(estimatedDealValue(lead.packageName, lead.customPrice))}</span></span>{viewedAgoMs <= 60 * 60 * 1000 ? <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-black text-white">HOT</span> : null}</button>;
                })}
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">👻 Ghost Hunter</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">No contact in 3+ days</p>
                </div>
                {ghostLeads.length > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">{ghostLeads.length} stale</span>}
              </div>
              <div className="mt-4 grid gap-2">
                {ghostLeads.length === 0
                  ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">No stale leads — pipeline is fresh! 🎉</p>
                  : ghostLeads.map((lead) => {
                    const daysSince = Math.floor((nowMs - (lead.lastContactedAt ? new Date(lead.lastContactedAt).getTime() : new Date(lead.createdAt).getTime())) / (24 * 60 * 60 * 1000));
                    return (
                      <button key={lead.id} onClick={() => setSelectedId(lead.id)}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50 p-3 text-left transition hover:bg-orange-100">
                        <span>
                          <span className="font-black text-slate-950">{lead.businessName}</span>
                          <span className="block text-xs font-bold text-slate-500">{daysSince}d silent · Score {lead.score} · {formatMoney(estimatedDealValue(lead.packageName, lead.customPrice))}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-orange-200 px-2 py-1 text-xs font-black text-orange-800">{daysSince}d</span>
                      </button>
                    );
                  })}
              </div>
              {ghostLeads.length > 0 && (
                <Link href="/call-today" className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-2xl bg-orange-500 text-xs font-black text-white transition hover:bg-orange-400">
                  Revive these leads →
                </Link>
              )}
            </div>

            {/* Awaiting Response */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">⏳ Awaiting Response</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Audit shared, not converted</p>
                </div>
                {awaitingLeads.length > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">{awaitingLeads.length}</span>}
              </div>
              <div className="mt-4 grid gap-2">
                {awaitingLeads.length === 0
                  ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">No shared audits pending yet.</p>
                  : awaitingLeads.map((lead) => (
                    <button key={lead.id} onClick={() => setSelectedId(lead.id)}
                      className={`flex items-center justify-between gap-3 rounded-2xl p-3 text-left transition ${
                        lead.viewedRecently ? "bg-sky-50 hover:bg-sky-100" : lead.viewed ? "bg-slate-50 hover:bg-lime-50" : "bg-slate-50 hover:bg-slate-100"
                      }`}>
                      <span>
                        <span className="font-black text-slate-950">{lead.businessName}</span>
                        <span className="block text-xs font-bold text-slate-500">
                          {lead.viewedRecently ? "👁️ Viewed recently — call now!" : lead.viewed ? "✓ Viewed" : "⏳ Not opened yet"}
                          {lead.lastSharedAt ? ` · sent ${formatRelativeTime(lead.lastSharedAt)}` : ""}
                        </span>
                      </span>
                      {lead.viewedRecently && <span className="shrink-0 rounded-full bg-sky-500 px-2 py-1 text-xs font-black text-white">CALL</span>}
                    </button>
                  ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Daily Activity</h2><p className="mt-2 text-sm text-slate-500">Outreach logged today.</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black">{todayActivity.calls}</p><p className="text-xs font-bold text-slate-500">Calls</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black">{todayActivity.sms}</p><p className="text-xs font-bold text-slate-500">SMS</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black">{todayActivity.emails}</p><p className="text-xs font-bold text-slate-500">Emails</p></div></div></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {statuses.map((status) => (
              <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "All" : status)} className={`rounded-2xl border p-4 text-left transition ${statusFilter === status ? "border-lime-400 bg-lime-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{status}</p>
                <p className="mt-2 text-3xl font-black">{statusCounts[status]}</p>
              </button>
            ))}
          </div>

          <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-black">Lead queue</h2>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Showing {filteredLeads.length} of {parsedLeads.length} leads</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px] lg:w-full">
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, city, website, notes, audit..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none focus:border-lime-400" />
                </label>
                <label className="relative">
                  <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "All")} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-black outline-none focus:border-lime-400">
                    <option value="All">All statuses</option>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Min score {minimumScore}
                  <input type="range" min="0" max="100" step="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} className="accent-lime-500" />
                </label>
                <button type="button" onClick={() => setDailyOnly((value) => !value)} className={`h-11 rounded-2xl border px-4 text-xs font-black transition ${dailyOnly ? "border-lime-400 bg-lime-50 text-lime-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Daily Outreach</button>
                <button type="button" onClick={() => setHotOnly((value) => !value)} className={`h-11 rounded-2xl border px-4 text-xs font-black transition ${hotOnly ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Hot Leads</button>
              </div>
            </div>
            <div className="w-full max-w-full overflow-x-auto">
              <div className="grid min-w-0 gap-3">
              {actionError ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{actionError}</p> : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Add lead to sequence</p>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <select value={enrollLeadId} onChange={(event) => setEnrollLeadId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
                    <option value="">Select lead...</option>
                    {parsedLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.businessName}</option>)}
                  </select>
                  <select value={enrollSequenceId} onChange={(event) => setEnrollSequenceId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
                    <option value="">Select active sequence...</option>
                    {activeSequences.map((sequence) => <option key={sequence.id} value={sequence.id}>{sequence.name}</option>)}
                  </select>
                  <input type="datetime-local" value={enrollSchedule} onChange={(event) => setEnrollSchedule(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" />
                  <button disabled={isEnrolling} onClick={enrollLeadInSequence} className="h-10 rounded-xl bg-lime-300 px-4 text-xs font-black text-slate-950 hover:bg-lime-200 disabled:opacity-60">
                    {isEnrolling ? "Enrolling..." : "Enroll"}
                  </button>
                </div>
              </div>
              {filteredLeads.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No leads match the current filters.</p> : null}
              {filteredLeads.map((lead) => (
                <div key={lead.id} onClick={() => setSelectedId(lead.id)} className={`grid min-w-0 cursor-pointer gap-3 rounded-2xl border p-4 text-left transition lg:grid-cols-[82px_minmax(0,1fr)] lg:items-start ${selected?.id === lead.id ? "border-lime-400 bg-lime-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <span className={`inline-flex size-16 items-center justify-center rounded-2xl text-xl font-black ${scoreTone(lead.score)}`}>{lead.score}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 min-w-0">
                        <h3 className="break-words text-xl font-bold">{lead.businessName}</h3>
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(lead.status)}`}>{lead.status}</span>
                      {(lead.stripePaymentUrl || lead.attachedCaseStudyId || lead.paymentClickCount > 0) ? <span className="rounded-full bg-lime-300 px-2.5 py-1 text-xs font-black text-slate-950">HIGH INTENT</span> : null}
                      {lead.paymentStatus === "paid" ? <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-black text-white">PAID</span> : null}
                      {lead.paymentStatus === "checkout_started" ? <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900">CHECKOUT STARTED</span> : null}
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Updated {formatRelativeTime(lead.updatedAt)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">{lead.category || "Local business"} • {lead.location || "Bay Area"} • Est. {formatMoney(estimatedDealValue(lead.packageName || lead.assets.recommendedPackage, lead.customPrice))}</span>
                    <span className="mt-2 block text-sm font-semibold text-slate-700">{lead.websiteUrl || lead.googleProfileUrl || "Manual lead"}</span>
                    <span className="mt-1 block text-xs font-bold text-slate-400">Created {new Date(lead.createdAt).toISOString().slice(0, 10)} • Views {lead.viewCount}{lead.lastViewedAt ? ` • Last viewed ${formatRelativeTime(lead.lastViewedAt)}` : ""}{lead.paymentClickCount ? ` • Payment clicks ${lead.paymentClickCount}` : ""}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 max-w-full lg:col-span-2">
                    {/* 1 — Status */}
                    <select value={lead.status} disabled={isUpdatingStatus} onClick={(event) => event.stopPropagation()} onChange={(event) => updateStatus(lead.id, event.target.value as LeadStatus)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 outline-none focus:border-lime-400">
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    {/* 2 — Internal prep (distinct intent: private call-prep page, not the public audit) */}
                    <Link href={buildPrepPath({ id: lead.id, shortSlug: lead.shortSlug })} target="_blank" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-lime-200">
                      📋 Internal prep
                    </Link>
                    {/* 3 — Open Audit / Generate Audit ✨ (smart primary button) */}
                    {(() => {
                      const isThisRowPending = lead.audit.pending === true || regeneratingLeadId === lead.id;
                      if (isThisRowPending) {
                        return (
                          <button type="button" disabled className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white opacity-60" aria-label={`Generating audit for ${lead.businessName}`}>
                            <Loader2 className="size-4 animate-spin" /> Generating…
                          </button>
                        );
                      }
                      if (lead.audit.aiGenerated) {
                        return (
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); window.open(auditUrl(lead), "_blank"); }}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                            aria-label={`Open public audit for ${lead.businessName}`}
                          >
                            Open Audit
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={isRegenerating || regeneratingLeadId !== null || lead.audit.pending === true}
                          onClick={(event) => { event.stopPropagation(); regenerateLead(lead.id); }}
                          className="inline-flex items-center gap-1 rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-50"
                          aria-label={`Generate Audit for ${lead.businessName}`}
                        >
                          <Sparkles className="size-4" /> Generate Audit ✨
                        </button>
                      );
                    })()}
                    {/* 4 — ↻ Regenerate icon — only when an AI audit already exists.
                     *   Single-in-flight policy: disabled whenever any regen is running
                     *   so a double-click can't burn two LLM credits in parallel. */}
                    {lead.audit.aiGenerated ? (
                      <button
                        type="button"
                        disabled={isRegenerating || regeneratingLeadId !== null || lead.audit.pending === true}
                        onClick={(event) => { event.stopPropagation(); regenerateLead(lead.id); }}
                        className="inline-flex items-center justify-center rounded-xl border border-lime-300 bg-lime-50 p-2 transition hover:bg-lime-100 disabled:opacity-50"
                        title="Regenerate audit with fresh Claude analysis"
                        aria-label={`Regenerate audit for ${lead.businessName}`}
                        data-testid="row-regenerate-icon"
                      >
                        <RefreshCw className="size-4 text-lime-800" />
                      </button>
                    ) : null}
                    {/* 5 — Add to Sequence */}
                    {activeSequences.length ? (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setEnrollLeadId(lead.id); }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Add to Sequence
                      </button>
                    ) : null}
                    {/* 6 — Outreach dropdown: Email / SMS / WhatsApp consolidated */}
                    <div
                      className="relative"
                      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) window.setTimeout(() => setOpenOutreachLeadId(""), 100); }}
                    >
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setOpenOutreachLeadId(openOutreachLeadId === lead.id ? "" : lead.id); }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                        aria-label={`Outreach options for ${lead.businessName}`}
                        data-testid="row-outreach-btn"
                      >
                        Outreach <ChevronDown className="size-3" />
                      </button>
                      {openOutreachLeadId === lead.id ? (
                        <div
                          className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg"
                          onClick={(event) => { event.stopPropagation(); setOpenOutreachLeadId(""); }}
                          data-testid="row-outreach-menu"
                        >
                          <a href={emailDraftUrl(lead)} target="_blank" onClick={() => markEmailDrafted(lead.id)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                            <Mail className="size-3.5" /> Email
                          </a>
                          {lead.phone ? (
                            <a href={smsDraftUrl(lead)} onClick={() => { void logOutreachAction(lead.id, "SMS", "Opened SMS draft"); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                              SMS
                            </a>
                          ) : null}
                          {lead.phone ? (
                            <a href={whatsappDraftUrl(lead)} target="_blank" onClick={() => { void logOutreachAction(lead.id, "SMS", "Opened WhatsApp draft"); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-green-700 hover:bg-slate-50">
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {/* 7 — Website */}
                    {lead.websiteUrl ? <a href={lead.websiteUrl} target="_blank" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-lime-700 transition hover:bg-slate-50">Website <ExternalLink className="size-4" /></a> : null}
                    {/* 8 — Delete */}
                    <button type="button" disabled={isDeleting} onClick={(event) => { event.stopPropagation(); deleteLead(lead.id, lead.businessName); }} className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                      {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
                    </button>
                  </span>
                </div>
              ))}
              </div>
            </div>
          </div>

          {selected ? (
            <div className="grid gap-6">
              {selected.audit.aiGenerated ? (
                <div className="flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-black tracking-[0.04em] text-lime-700">
                  <Sparkles className="size-4" />
                  AI-generated
                  {selected.audit.verticalDisplayName ? (
                    <span className="font-bold text-lime-800">· {selected.audit.verticalDisplayName} vertical</span>
                  ) : null}
                </div>
              ) : null}
              <form key={`offer-${selected.id}`} action={offerFormAction} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <input type="hidden" name="id" value={selected.id} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black">Offer & Pricing</h3>
                    <p className="text-sm text-slate-500">Lock the package and price before sending the audit link.</p>
                  </div>
                  <div className="text-right"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Current value</p><p className="text-2xl font-black text-lime-700">{formatMoney(estimatedDealValue(selected.packageName, selected.customPrice))}</p></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                  <select name="packageName" defaultValue={selected.packageName || selected.assets.recommendedPackage} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                    {standardPackages.map((packageName) => <option key={packageName} value={packageName}>{packageName}</option>)}
                  </select>
                  <input name="customPrice" type="number" min="0" step="50" defaultValue={selected.customPrice ?? estimatedDealValue(selected.packageName || selected.assets.recommendedPackage)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-lime-400" />
                  <OfferSaveButton />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <select name="attachedCaseStudyId" defaultValue={selected.attachedCaseStudyId ?? ""} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                    <option value="">No attached success story</option>
                    {caseStudies.map((caseStudy) => <option key={caseStudy.id} value={caseStudy.id}>{caseStudy.title} — {caseStudy.result}</option>)}
                  </select>
                  <input name="stripePaymentUrl" type="url" defaultValue={selected.stripePaymentUrl ?? ""} placeholder="Stripe payment link / deposit URL" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-lime-400" />
                </div>
                <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Link controls</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-700">Public audit link</p>
                      <p className="truncate text-xs text-slate-500">{auditUrl(selected)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void copyAuditUrl(selected);
                      }}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      {copiedLeadId === selected.id ? "Copied public link" : "Copy public audit link"}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-700">Internal prep link</p>
                      <p className="truncate text-xs text-slate-500">{prepUrl(selected)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void copyPrepUrl(selected);
                      }}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      {copiedPrepLeadId === selected.id ? "Copied prep link" : "Copy internal prep link"}
                    </button>
                  </div>
                </div>
                {offerState && !offerState.ok && offerState.error ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{offerState.error}</p> : null}
                {offerState && offerState.ok && offerState.leadId === selected.id ? <p className="mt-3 rounded-2xl bg-lime-50 p-3 text-sm font-bold text-lime-800">Offer saved.</p> : null}
              </form>

              <form key={`short-slug-${selected.id}`} action={shortSlugFormAction} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <input type="hidden" name="id" value={selected.id} />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Short public audit link
                    <input
                      name="shortSlug"
                      defaultValue={selected.shortSlug || ""}
                      placeholder="nebula-smoke-shop"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold lowercase outline-none focus:border-lime-400"
                    />
                    <span className="text-[11px] normal-case tracking-normal text-slate-500">
                      Used for printable/client-facing audit URLs like <span className="font-bold">/a/nebula-smoke-shop</span>.
                    </span>
                  </label>
                  <button className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800">Save public slug</button>
                </div>
                {shortSlugState.ok && shortSlugState.leadId === selected.id ? <p className="mt-3 rounded-xl bg-lime-50 p-2 text-xs font-black text-lime-800">Public audit slug saved.</p> : null}
                {!shortSlugState.ok && shortSlugState.error && shortSlugState.leadId === selected.id ? <p className="mt-3 rounded-xl bg-rose-50 p-2 text-xs font-black text-rose-700">{shortSlugState.error}</p> : null}
              </form>

              <form key={selected.id} onSubmit={(event) => { event.preventDefault(); saveNotes(new FormData(event.currentTarget), selected.id); }} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <input type="hidden" name="id" value={selected.id} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black">Lead notes</h3>
                    <p className="text-sm text-slate-500">Keep call context, objections, next steps, and research notes here.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <NotesSaveButton saved={notesSavedLeadId === selected.id} saving={isSavingNotes} />
                    <button type="button" disabled={isRegenerating} onClick={(event) => regenerateLead(selected.id, event.currentTarget.closest("form"))} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                      {isRegenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {isRegenerating
                        ? "Generating..."
                        : selected.audit.aiGenerated
                          ? "Regenerate (Claude-powered)"
                          : "Generate audit (Claude-powered)"}
                    </button>
                  </div>
                </div>
                <textarea name="notes" defaultValue={selected.notes ?? ""} rows={5} placeholder="Add notes from calls, texts, website observations, owner names, pricing objections..." className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-950 outline-none ring-lime-300/40 transition placeholder:text-slate-400 focus:border-lime-400 focus:ring-4" />
                {notesError ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{notesError}</p> : null}
              </form>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-black">Active Sequences</h3>
                <div className="mt-3 grid gap-2">
                  {!selected.sequenceStates.length ? (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Lead is not enrolled in any active sequence.</p>
                  ) : null}
                  {selected.sequenceStates.map((state) => (
                    <div key={state.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-slate-900">{state.sequenceName}</p>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          {state.status} · step {state.currentStep + 1}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Next action: {state.nextRunAt ? new Date(state.nextRunAt).toLocaleString() : "none"} · Last action: {state.lastMessageStatus || "n/a"} · Retries: {state.lastMessageRetryCount}
                      </p>
                      {state.lastError ? <p className="mt-1 text-xs font-bold text-rose-700">Failure: {state.lastError}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <CheckItem label="Has website" value={selected.audit.checks.hasWebsite} />
                <CheckItem label="Mobile friendly" value={selected.audit.checks.mobileFriendly} />
                <CheckItem label="Clear CTA" value={selected.audit.checks.clearCta} />
                <CheckItem label="Phone easy to find" value={selected.audit.checks.phoneEasyToFind} />
                <CheckItem label="Reviews visible" value={selected.audit.checks.reviewsVisible} />
                <CheckItem label="Online booking" value={selected.audit.checks.onlineBooking} />
                <CheckItem label="Trust section" value={selected.audit.checks.trustSection} />
                <CheckItem label="Gallery" value={selected.audit.checks.gallery} />
                <CheckItem label="Service list" value={selected.audit.checks.serviceList} />
                <CheckItem label="Pricing" value={selected.audit.checks.pricing} />
                <CheckItem label="FAQ" value={selected.audit.checks.faq} />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <ScriptBox title="Likely money lost" value={selected.assets.likelyMoneyLost} />
                <ScriptBox title="Agency offer" value={selected.assets.presenceLabsOffer} />
                <ScriptBox title="Cold call" value={selected.assets.coldCallScript} />
                <ScriptBox title="Text message" value={selected.assets.textMessageScript} />
                <ScriptBox title="Email" value={selected.assets.emailScript} copyLabel="Copy Email Body" />
                <ScriptBox title="30-second pitch" value={selected.assets.thirtySecondPitch} />
                <ScriptBox title="Follow-up" value={selected.assets.followUpMessage} />
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Proposal outline</h3>
                  <ol className="mt-4 grid gap-3 text-sm text-slate-700">
                    {selected.assets.proposalOutline.map((item, index) => <li key={item} className="flex gap-3"><span className="font-black text-lime-700">{index + 1}.</span>{item}</li>)}
                  </ol>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-black">Outreach history</h3>
                <form action={async (formData) => { await logOutreachAction(selected.id, String(formData.get("type")) as "Email" | "Call" | "SMS" | "Share" | "Note", String(formData.get("notes") ?? ""), String(formData.get("nextFollowUpAt") ?? "")); }} className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_180px_auto]">
                  <select name="type" className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold">
                    <option>Email</option><option>Call</option><option>SMS</option><option>Note</option>
                  </select>
                  <input name="notes" placeholder="Call notes / objection / next step" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-lime-400" />
                  <input name="nextFollowUpAt" type="date" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-lime-400" />
                  <button className="h-11 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white">Log</button>
                </form>
                <div className="mt-4 grid gap-2">
                  {selected.outreachLogs.length === 0 ? <p className="text-sm text-slate-500">No outreach logged yet.</p> : null}
                  {selected.outreachLogs.map((log) => {
                    const isWon = log.notes?.startsWith("🎉 WON:");
                    const isLost = log.notes?.startsWith("❌ LOST:");
                    return (
                      <div key={log.id} className={`rounded-2xl p-3 text-sm ${
                        isWon ? "bg-lime-50 border border-lime-200" : isLost ? "bg-rose-50 border border-rose-200" : "bg-slate-50"
                      }`}>
                        <span className="font-black">{log.type}</span>{" "}
                        <span className="text-slate-400">{formatRelativeTime(log.createdAt)}</span>
                        {log.notes ? <p className={`mt-1 ${isWon ? "font-bold text-lime-800" : isLost ? "font-bold text-rose-700" : "text-slate-600"}`}>{log.notes}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-black">Website signals</h3>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600">
                    {selected.audit.websiteSignals.map((signal) => <li key={signal} className="flex gap-2"><ArrowUpRight className="mt-0.5 size-4 text-lime-700" />{signal}</li>)}
                  </ul>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-black">Warnings / context</h3>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600">
                    {(selected.audit.warnings.length ? selected.audit.warnings : [`Generated with ${selected.audit.source}.`]).map((warning) => <li key={warning} className="flex gap-2"><Phone className="mt-0.5 size-4 text-amber-600" />{warning}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
