"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ExternalLink, Loader2, Plus, Radar, Search, Sparkles } from "lucide-react";
import { addResearchQueueItemsAction, convertQueueItemToLeadAction, updateResearchQueueStatusAction } from "@/app/actions/research-queue";
import { BRAND } from "@/lib/brand";
import { formatRelativeTime } from "@/lib/utils";
import { RESEARCH_PAGE_INTRO, ResearchEmptyState } from "@/app/research/research-empty-state";

type QueueStatus = "Queued" | "Researching" | "Audited" | "Converted" | "Skipped";

type QueueItem = {
  id: string;
  businessName: string;
  websiteUrl: string | null;
  location: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: string | null;
  priority: number;
  status: string;
  convertedLeadId: string | null;
  createdAt: string;
  updatedAt: string;
};

const initialState = { ok: false as const, added: 0, skipped: 0, error: "" };
const statuses: QueueStatus[] = ["Queued", "Researching", "Audited", "Converted", "Skipped"];

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-60">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      {pending ? "Adding..." : "Add to queue"}
    </button>
  );
}

function statusTone(status: QueueStatus) {
  const tones: Record<QueueStatus, string> = {
    Queued: "bg-slate-100 text-slate-700 border-slate-200",
    Researching: "bg-sky-50 text-sky-700 border-sky-100",
    Audited: "bg-amber-50 text-amber-800 border-amber-100",
    Converted: "bg-lime-50 text-lime-800 border-lime-100",
    Skipped: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return tones[status];
}

export function ResearchQueueDashboard({ items }: { items: QueueItem[] }) {
  const [state, formAction] = useActionState(addResearchQueueItemsAction, initialState);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "All">("All");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<QueueStatus>("Researching");
  const [bulkProgress, setBulkProgress] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(
    () => items.map((item) => ({ ...item, status: statuses.includes(item.status as QueueStatus) ? (item.status as QueueStatus) : "Queued" })),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parsed.filter((item) => {
      const searchable = [item.businessName, item.websiteUrl, item.location, item.category, item.phone, item.email, item.notes, item.source].filter(Boolean).join(" ").toLowerCase();
      return (statusFilter === "All" || item.status === statusFilter) && (!q || searchable.includes(q));
    });
  }, [parsed, query, statusFilter]);

  const counts = useMemo(() => Object.fromEntries(statuses.map((status) => [status, parsed.filter((item) => item.status === status).length])) as Record<QueueStatus, number>, [parsed]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectableIds = filtered.filter((item) => item.status !== "Converted").map((item) => item.id);
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !selectableIds.includes(id)) : Array.from(new Set([...current, ...selectableIds])));
  const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const updateStatus = (id: string, status: QueueStatus) => {
    setActionError("");
    setBusyId(id);
    startTransition(async () => {
      const result = await updateResearchQueueStatusAction(id, status);
      if (!result.ok) setActionError(result.error ?? "Status update failed.");
      setBusyId("");
    });
  };

  const convertToLead = (id: string) => {
    setActionError("");
    setBusyId(id);
    startTransition(async () => {
      const result = await convertQueueItemToLeadAction(id);
      if (!result.ok) setActionError(result.error ?? "Audit generation failed.");
      setBusyId("");
    });
  };

  const bulkGenerateAudits = async () => {
    const ids = selectedIds.filter((id) => parsed.find((item) => item.id === id && item.status !== "Converted"));
    if (!ids.length) return;
    setActionError("");
    setIsBulkRunning(true);
    try {
      for (const [index, id] of ids.entries()) {
        setBulkProgress(`Auditing ${index + 1}/${ids.length}...`);
        const result = await convertQueueItemToLeadAction(id);
        if (!result.ok) throw new Error(result.error ?? "Bulk audit failed.");
        if (index < ids.length - 1) await delay(750);
      }
      setBulkProgress(`Done: ${ids.length}/${ids.length} audited`);
      setSelectedIds([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk audit failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  const bulkUpdateStatus = async () => {
    if (!selectedIds.length) return;
    setActionError("");
    setIsBulkRunning(true);
    try {
      for (const [index, id] of selectedIds.entries()) {
        setBulkProgress(`Updating ${index + 1}/${selectedIds.length}...`);
        const result = await updateResearchQueueStatusAction(id, bulkStatus);
        if (!result.ok) throw new Error(result.error ?? "Bulk status update failed.");
      }
      setBulkProgress(`Updated ${selectedIds.length} queue items`);
      setSelectedIds([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk status update failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" /> Dashboard</Link>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.28em] text-lime-700">{BRAND.productName}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Lead Research Queue</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{RESEARCH_PAGE_INTRO}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <Radar className="size-5 text-lime-300" />
            <div><p className="text-xs text-white/50">Queued prospects</p><p className="font-black">{parsed.length}</p></div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[420px_1fr] lg:px-12">
        <form action={formAction} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <h2 className="font-black">Paste prospects</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">One business per line, pipe-separated rows, or CSV. Nothing gets contacted automatically.</p>
          <textarea name="items" rows={12} placeholder={"Business Name | website | city | category | phone | email | notes\nJoe's Auto Repair | joesauto.com | San Jose | auto repair"} className="mt-4 w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none focus:border-lime-400" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Source<input name="source" placeholder="Google Maps, Yelp, referral..." className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-lime-400" /></label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Priority<select name="priority" defaultValue="3" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-black normal-case tracking-normal outline-none focus:border-lime-400"><option value="1">1 Hot</option><option value="2">2 Strong</option><option value="3">3 Normal</option><option value="4">4 Later</option><option value="5">5 Low</option></select></label>
          </div>
          <div className="mt-4"><AddButton /></div>
          {state.ok ? <p className="mt-4 rounded-2xl bg-lime-50 p-3 text-sm font-bold text-lime-800">Added {state.added} • Skipped {state.skipped}</p> : null}
          {!state.ok && state.error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{state.error}</p> : null}
        </form>

        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-5">
            {statuses.map((status) => <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "All" : status)} className={`rounded-2xl border p-4 text-left transition ${statusFilter === status ? "border-lime-400 bg-lime-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{status}</p><p className="mt-2 text-3xl font-black">{counts[status]}</p></button>)}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-black">Research candidates</h2><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{filtered.length} shown • {parsed.length} total</p></div>
              <label className="relative lg:min-w-[360px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search queue..." className="h-11 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold outline-none focus:border-lime-400" /></label>
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-black text-slate-700"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 accent-lime-500" /> Select visible unconverted</label>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{selectedIds.length} selected {bulkProgress ? `• ${bulkProgress}` : ""}</p>
            </div>
            {selectedIds.length > 0 ? <div className="sticky top-3 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-lg">
              <span className="px-2 text-sm font-black">{selectedIds.length} selected</span>
              <button disabled={isBulkRunning} onClick={bulkGenerateAudits} className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime-300 px-3 text-xs font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-60">{isBulkRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Bulk Generate Audits</button>
              <select disabled={isBulkRunning} value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as QueueStatus)} className="h-10 rounded-xl border border-white/10 bg-white px-3 text-xs font-black text-slate-950"><option>Queued</option><option>Researching</option><option>Audited</option><option>Skipped</option></select>
              <button disabled={isBulkRunning} onClick={bulkUpdateStatus} className="h-10 rounded-xl border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-60">Bulk Status Update</button>
              <button disabled={isBulkRunning} onClick={() => setSelectedIds([])} className="h-10 rounded-xl px-3 text-xs font-black text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-60">Clear</button>
            </div> : null}
            {actionError ? <p className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{actionError}</p> : null}
            <div className="grid gap-3">
              {parsed.length === 0 ? <ResearchEmptyState /> : null}
              {parsed.length > 0 && filtered.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No queue items match this filter.</p> : null}
              {filtered.map((item) => (
                <div key={item.id} className={`rounded-2xl border bg-white p-4 ${selectedSet.has(item.id) ? "border-lime-400 ring-2 ring-lime-100" : "border-slate-200"}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <input type="checkbox" checked={selectedSet.has(item.id)} disabled={item.status === "Converted" || isBulkRunning} onChange={() => toggleSelected(item.id)} className="mt-1 size-4 accent-lime-500 disabled:opacity-30" />
                      <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{item.businessName}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(item.status)}`}>{item.status}</span><span className="text-xs font-black text-slate-400">P{item.priority}</span></div>
                      <p className="mt-1 text-sm text-slate-500">{item.category || "Local business"} • {item.location || "Unknown city"} • {item.source || "manual"}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">{item.websiteUrl || item.phone || item.email || "Needs research"}</p>
                      {item.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</p> : null}
                      <p className="mt-2 text-xs font-bold text-slate-400">Added {formatRelativeTime(item.createdAt)} • Updated {formatRelativeTime(item.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <select value={item.status} disabled={isPending && busyId === item.id} onChange={(event) => updateStatus(item.id, event.target.value as QueueStatus)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black outline-none focus:border-lime-400">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                      <button disabled={isPending && busyId === item.id} onClick={() => convertToLead(item.id)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60">{isPending && busyId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate audit</button>
                      {item.convertedLeadId ? <Link href={`/?lead=${item.convertedLeadId}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-lime-700 hover:bg-slate-50">Lead <ExternalLink className="size-4" /></Link> : null}
                      {item.websiteUrl ? <a href={item.websiteUrl} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Website <ExternalLink className="size-4" /></a> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
