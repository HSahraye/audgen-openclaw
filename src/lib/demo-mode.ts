/**
 * Demo / preview mode detection.
 *
 * Pure helper. The seeder creates a workspace with a fixed slug
 * (default `demo-agency`); callers use this to decide whether to show
 * a "preview mode" UI hint. Two ways to opt in:
 *
 *   1. The current workspace slug matches DEMO_WORKSPACE_SLUG
 *      (or the default "demo-agency"). Best for staging where the
 *      seeded workspace is the one you sign into.
 *   2. The env flag PREVIEW_MODE=true. Best for a fully isolated
 *      staging site where every workspace should be treated as a
 *      preview.
 *
 * isDemoWorkspace() and isDemoEnabled() are both server-safe and
 * client-safe (they read process.env.* which Next.js inlines for the
 * `NEXT_PUBLIC_*` namespace on the client; non-public envs return
 * undefined on the client which we treat as "not demo").
 *
 * No DB calls. No side effects.
 */

export const DEFAULT_DEMO_WORKSPACE_SLUG = "demo-agency";

export function getDemoWorkspaceSlug(): string {
  return (process.env.DEMO_WORKSPACE_SLUG || DEFAULT_DEMO_WORKSPACE_SLUG).toLowerCase();
}

export function isDemoWorkspaceSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug.trim().toLowerCase() === getDemoWorkspaceSlug();
}

export function isPreviewModeEnabled(): boolean {
  return (
    process.env.PREVIEW_MODE === "true" ||
    process.env.NEXT_PUBLIC_PREVIEW_MODE === "true"
  );
}

/**
 * High-level: should the UI show a preview-mode hint for this
 * workspace? True if either the workspace slug matches the demo slug,
 * or the global PREVIEW_MODE flag is on.
 */
export function shouldShowDemoBanner(input: {
  workspaceSlug?: string | null;
}): boolean {
  return isPreviewModeEnabled() || isDemoWorkspaceSlug(input.workspaceSlug ?? null);
}
