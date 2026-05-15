import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_DEMO_WORKSPACE_SLUG,
  getDemoWorkspaceSlug,
  isDemoWorkspaceSlug,
  isPreviewModeEnabled,
  shouldShowDemoBanner,
} from "./demo-mode";

const originalSlugEnv = process.env.DEMO_WORKSPACE_SLUG;
const originalPreviewEnv = process.env.PREVIEW_MODE;
const originalPublicPreviewEnv = process.env.NEXT_PUBLIC_PREVIEW_MODE;

beforeEach(() => {
  delete process.env.DEMO_WORKSPACE_SLUG;
  delete process.env.PREVIEW_MODE;
  delete process.env.NEXT_PUBLIC_PREVIEW_MODE;
});

afterEach(() => {
  if (originalSlugEnv === undefined) delete process.env.DEMO_WORKSPACE_SLUG;
  else process.env.DEMO_WORKSPACE_SLUG = originalSlugEnv;
  if (originalPreviewEnv === undefined) delete process.env.PREVIEW_MODE;
  else process.env.PREVIEW_MODE = originalPreviewEnv;
  if (originalPublicPreviewEnv === undefined)
    delete process.env.NEXT_PUBLIC_PREVIEW_MODE;
  else process.env.NEXT_PUBLIC_PREVIEW_MODE = originalPublicPreviewEnv;
});

describe("demo-mode helpers", () => {
  it("getDemoWorkspaceSlug defaults to 'demo-agency'", () => {
    expect(getDemoWorkspaceSlug()).toBe(DEFAULT_DEMO_WORKSPACE_SLUG);
    expect(DEFAULT_DEMO_WORKSPACE_SLUG).toBe("demo-agency");
  });

  it("getDemoWorkspaceSlug respects DEMO_WORKSPACE_SLUG and lowercases it", () => {
    process.env.DEMO_WORKSPACE_SLUG = "AcmeDemo";
    expect(getDemoWorkspaceSlug()).toBe("acmedemo");
  });

  it("isDemoWorkspaceSlug compares case-insensitively, trims, and is null-safe", () => {
    expect(isDemoWorkspaceSlug(null)).toBe(false);
    expect(isDemoWorkspaceSlug(undefined)).toBe(false);
    expect(isDemoWorkspaceSlug("")).toBe(false);
    expect(isDemoWorkspaceSlug("Demo-Agency")).toBe(true);
    expect(isDemoWorkspaceSlug("  demo-agency  ")).toBe(true);
    expect(isDemoWorkspaceSlug("real-customer")).toBe(false);
  });

  it("isPreviewModeEnabled true when either PREVIEW_MODE or NEXT_PUBLIC_PREVIEW_MODE is 'true'", () => {
    expect(isPreviewModeEnabled()).toBe(false);
    process.env.PREVIEW_MODE = "true";
    expect(isPreviewModeEnabled()).toBe(true);
    delete process.env.PREVIEW_MODE;
    process.env.NEXT_PUBLIC_PREVIEW_MODE = "true";
    expect(isPreviewModeEnabled()).toBe(true);
  });

  it("shouldShowDemoBanner = preview flag OR slug match", () => {
    expect(shouldShowDemoBanner({ workspaceSlug: null })).toBe(false);
    expect(shouldShowDemoBanner({ workspaceSlug: "real" })).toBe(false);
    expect(shouldShowDemoBanner({ workspaceSlug: "demo-agency" })).toBe(true);
    process.env.PREVIEW_MODE = "true";
    expect(shouldShowDemoBanner({ workspaceSlug: "real" })).toBe(true);
  });
});
