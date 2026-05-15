/**
 * Pipeline activity helpers.
 *
 * Activity is an append-only ledger of everything that happened to a Lead.
 * It powers timelines, daily briefs, conversion analytics, and the
 * outcome-feedback loop. The Prisma `Activity` model already exists with a
 * free-text `type` column \u2014 this file constrains those types to a
 * canonical enum so reports and dashboards can rely on them.
 */

import type { Prisma } from "@prisma/client";

export const ACTIVITY_TYPES = [
  "LEAD_IMPORTED",
  "LEAD_SCORED",
  "AUDIT_GENERATED",
  "OUTREACH_PREPARED",
  "LEAD_CONTACTED",
  "REPLY_LOGGED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
  "DEAL_WON",
  "DEAL_LOST",
  "NOTE_ADDED",
  "STAGE_CHANGED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

export type ActivityInput = {
  workspaceId: string;
  leadId: string | null;
  type: ActivityType;
  detail?: string | null;
  source?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Build the data shape for `prisma.activity.create`. Kept as a pure
 * function (no DB call) so callers can compose it inside their own
 * transactions. The companion transitionLeadStage helper wraps this in
 * the same transaction as the Lead update.
 */
export function buildActivityCreate(
  input: ActivityInput,
): Prisma.ActivityCreateArgs["data"] {
  if (!input.workspaceId) throw new Error("activity: workspaceId required");
  if (!isActivityType(input.type)) {
    throw new Error(`activity: invalid type "${input.type}"`);
  }
  return {
    workspaceId: input.workspaceId,
    leadId: input.leadId ?? null,
    type: input.type,
    detail: input.detail ?? null,
    source: input.source ?? "system",
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  };
}
