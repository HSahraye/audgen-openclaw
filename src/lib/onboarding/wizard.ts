import { prisma } from "@/lib/prisma";

/**
 * Onboarding wizard state.
 *
 * The roadmap defines a 5-step wizard for new workspaces:
 *   1. Workspace named
 *   2. Sample CSV imported (>= 1 lead in the workspace)
 *   3. First audit generated
 *   4. First sequence created
 *   5. First reply logged
 *
 * Each step has a clear "did this happen" signal derivable from
 * existing tables. No new schema. No writes. Strict workspace scope.
 *
 * The helper returns a deterministic ordered list of steps with done
 * flags and a 'currentStep' for the wizard UI to focus.
 */

export type WizardStepKey =
  | "name_workspace"
  | "import_first_lead"
  | "first_audit"
  | "first_sequence"
  | "first_reply";

export type WizardStep = {
  key: WizardStepKey;
  label: string;
  hint: string;
  done: boolean;
  /** Optional CTA route the UI can deep-link to. */
  ctaHref?: string;
};

export type WizardState = {
  workspaceId: string;
  asOf: Date;
  steps: WizardStep[];
  /** First step not yet done. null when the wizard is complete. */
  currentStep: WizardStepKey | null;
  pctComplete: number; // 0..1
};

const STEP_ORDER: WizardStepKey[] = [
  "name_workspace",
  "import_first_lead",
  "first_audit",
  "first_sequence",
  "first_reply",
];

const STEP_LABEL: Record<WizardStepKey, { label: string; hint: string; ctaHref?: string }> = {
  name_workspace: {
    label: "Name your workspace",
    hint: "Give your workspace a real name. This is what your team will see.",
    ctaHref: "/settings/billing",
  },
  import_first_lead: {
    label: "Import your first lead list",
    hint: "Bring in a sample CSV. Start with 25 leads to see how the loop runs.",
    ctaHref: "/research",
  },
  first_audit: {
    label: "Generate your first audit",
    hint: "Pick any lead and let AuditGen produce its presence audit + prep.",
    ctaHref: "/",
  },
  first_sequence: {
    label: "Create your first outreach sequence",
    hint: "Plan the cadence: opener, follow-up, second touch.",
    ctaHref: "/sequences",
  },
  first_reply: {
    label: "Log your first reply",
    hint: "Record what a prospect said. This trains the reply intelligence.",
    ctaHref: "/brief",
  },
};

export async function getOnboardingWizardState(
  workspaceId: string,
): Promise<WizardState> {
  if (!workspaceId) throw new Error("onboarding-wizard: workspaceId required");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  // We treat a workspace as 'named' when its name is set and isn't
  // the default 'Default Workspace' / slug fallback.
  const nameLooksReal =
    Boolean(workspace?.name) &&
    workspace!.name.trim().toLowerCase() !== "default workspace" &&
    workspace!.name.trim() !== "" &&
    workspace!.name.trim().toLowerCase() !== workspace!.slug.toLowerCase();

  const [leadCount, auditCount, sequenceCount, replyCount] = await Promise.all([
    prisma.lead.count({ where: { workspaceId } }),
    // Audit generation creates an Activity row of type AUDIT_GENERATED
    // OR sets generatedContextJson on the Lead. Either is enough.
    prisma.lead.count({
      where: { workspaceId, generatedContextJson: { not: null } },
    }),
    prisma.sequence.count({ where: { workspaceId } }),
    prisma.activity.count({ where: { workspaceId, type: "REPLY_LOGGED" } }),
  ]);

  const doneMap: Record<WizardStepKey, boolean> = {
    name_workspace: nameLooksReal,
    import_first_lead: leadCount > 0,
    first_audit: auditCount > 0,
    first_sequence: sequenceCount > 0,
    first_reply: replyCount > 0,
  };

  const steps: WizardStep[] = STEP_ORDER.map((key) => ({
    key,
    label: STEP_LABEL[key].label,
    hint: STEP_LABEL[key].hint,
    ctaHref: STEP_LABEL[key].ctaHref,
    done: doneMap[key],
  }));

  const currentStep = steps.find((s) => !s.done)?.key ?? null;
  const completed = steps.filter((s) => s.done).length;
  const pctComplete = completed / steps.length;

  return {
    workspaceId,
    asOf: new Date(),
    steps,
    currentStep,
    pctComplete,
  };
}
