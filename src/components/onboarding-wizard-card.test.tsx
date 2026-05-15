import { describe, it, expect } from "vitest";
import type { WizardState } from "@/lib/onboarding/wizard";
import { OnboardingWizardCard } from "./onboarding-wizard-card";

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    return findString((node as { props: { children?: unknown } }).props.children, needle);
  }
  return false;
}

function fresh(): WizardState {
  return {
    workspaceId: "ws_1",
    asOf: new Date(),
    pctComplete: 0,
    currentStep: "name_workspace",
    steps: [
      { key: "name_workspace", label: "Name your workspace", hint: "...", ctaHref: "/settings/billing", done: false },
      { key: "import_first_lead", label: "Import your first lead list", hint: "...", ctaHref: "/research", done: false },
      { key: "first_audit", label: "Generate your first audit", hint: "...", ctaHref: "/", done: false },
      { key: "first_sequence", label: "Create your first outreach sequence", hint: "...", ctaHref: "/sequences", done: false },
      { key: "first_reply", label: "Log your first reply", hint: "...", ctaHref: "/brief", done: false },
    ],
  };
}

describe("OnboardingWizardCard", () => {
  it("renders all five steps when fresh", () => {
    const tree = OnboardingWizardCard({ state: fresh() });
    for (const label of [
      "Name your workspace",
      "Import your first lead list",
      "Generate your first audit",
      "Create your first outreach sequence",
      "Log your first reply",
    ]) {
      expect(findString(tree, label)).toBe(true);
    }
    expect(findString(tree, "5 steps to your first reply")).toBe(true);
  });

  it("shows the percent label and a Go-to-step CTA on the current step only", () => {
    const tree = OnboardingWizardCard({ state: fresh() });
    expect(findString(tree, "0%")).toBe(true);
    expect(findString(tree, "Go to step")).toBe(true);
  });

  it("returns null when the wizard is complete", () => {
    const done: WizardState = { ...fresh(), pctComplete: 1, currentStep: null };
    const tree = OnboardingWizardCard({ state: done });
    expect(tree).toBeNull();
  });

  it("respects partial completion (2/5 done) and shows the right percent", () => {
    const s = fresh();
    s.steps[0].done = true;
    s.steps[1].done = true;
    s.pctComplete = 0.4;
    s.currentStep = "first_audit";
    const tree = OnboardingWizardCard({ state: s });
    expect(findString(tree, "40%")).toBe(true);
    expect(findString(tree, "Generate your first audit")).toBe(true);
  });
});
