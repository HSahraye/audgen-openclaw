import { prisma } from "@/lib/prisma";

/**
 * Onboarding status: did the workspace complete the four day-zero
 * steps?
 *
 * Pure server helper. Strictly workspace-scoped. No writes. Each
 * step is detected from existing tables (no schema change):
 *
 *  1. import_first_lead   >= 1 Lead in this workspace
 *  2. pick_vertical       workspace.name set + not the default slug +
 *                         at least one Lead with `category` matching
 *                         a known vertical
 *  3. first_audit         >= 1 Lead with `generatedContextJson` set
 *  4. first_outreach      >= 1 OutreachLog row for any Lead in the
 *                         workspace
 *
 * `currentStep` is the first undone step in the order above. `null`
 * means the workspace has finished the wizard.
 */

export const ONBOARDING_STEPS = [
  "import_first_lead",
  "pick_vertical",
  "first_audit",
  "first_outreach",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const STEP_META: Record<OnboardingStep, { label: string; ctaHref: string; hint: string }> = {
  import_first_lead: {
    label: "Import your first lead list",
    ctaHref: "/research",
    hint: "Start with 25 real leads you'd actually call this week.",
  },
  pick_vertical: {
    label: "Pick a vertical",
    ctaHref: "/settings/billing",
    hint: "Name your workspace and tag at least one lead with a vertical category (dental, hvac, smoke shop, etc.).",
  },
  first_audit: {
    label: "Generate your first audit",
    ctaHref: "/",
    hint: "Open any lead from the dashboard \u2014 the audit + prep are pre-generated.",
  },
  first_outreach: {
    label: "Send your first outreach",
    ctaHref: "/",
    hint: "Use the prep page to copy the pitch into email or SMS. Then log the outreach.",
  },
};

export type OnboardingStatus = {
  workspaceId: string;
  steps: Array<{
    key: OnboardingStep;
    label: string;
    done: boolean;
    ctaHref: string;
    hint: string;
  }>;
  currentStep: OnboardingStep | null;
  pctComplete: number;
};

/**
 * Known vertical categories. We detect step 2 by matching a lead's
 * free-text `category` against this list. The list mirrors the
 * `feature/vertical-pack-scaffold` branch (parked) so when that
 * branch merges we can swap to a shared registry.
 */
const KNOWN_VERTICAL_CATEGORIES = new Set<string>([
  "dental",
  "dentist",
  "dental office",
  "dental practice",
  "dental clinic",
  "smoke shop",
  "tobacco shop",
  "vape shop",
  "cigar shop",
  "headshop",
  "hvac",
  "heating",
  "air conditioning",
  "hvac contractor",
  "ac repair",
  "heating and cooling",
]);

const DEFAULT_WORKSPACE_NAMES = new Set<string>(["default workspace", "default", ""]);

function isWorkspaceNamed(workspace: { name: string; slug: string } | null): boolean {
  if (!workspace) return false;
  const name = workspace.name.trim().toLowerCase();
  if (!name) return false;
  if (DEFAULT_WORKSPACE_NAMES.has(name)) return false;
  if (name === workspace.slug.toLowerCase()) return false;
  return true;
}

function isKnownVerticalCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return KNOWN_VERTICAL_CATEGORIES.has(category.trim().toLowerCase());
}

export async function getOnboardingStatus(
  workspaceId: string,
): Promise<OnboardingStatus> {
  if (!workspaceId) throw new Error("onboarding-status: workspaceId required");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  // We want one round trip per step but Prisma counts are cheap.
  const [leadCount, auditedCount, outreachCount, leadsWithCategory] = await Promise.all([
    prisma.lead.count({ where: { workspaceId } }),
    prisma.lead.count({
      where: { workspaceId, generatedContextJson: { not: null } },
    }),
    prisma.outreachLog.count({ where: { workspaceId } }),
    // Pull up to 50 categories so we can match against the known set.
    prisma.lead.findMany({
      where: { workspaceId, category: { not: null } },
      select: { category: true },
      take: 50,
    }),
  ]);

  const hasKnownVertical = leadsWithCategory.some((row) =>
    isKnownVerticalCategory(row.category),
  );

  const done: Record<OnboardingStep, boolean> = {
    import_first_lead: leadCount > 0,
    pick_vertical: isWorkspaceNamed(workspace) && hasKnownVertical,
    first_audit: auditedCount > 0,
    first_outreach: outreachCount > 0,
  };

  const steps = ONBOARDING_STEPS.map((key) => ({
    key,
    label: STEP_META[key].label,
    done: done[key],
    ctaHref: STEP_META[key].ctaHref,
    hint: STEP_META[key].hint,
  }));

  const currentStep = steps.find((s) => !s.done)?.key ?? null;
  const completed = steps.filter((s) => s.done).length;
  const pctComplete = completed / steps.length;

  return { workspaceId, steps, currentStep, pctComplete };
}
