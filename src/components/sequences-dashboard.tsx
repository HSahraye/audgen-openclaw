"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createSequenceAction, setSequenceStatusAction } from "@/app/actions/automation";
import { defaultStepContent, defaultStepName, defaultStepSubject } from "@/lib/automation/outreach/defaults";
import { SequencesEmptyState } from "@/app/sequences/sequences-empty-state";

type SequenceRow = {
  id: string;
  name: string;
  category: string | null;
  status: "active" | "paused" | "archived";
  autoMode: string;
  updatedAt: string;
  stepCount: number;
  activeLeadCount: number;
};

const STATUS_TONE: Record<SequenceRow["status"], string> = {
  active: "bg-lime-100 text-lime-800 border-lime-200",
  paused: "bg-amber-100 text-amber-800 border-amber-200",
  archived: "bg-slate-100 text-slate-700 border-slate-200",
};

export function SequencesDashboard({ sequences }: { sequences: SequenceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [autoMode, setAutoMode] = useState<"auto_draft" | "approval_required" | "auto_send">("approval_required");
  const [error, setError] = useState("");

  const sorted = useMemo(
    () =>
      [...sequences].sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [sequences],
  );

  const createSequence = () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      setError("");
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("category", category.trim());
      formData.set("autoMode", autoMode);
      formData.set(
        "stepsJson",
        JSON.stringify([
          {
            name: defaultStepName("email", 0),
            channel: "email",
            delayMinutes: 0,
            contentTemplate: defaultStepContent("email"),
            approvalRequired: true,
            subject: defaultStepSubject("email"),
            metadata: {},
          },
        ]),
      );
      const result = await createSequenceAction(formData);
      if (!result.ok) {
        setError(result.error || "Could not create sequence.");
        return;
      }
      setName("");
      setCategory("");
      router.push(`/sequences/${result.sequenceId}`);
      router.refresh();
    });
  };

  const setStatus = (sequenceId: string, status: SequenceRow["status"]) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sequenceId", sequenceId);
      formData.set("status", status);
      await setSequenceStatusAction(formData);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Create Sequence</h2>
        <p className="mt-1 text-sm text-slate-500">Start with one step, then edit in builder.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_200px_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Cold Outreach: Local SEO"
            className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="category (optional)"
            className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-lime-400"
          />
          <select
            value={autoMode}
            onChange={(event) => setAutoMode(event.target.value as "auto_draft" | "approval_required" | "auto_send")}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-lime-400"
          >
            <option value="auto_draft">Auto Draft</option>
            <option value="approval_required">Approval Required</option>
            <option value="auto_send">Auto Send</option>
          </select>
          <button
            disabled={isPending}
            onClick={createSequence}
            className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? "Creating..." : "Create sequence"}
          </button>
        </div>
        {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Workspace Sequences</h2>
        <div className="mt-4 grid gap-3">
          {!sorted.length ? <SequencesEmptyState /> : null}
          {sorted.map((sequence) => (
            <div key={sequence.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sequences/${sequence.id}`} className="text-base font-black text-slate-950 hover:underline">
                      {sequence.name}
                    </Link>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${STATUS_TONE[sequence.status]}`}>{sequence.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {sequence.category || "uncategorized"} · {sequence.stepCount} steps · {sequence.activeLeadCount} active leads · {sequence.autoMode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={isPending}
                    onClick={() => setStatus(sequence.id, sequence.status === "active" ? "paused" : "active")}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {sequence.status === "active" ? "Pause" : "Activate"}
                  </button>
                  <Link href={`/sequences/${sequence.id}`} className="rounded-xl bg-lime-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-lime-200">
                    Open Builder
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
