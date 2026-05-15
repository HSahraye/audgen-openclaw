"use client";

import { useState, useTransition } from "react";
import { logManualReplyAction, type LogReplyActionResult } from "@/app/actions/replies";

/**
 * Manual reply logger for /prep/[id].
 *
 * Lightweight client component: classification dropdown, optional note,
 * auto-transition toggle, submit. Calls logManualReplyAction (server
 * action) which gates by session/workspace and writes both OutreachLog
 * and Activity rows in a single transaction.
 */

const CLASSIFICATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "INTERESTED", label: "Interested" },
  { value: "BOOKED_CALL", label: "Booked a call" },
  { value: "NEEDS_MORE_INFO", label: "Needs more info" },
  { value: "PRICING_OBJECTION", label: "Pricing objection" },
  { value: "FOLLOW_UP_LATER", label: "Follow up later" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "ALREADY_HAS_PROVIDER", label: "Already has a provider" },
  { value: "WRONG_CONTACT", label: "Wrong contact" },
  { value: "BOUNCED", label: "Bounced" },
  { value: "ANGRY", label: "Angry / hostile" },
];

function describeResult(r: LogReplyActionResult): string {
  if (r.ok) {
    return r.stageChanged
      ? `Reply logged. Stage: ${r.previousStage} → ${r.nextStage}.`
      : "Reply logged.";
  }
  switch (r.error) {
    case "lead_not_found":
      return "We could not find that lead in your workspace.";
    case "invalid_classification":
      return "Please pick a classification.";
    case "invalid_input":
      return "Please fill in the form correctly.";
    case "forbidden":
      return "You don't have permission to log replies.";
    case "missing_required":
      return "Missing required fields.";
    default:
      return "Could not log reply.";
  }
}

export function ReplyLogger({ leadId }: { leadId: string }) {
  const [classification, setClassification] = useState("INTERESTED");
  const [body, setBody] = useState("");
  const [autoTransition, setAutoTransition] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("classification", classification);
    if (body) formData.set("body", body);
    if (autoTransition) formData.set("autoTransition", "on");
    startTransition(async () => {
      try {
        const result = await logManualReplyAction(formData);
        setFeedback(describeResult(result));
        setFeedbackOk(result.ok);
        if (result.ok) setBody("");
      } catch {
        setFeedback("Could not log reply (network error).");
        setFeedbackOk(false);
      }
    });
  }

  return (
    <section
      aria-label="Log a reply"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Log a reply
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">What did they say?</h2>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Manual entry
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={submit}>
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Classification
          </span>
          <select
            className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
          >
            {CLASSIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Note (optional)
          </span>
          <textarea
            className="min-h-[80px] rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            placeholder="Quote what they said, or paraphrase. This shows up on the lead timeline."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={autoTransition}
            onChange={(e) => setAutoTransition(e.target.checked)}
          />
          Auto-move stage based on classification (recommended)
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-1 inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log reply"}
        </button>

        {feedback ? (
          <p
            role="status"
            className={`mt-1 text-xs font-semibold ${
              feedbackOk ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {feedback}
          </p>
        ) : null}
      </form>
    </section>
  );
}
