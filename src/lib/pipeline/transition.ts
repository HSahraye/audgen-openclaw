import { prisma } from "@/lib/prisma";
import {
  isLeadStage,
  isValidTransition,
  normalizeStage,
  type LeadStage,
} from "./stages";
import { buildActivityCreate } from "./activity";

/**
 * Server-side stage transition helper.
 *
 * Single safe entry point for moving a Lead through the pipeline. It:
 *   - validates required arguments and fails closed when any are missing
 *   - verifies the lead exists in the named workspace (cross-workspace
 *     attempts are rejected; we use a single composite WHERE rather than
 *     fetching + checking in two steps to avoid TOCTOU)
 *   - resolves the lead's CURRENT canonical stage by normalizing the
 *     legacy free-text `Lead.status`
 *   - enforces STAGE_TRANSITIONS so silly moves (e.g. WON -> CONTACTED)
 *     are rejected
 *   - writes the new stage and the activity row inside a single
 *     `prisma.$transaction` so we never have a Lead in stage X without an
 *     Activity logging the move
 *
 * It returns the updated Lead + the created Activity record.
 */
export type TransitionArgs = {
  leadId: string;
  workspaceId: string;
  actorUserId: string | null;
  nextStage: LeadStage;
  note?: string | null;
};

export type TransitionResult =
  | {
      ok: true;
      previousStage: LeadStage;
      nextStage: LeadStage;
      leadId: string;
      activityId: string;
    }
  | {
      ok: false;
      error:
        | "missing_required"
        | "invalid_stage"
        | "lead_not_found"
        | "invalid_transition";
      previousStage?: LeadStage;
    };

export async function transitionLeadStage(
  args: TransitionArgs,
): Promise<TransitionResult> {
  // Fail closed on missing required fields. actorUserId may legitimately
  // be null for system-initiated transitions (e.g. import job creating
  // LEAD_IMPORTED), but workspaceId and leadId are non-negotiable.
  if (!args || !args.leadId || !args.workspaceId || !args.nextStage) {
    return { ok: false, error: "missing_required" };
  }
  if (!isLeadStage(args.nextStage)) {
    return { ok: false, error: "invalid_stage" };
  }

  // Composite WHERE: cross-workspace attempts get lead_not_found, not a
  // sneaky 200 with the wrong workspace.
  const lead = await prisma.lead.findFirst({
    where: { id: args.leadId, workspaceId: args.workspaceId },
    select: { id: true, status: true },
  });
  if (!lead) return { ok: false, error: "lead_not_found" };

  const previousStage = normalizeStage(lead.status);
  if (!isValidTransition(previousStage, args.nextStage)) {
    return { ok: false, error: "invalid_transition", previousStage };
  }

  const activityData = buildActivityCreate({
    workspaceId: args.workspaceId,
    leadId: args.leadId,
    type: "STAGE_CHANGED",
    detail: args.note ?? null,
    source: args.actorUserId ? "user" : "system",
    metadata: {
      previousStage,
      nextStage: args.nextStage,
      actorUserId: args.actorUserId ?? null,
    },
  });

  const [, createdActivity] = await prisma.$transaction([
    prisma.lead.update({
      where: { id: args.leadId },
      data: { status: args.nextStage },
    }),
    prisma.activity.create({ data: activityData }),
  ]);

  return {
    ok: true,
    previousStage,
    nextStage: args.nextStage,
    leadId: args.leadId,
    activityId: createdActivity.id,
  };
}
