import {
  validatePersonalization,
  type PersonalizationReport,
} from "@/lib/intelligence/outreach/personalization";
import { normalizeStage, type LeadStage } from "@/lib/pipeline/stages";

/**
 * Prep page action card.
 *
 * Sits at the top of /prep/[id] and gives the seller a one-glance
 * answer to "what's the state of this lead and what should I do
 * next?"
 *
 * Pure server component. No client JS. No DB calls. Inputs are the
 * already-loaded Lead row, the audit checks, and the generated
 * 30-second pitch. Personalization score is computed inline via the
 * existing validator.
 *
 * The "next action" is a simple stage-driven recommendation that does
 * NOT depend on the parked next-best-action engine (that branch is
 * not on develop yet). When the NBA branch lands we swap this for
 * the richer rule.
 */

type Lead = {
  status: string;
  businessName: string;
  ownerName?: string | null;
  category?: string | null;
  location?: string | null;
  nextFollowUpAt?: Date | null;
  lastContactedAt?: Date | null;
};

function nextActionFromStage(stage: LeadStage): { label: string; reason: string; tone: "high" | "medium" | "low" } {
  switch (stage) {
    case "REPLIED":
    case "QUALIFIED":
      return { label: "Move to call or proposal", reason: "Prospect engaged. Don't let it cool.", tone: "high" };
    case "CALL_BOOKED":
      return { label: "Prep + confirm the call", reason: "Call is on the calendar.", tone: "high" };
    case "PROPOSAL_SENT":
      return { label: "Check in if no movement in 3 days", reason: "Proposal is in flight.", tone: "medium" };
    case "CONTACTED":
      return { label: "Wait one beat, then second touch", reason: "Recently contacted.", tone: "medium" };
    case "PREPARED":
      return { label: "Send the first outreach", reason: "Pitch is ready.", tone: "medium" };
    case "AUDIT_GENERATED":
      return { label: "Prep the outreach", reason: "Audit is ready.", tone: "medium" };
    case "WON":
      return { label: "Capture the close", reason: "Deal won. Log the outcome.", tone: "low" };
    case "LOST":
    case "DISQUALIFIED":
      return { label: "Log the lost reason", reason: "Capture what didn't work.", tone: "low" };
    case "NURTURE":
      return { label: "Cadence handles this", reason: "Stay patient.", tone: "low" };
    default:
      return { label: "Prep the pitch", reason: "New lead. Start the audit + pitch flow.", tone: "medium" };
  }
}

const TONE_STYLES: Record<"high" | "medium" | "low", string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

type PrepActionCardProps = {
  lead: Lead;
  pitchText: string;
  failedAuditCheckKeys: string[];
  /** Optional override for deterministic rendering in tests. */
  now?: Date;
};

export function PrepActionCard({
  lead,
  pitchText,
  failedAuditCheckKeys,
  now,
}: PrepActionCardProps) {
  const nowMs = (now ?? new Date()).getTime();
  const stage = normalizeStage(lead.status);
  const action = nextActionFromStage(stage);

  const report: PersonalizationReport = validatePersonalization({
    text: pitchText || "",
    businessName: lead.businessName,
    ownerName: lead.ownerName,
    location: lead.location,
    category: lead.category,
    failedAuditChecks: failedAuditCheckKeys,
  });
  const score = `${report.found.length}/4`;
  const scoreTone = report.ok ? "text-emerald-700" : "text-amber-800";

  const lastContacted = lead.lastContactedAt
    ? `${Math.max(0, Math.floor((nowMs - lead.lastContactedAt.getTime()) / 86_400_000))}d ago`
    : "never";
  const nextFollowUp = lead.nextFollowUpAt
    ? new Date(lead.nextFollowUpAt).toLocaleDateString()
    : "—";

  return (
    <section
      aria-label="Lead action card"
      className={`mb-4 rounded-3xl border p-4 ${TONE_STYLES[action.tone]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em]">
            {`Next action — ${action.tone} urgency`}
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{action.label}</h2>
          <p className="mt-1 text-sm">{action.reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Stage
          </p>
          <p className="mt-0.5 text-sm font-black text-slate-900">{stage}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white/70 p-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Pitch personalization</p>
          <p className={`mt-0.5 text-base font-black ${scoreTone}`}>{score}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Last contacted</p>
          <p className="mt-0.5 text-base font-black text-slate-900">{lastContacted}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Next follow-up</p>
          <p className="mt-0.5 text-base font-black text-slate-900">{nextFollowUp}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-500">Audit gaps cited</p>
          <p className="mt-0.5 text-base font-black text-slate-900">{failedAuditCheckKeys.length}</p>
        </div>
      </div>

      {!report.ok ? (
        <details className="mt-3 rounded-2xl bg-white/70 p-2 text-xs">
          <summary className="cursor-pointer font-black uppercase tracking-[0.14em] text-slate-600">
            Personalization gaps ({report.notes.length})
          </summary>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-800">
            {report.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-3 text-[11px] text-slate-600">
        Reply form is at the bottom of this page. Stage moves automatically when you log a reply.
      </p>
    </section>
  );
}
