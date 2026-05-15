"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceRole } from "@/lib/auth";
import {
  isReplyClassification,
  logManualReply,
  type ReplyClassification,
} from "@/lib/pipeline/replies";

/**
 * Server action: log a manual reply from a lead.
 *
 * Called from the /prep/[id] page form. Workspace and actor are resolved
 * from the session via requireWorkspaceRole(); the leadId comes from the
 * form input but logManualReply re-verifies it belongs to the resolved
 * workspace (composite WHERE) so a tampered leadId fails closed.
 *
 * Roles allowed: owner, admin, member. Sales/viewer can read but not
 * write replies \u2014 if you want sales to log replies, add the role here.
 */
const schema = z.object({
  leadId: z.string().min(1),
  classification: z.string().min(2),
  body: z.string().max(4000).optional(),
  autoTransition: z.union([z.literal("on"), z.literal("off")]).optional(),
});

export type LogReplyActionResult =
  | { ok: true; previousStage: string; nextStage: string; stageChanged: boolean }
  | {
      ok: false;
      error:
        | "missing_required"
        | "invalid_classification"
        | "lead_not_found"
        | "forbidden"
        | "invalid_input";
    };

export async function logManualReplyAction(formData: FormData): Promise<LogReplyActionResult> {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const raw = {
    leadId: String(formData.get("leadId") ?? ""),
    classification: String(formData.get("classification") ?? ""),
    body: formData.get("body") ? String(formData.get("body")) : undefined,
    autoTransition: (formData.get("autoTransition") ? "on" : "off") as "on" | "off",
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (!isReplyClassification(parsed.data.classification)) {
    return { ok: false, error: "invalid_classification" };
  }

  const result = await logManualReply({
    leadId: parsed.data.leadId,
    workspaceId: session.workspaceId,
    actorUserId: session.userId ?? null,
    classification: parsed.data.classification as ReplyClassification,
    body: parsed.data.body ?? null,
    autoTransition: parsed.data.autoTransition !== "off",
  });

  if (!result.ok) return { ok: false, error: result.error };

  // Revalidate the prep page and the home dashboard so stage and counters
  // update on the next render.
  revalidatePath(`/prep/${parsed.data.leadId}`);
  revalidatePath("/");

  return {
    ok: true,
    previousStage: result.previousStage,
    nextStage: result.nextStage,
    stageChanged: result.stageChanged,
  };
}
