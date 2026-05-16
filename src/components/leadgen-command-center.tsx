"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Filter, Link2, Lock, Search, Upload } from "lucide-react";
import { addSelectedLeadgenToAudgenAction } from "@/app/actions/leadgen";
import { parseCsv, pick } from "@/lib/csv";
import { toGoogleSheetsReadyCsv, toLeadGenCsv } from "@/lib/leadgen/export";
import { applyLeadOpportunityFilters } from "@/lib/leadgen/filters";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";
import { scoreLeadOpportunity } from "@/lib/leadgen/scoring";
import { getLeadSourceAdapters } from "@/lib/leadgen/sources";
import type { LeadOpportunity, LeadOpportunityFilters, OpportunityLevel } from "@/lib/leadgen/types";
import { deriveLeadgenUiState } from "@/lib/leadgen/ui-state";
import { formatMoney } from "@/lib/money";

const defaultFilters: Required<
  Pick<
    LeadOpportunityFilters,
    | "source"
    | "websiteStatus"
    | "googleProfileStatus"
    | "opportunityLevel"
    | "status"
  >
> &
  Pick<LeadOpportunityFilters, "textQuery" | "city" | "category" | "minNeedScore" | "minRating" | "maxRating" | "minReviewCount" | "maxReviewCount"> = {
  textQuery: "",
  city: "",
  category: "",
  source: "all",
  minNeedScore: 0,
  websiteStatus: "all",
  googleProfileStatus: "all",
  minReviewCount: null,
  maxReviewCount: null,
  minRating: null,
  maxRating: null,
  opportunityLevel: "all",
  status: "all",
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function asOpportunityLevelTone(level: OpportunityLevel) {
  if (level === "Critical") return "bg-rose-100 text-rose-800 border-rose-200";
  if (level === "High") return "bg-amber-100 text-amber-900 border-amber-200";
  if (level === "Medium") return "bg-sky-100 text-sky-800 border-sky-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function toImportedOpportunity(row: Record<string, string>, idx: number): LeadOpportunity {
  const businessName = pick(row, ["business name", "name", "company"]);
  const city = pick(row, ["city", "location"]);
  const state = pick(row, ["state"]) || "CA";
  const website = pick(row, ["website", "website url", "url"]) || null;
  const gbp = pick(row, ["google profile", "google profile url", "google business profile"]) || null;
  const ratingRaw = pick(row, ["rating"]);
  const reviewsRaw = pick(row, ["review count", "reviews"]);
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const reviewCount = reviewsRaw ? Number(reviewsRaw) : null;
  const now = new Date().toISOString();

  return scoreLeadOpportunity({
    id: `csv-${idx}-${businessName || "lead"}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    businessName: businessName || `Imported Lead ${idx + 1}`,
    category: pick(row, ["category", "industry", "industry/category"]) || "Local Services",
    city: city || "Unknown",
    state,
    phone: pick(row, ["phone", "phone number"]) || null,
    email: pick(row, ["email"]) || null,
    website,
    googleProfileUrl: gbp,
    address: pick(row, ["address"]) || null,
    rating: Number.isFinite(rating) ? rating : null,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : null,
    hasWebsite: Boolean(website),
    hasGoogleBusinessProfile: Boolean(gbp),
    hasBookingLink: false,
    hasContactForm: Boolean(website),
    hasSocialLinks: false,
    websiteQuality: website ? "weak" : "none",
    responseSpeedSignal: "unknown",
    source: "manual_csv",
    sourceUrl: null,
    status: "new",
    createdAt: now,
    updatedAt: now,
  });
}

export function LeadGenCommandCenter() {
  const [filters, setFilters] = useState(defaultFilters);
  const [leads, setLeads] = useState<LeadOpportunity[]>(() => getMockLeadOpportunities());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeLeadId, setActiveLeadId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("Google Places and Google Sheets are mocked and safely disabled in phase 1.");
  const [isAdding, startAddTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();

  const sourceAdapters = useMemo(() => getLeadSourceAdapters(), []);

  const filteredLeads = useMemo(() => applyLeadOpportunityFilters(leads, filters), [filters, leads]);
  const selectedLeads = useMemo(
    () => filteredLeads.filter((lead) => selectedIds.has(lead.id)),
    [filteredLeads, selectedIds],
  );
  const uiState = useMemo(
    () => deriveLeadgenUiState(filteredLeads, selectedIds),
    [filteredLeads, selectedIds],
  );
  const activeLead = filteredLeads.find((lead) => lead.id === activeLeadId) ?? filteredLeads[0] ?? null;

  const stats = useMemo(() => {
    const high = filteredLeads.filter((lead) => lead.opportunityLevel === "High" || lead.opportunityLevel === "Critical").length;
    const missingWebsite = filteredLeads.filter((lead) => !lead.hasWebsite).length;
    const missingGbp = filteredLeads.filter((lead) => !lead.hasGoogleBusinessProfile).length;
    const readyForAudit = filteredLeads.filter((lead) => lead.status === "new" || lead.status === "reviewed").length;
    const opportunity = filteredLeads.reduce((sum, lead) => sum + lead.estimatedRevenuePotential, 0);
    return { high, missingWebsite, missingGbp, readyForAudit, opportunity };
  }, [filteredLeads]);

  const allVisibleSelected =
    filteredLeads.length > 0 && filteredLeads.every((lead) => selectedIds.has(lead.id));

  const updateFilter = <K extends keyof typeof defaultFilters>(key: K, value: (typeof defaultFilters)[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredLeads.forEach((lead) => next.delete(lead.id));
      } else {
        filteredLeads.forEach((lead) => next.add(lead.id));
      }
      return next;
    });
  };

  const exportSelected = () => {
    const csv = toLeadGenCsv(selectedLeads);
    downloadCsv(`leadgen-selected-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setInfoMessage(`Exported ${selectedLeads.length} lead(s) as standard CSV.`);
  };

  const exportSheetsCsv = () => {
    const csv = toGoogleSheetsReadyCsv(selectedLeads);
    downloadCsv(`leadgen-sheets-ready-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setInfoMessage(`Exported ${selectedLeads.length} lead(s) as Google-Sheets-ready CSV.`);
  };

  const copySelectedCsv = async () => {
    const csv = toLeadGenCsv(selectedLeads);
    await navigator.clipboard.writeText(csv);
    setInfoMessage(`Copied ${selectedLeads.length} lead(s) as CSV to clipboard.`);
  };

  const addSelectedToAudgen = () => {
    startAddTransition(async () => {
      setErrorMessage("");
      const result = await addSelectedLeadgenToAudgenAction(
        selectedLeads.map((lead) => ({
          businessName: lead.businessName,
          category: lead.category,
          city: lead.city,
          state: lead.state,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          source: lead.source,
          presenceGaps: lead.presenceGaps,
        })),
      );
      setInfoMessage(
        `Added ${result.added} lead(s) to AudGen research queue. Skipped ${result.skipped} duplicate(s).`,
      );
    });
  };

  const importCsvFile = (file: File) => {
    startImportTransition(async () => {
      try {
        setErrorMessage("");
        const text = await file.text();
        const rows = parseCsv(text);
        const imported = rows.map(toImportedOpportunity);
        if (!imported.length) {
          setErrorMessage("No valid CSV rows were found.");
          return;
        }
        setLeads((current) => {
          const existing = new Set(current.map((lead) => lead.id));
          const nextImported = imported.filter((lead) => !existing.has(lead.id));
          return [...nextImported, ...current];
        });
        setInfoMessage(`Imported ${imported.length} lead(s) from CSV and scored locally.`);
      } catch {
        setErrorMessage("CSV import failed. Please check formatting and try again.");
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950"
          >
            ← Dashboard
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-700">Presence Labs</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">LeadGen Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Find high-fit local businesses, qualify their online presence gaps, and move the best opportunities into your AudGen sales engine.
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Find Leads → Qualify → Export → Add to AudGen → Generate Audit → Outreach → Revenue
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportSelected}
                disabled={uiState.exportDisabled}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="size-4" /> Export Selected
              </button>
              <button
                onClick={addSelectedToAudgen}
                disabled={uiState.exportDisabled || isAdding}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-lime-300 px-4 text-xs font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Add Selected to AudGen"}
              </button>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50">
                <Upload className="size-4" />
                {isImporting ? "Importing..." : "Import CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importCsvFile(file);
                  }}
                />
              </label>
              <button
                disabled
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-xs font-black text-slate-500"
              >
                <Lock className="size-4" /> Configure Sources (Future)
              </button>
            </div>
          </div>
          {infoMessage ? <p className="rounded-xl bg-sky-50 p-3 text-xs font-black text-sky-800">{infoMessage}</p> : null}
          {errorMessage ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-black text-rose-700">{errorMessage}</p> : null}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:px-12">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Leads discovered</p><p className="mt-2 text-3xl font-black">{filteredLeads.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">High-opportunity leads</p><p className="mt-2 text-3xl font-black">{stats.high}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Missing website</p><p className="mt-2 text-3xl font-black">{stats.missingWebsite}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Missing GBP signals</p><p className="mt-2 text-3xl font-black">{stats.missingGbp}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Ready for audit</p><p className="mt-2 text-3xl font-black">{stats.readyForAudit}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Estimated monthly opportunity</p><p className="mt-2 text-3xl font-black text-lime-700">{formatMoney(stats.opportunity)}</p></div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="grid gap-4 self-start rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6">
            <div>
              <h2 className="font-black">Search & Filters</h2>
              <p className="text-xs text-slate-500">Narrow by market, source, quality, and opportunity profile.</p>
            </div>
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.textQuery}
                onChange={(event) => updateFilter("textQuery", event.target.value)}
                placeholder="Search business, category, pitch..."
                className="h-11 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold outline-none focus:border-lime-400"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <input value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="City / location" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" />
              <input value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} placeholder="Business category" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <select value={filters.source} onChange={(event) => updateFilter("source", event.target.value as typeof defaultFilters.source)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-lime-400">
                <option value="all">All sources</option>
                <option value="manual_csv">Manual CSV upload</option>
                <option value="mock_local">Mock local</option>
                <option value="domain_list">Website/domain list</option>
                <option value="google_sheets">Google Sheets (future)</option>
                <option value="google_places">Google Places (future)</option>
                <option value="future_connector">Local category search (future)</option>
              </select>
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Min need score {filters.minNeedScore}
                <input type="range" min="0" max="100" step="5" value={filters.minNeedScore} onChange={(event) => updateFilter("minNeedScore", Number(event.target.value))} className="accent-lime-500" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <select value={filters.websiteStatus} onChange={(event) => updateFilter("websiteStatus", event.target.value as typeof defaultFilters.websiteStatus)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-lime-400">
                <option value="all">Website status (all)</option>
                <option value="missing">Missing website</option>
                <option value="present">Has website</option>
              </select>
              <select value={filters.googleProfileStatus} onChange={(event) => updateFilter("googleProfileStatus", event.target.value as typeof defaultFilters.googleProfileStatus)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-lime-400">
                <option value="all">Google profile (all)</option>
                <option value="missing">Missing GBP</option>
                <option value="present">Has GBP</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} placeholder="Min reviews" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" onChange={(event) => updateFilter("minReviewCount", event.target.value ? Number(event.target.value) : null)} />
              <input type="number" min={0} placeholder="Max reviews" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" onChange={(event) => updateFilter("maxReviewCount", event.target.value ? Number(event.target.value) : null)} />
              <input type="number" min={0} max={5} step={0.1} placeholder="Min rating" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" onChange={(event) => updateFilter("minRating", event.target.value ? Number(event.target.value) : null)} />
              <input type="number" min={0} max={5} step={0.1} placeholder="Max rating" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400" onChange={(event) => updateFilter("maxRating", event.target.value ? Number(event.target.value) : null)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <select value={filters.opportunityLevel} onChange={(event) => updateFilter("opportunityLevel", event.target.value as typeof defaultFilters.opportunityLevel)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-lime-400">
                <option value="all">Opportunity level (all)</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as typeof defaultFilters.status)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-lime-400">
                <option value="all">Status (all)</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="exported">Exported</option>
                <option value="queued">Queued</option>
              </select>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-600 hover:bg-slate-100"
              onClick={() => setFilters(defaultFilters)}
            >
              <Filter className="size-4" /> Reset filters
            </button>
          </aside>

          <section className="grid gap-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">Lead Sources</h2>
                  <p className="text-xs text-slate-500">Phase 1 is mock/local-first. Real connectors are disabled by design.</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                  Future connectors locked
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {sourceAdapters.map((adapter) => (
                  <div key={adapter.id} className={`rounded-2xl border p-3 ${adapter.enabled ? "border-lime-200 bg-lime-50" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black">{adapter.label}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${adapter.enabled ? "bg-lime-200 text-lime-800" : "bg-slate-200 text-slate-600"}`}>
                        {adapter.enabled ? "active" : "future"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{adapter.description}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">{adapter.safetyNotes}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">Discovered Leads</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {filteredLeads.length} shown • {uiState.selectedCount} selected
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="size-4 accent-lime-500" />
                  Select visible
                </label>
              </div>

              {uiState.isEmpty ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="font-black">No leads match your filters.</p>
                  <p className="mt-2 text-sm text-slate-500">Adjust filters or import a CSV to discover more opportunities.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.1em] text-slate-500">
                        <th className="p-2">Select</th>
                        <th className="p-2">Business</th>
                        <th className="p-2">Website / GBP</th>
                        <th className="p-2">Rating</th>
                        <th className="p-2">Need</th>
                        <th className="p-2">Revenue</th>
                        <th className="p-2">Presence gaps</th>
                        <th className="p-2">Offer</th>
                        <th className="p-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${activeLead?.id === lead.id ? "bg-lime-50" : ""}`}
                          onClick={() => setActiveLeadId(lead.id)}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead.id)}
                              onChange={() => toggleSelected(lead.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="size-4 accent-lime-500"
                            />
                          </td>
                          <td className="p-2">
                            <p className="font-black">{lead.businessName}</p>
                            <p className="text-xs text-slate-500">{lead.category} • {lead.city}</p>
                            <p className="text-xs text-slate-500">{lead.phone ?? "No phone"}</p>
                          </td>
                          <td className="p-2 text-xs">
                            <p>{lead.hasWebsite ? "Website found" : "No website"}</p>
                            <p>{lead.hasGoogleBusinessProfile ? "GBP found" : "No GBP"}</p>
                          </td>
                          <td className="p-2 text-xs">{lead.rating ?? "-"} / {lead.reviewCount ?? 0}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-black">{lead.estimatedNeedScore}</span>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${asOpportunityLevelTone(lead.opportunityLevel)}`}>
                                {lead.opportunityLevel}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 font-bold text-lime-700">{formatMoney(lead.estimatedRevenuePotential)}</td>
                          <td className="p-2 text-xs text-slate-600">{lead.presenceGaps.slice(0, 2).join(", ")}</td>
                          <td className="p-2 text-xs text-slate-600">{lead.recommendedOffer}</td>
                          <td className="p-2 text-xs">{lead.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-black">Export Panel</h3>
                <p className="mt-1 text-xs text-slate-500">Export selected opportunities as standard CSV or Google-Sheets-ready CSV.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={exportSelected} disabled={uiState.exportDisabled} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="size-4" /> Standard CSV</button>
                  <button onClick={exportSheetsCsv} disabled={uiState.exportDisabled} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FileSpreadsheet className="size-4" /> Sheets-ready CSV</button>
                  <button onClick={() => void copySelectedCsv()} disabled={uiState.exportDisabled} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Link2 className="size-4" /> Copy CSV</button>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Direct Google Sheets sync is intentionally disabled in phase 1. Use Sheets-ready CSV for now.
                </p>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-black">Lead Detail</h3>
                {!activeLead ? (
                  <p className="mt-3 text-sm text-slate-500">Select a lead row to inspect details and pitch guidance.</p>
                ) : (
                  <div className="mt-3 grid gap-3 text-sm">
                    <div>
                      <p className="font-black">{activeLead.businessName}</p>
                      <p className="text-xs text-slate-500">{activeLead.category} • {activeLead.city}, {activeLead.state}</p>
                    </div>
                    <p className="text-xs"><span className="font-black">Why this lead:</span> {activeLead.presenceGaps.join(", ")}.</p>
                    <p className="text-xs"><span className="font-black">Suggested pitch angle:</span> {activeLead.suggestedPitch}</p>
                    <p className="text-xs"><span className="font-black">Recommended service offer:</span> {activeLead.recommendedOffer}</p>
                    <p className="text-xs"><span className="font-black">Suggested next action:</span> Add to AudGen queue, generate audit, and trigger outreach sequence.</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={exportSelected} disabled={uiState.exportDisabled} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Export selected</button>
                      <button onClick={addSelectedToAudgen} disabled={uiState.exportDisabled || isAdding} className="h-9 rounded-xl bg-lime-300 px-3 text-xs font-black text-slate-950 hover:bg-lime-200 disabled:opacity-50">{isAdding ? "Adding..." : "Add selected to AudGen"}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
