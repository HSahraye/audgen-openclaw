/**
 * Pipeline stage model — TypeScript source of truth.
 *
 * The Prisma `Lead.status` column is currently free-text. To avoid
 * destructive migrations, this module defines the canonical stage enum at
 * the application layer, normalises legacy free-text values, and exposes a
 * strict transition table. A future PR will migrate `Lead.status` to a real
 * Prisma enum column; see prisma/MIGRATION_PLAN_LEAD_STAGE.md.
 *
 * Why this exists:
 *  - Sales teams need consistent stages across reports and dashboards.
 *  - Without a canonical enum, every dashboard reinvents its own buckets.
 *  - Free-text `status` from earlier code (e.g. "New", "Contacted") must
 *    keep working: `normalizeStage()` maps anything we see to a canonical
 *    value, falling back to NEW if unknown.
 */

export const LEAD_STAGES = [
  "NEW",
  "IMPORTED",
  "SCORED",
  "AUDIT_GENERATED",
  "PREPARED",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "NURTURE",
  "DISQUALIFIED",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

/** Stages that count as "active pipeline" — used by dashboards. */
export const ACTIVE_STAGES: ReadonlyArray<LeadStage> = [
  "IMPORTED",
  "SCORED",
  "AUDIT_GENERATED",
  "PREPARED",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
];

/** Terminal stages — no further automatic transitions. */
export const TERMINAL_STAGES: ReadonlyArray<LeadStage> = ["WON", "LOST", "DISQUALIFIED"];

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value);
}

/**
 * Map free-text legacy `Lead.status` values to a canonical stage. Unknown
 * inputs fall back to NEW. We never throw here — normalization is meant to
 * be safe to call on every Lead row in production.
 */
export function normalizeStage(input: string | null | undefined): LeadStage {
  if (!input) return "NEW";
  const raw = input.trim();
  if (!raw) return "NEW";

  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (isLeadStage(upper)) return upper;

  const aliases: Record<string, LeadStage> = {
    NEW: "NEW",
    IMPORTED: "IMPORTED",
    SCORED: "SCORED",
    AUDITED: "AUDIT_GENERATED",
    AUDIT: "AUDIT_GENERATED",
    AUDIT_DONE: "AUDIT_GENERATED",
    PREP: "PREPARED",
    PREP_READY: "PREPARED",
    PREPPED: "PREPARED",
    CONTACTED: "CONTACTED",
    OUTREACHED: "CONTACTED",
    EMAILED: "CONTACTED",
    CALLED: "CONTACTED",
    REPLIED: "REPLIED",
    RESPONDED: "REPLIED",
    QUALIFIED: "QUALIFIED",
    DEMO_BOOKED: "CALL_BOOKED",
    MEETING_BOOKED: "CALL_BOOKED",
    BOOKED: "CALL_BOOKED",
    CALL_BOOKED: "CALL_BOOKED",
    PROPOSAL: "PROPOSAL_SENT",
    PROPOSAL_SENT: "PROPOSAL_SENT",
    QUOTED: "PROPOSAL_SENT",
    WON: "WON",
    CLOSED_WON: "WON",
    PAID: "WON",
    LOST: "LOST",
    CLOSED_LOST: "LOST",
    NURTURE: "NURTURE",
    SNOOZE: "NURTURE",
    DISQUALIFIED: "DISQUALIFIED",
    DQ: "DISQUALIFIED",
    UNQUALIFIED: "DISQUALIFIED",
  };
  return aliases[upper] ?? "NEW";
}

/**
 * Allowed forward transitions. The model permits skipping intermediate
 * stages (e.g. NEW -> CALL_BOOKED if the lead replied immediately) but
 * rejects backward moves unless explicitly enumerated. NURTURE and the
 * three terminal stages are reachable from most active stages.
 *
 * Operators can always force a NOTE_ADDED via the activity helper without
 * changing stage. To roll a lead back, log a STAGE_CHANGED activity and
 * call transitionLeadStage with the legitimate target stage.
 */
export const STAGE_TRANSITIONS: Record<LeadStage, ReadonlyArray<LeadStage>> = {
  NEW: ["IMPORTED", "SCORED", "AUDIT_GENERATED", "PREPARED", "CONTACTED", "DISQUALIFIED", "NURTURE"],
  IMPORTED: ["SCORED", "AUDIT_GENERATED", "PREPARED", "CONTACTED", "DISQUALIFIED", "NURTURE"],
  SCORED: ["AUDIT_GENERATED", "PREPARED", "CONTACTED", "DISQUALIFIED", "NURTURE"],
  AUDIT_GENERATED: ["PREPARED", "CONTACTED", "DISQUALIFIED", "NURTURE"],
  PREPARED: ["CONTACTED", "DISQUALIFIED", "NURTURE"],
  CONTACTED: ["REPLIED", "QUALIFIED", "CALL_BOOKED", "NURTURE", "LOST", "DISQUALIFIED"],
  REPLIED: ["QUALIFIED", "CALL_BOOKED", "PROPOSAL_SENT", "NURTURE", "LOST", "DISQUALIFIED"],
  QUALIFIED: ["CALL_BOOKED", "PROPOSAL_SENT", "NURTURE", "LOST"],
  CALL_BOOKED: ["PROPOSAL_SENT", "QUALIFIED", "NURTURE", "LOST"],
  PROPOSAL_SENT: ["WON", "LOST", "NURTURE"],
  NURTURE: ["CONTACTED", "REPLIED", "QUALIFIED", "DISQUALIFIED", "LOST"],
  WON: [], // terminal
  LOST: ["NURTURE"], // can rehydrate to nurture only
  DISQUALIFIED: [], // terminal
};

export function isValidTransition(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return false;
  return STAGE_TRANSITIONS[from].includes(to);
}
