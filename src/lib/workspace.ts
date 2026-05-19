import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { cookies } from "next/headers";

// Re-export the pure scope helpers from `@/lib/workspace-scope` so
// existing call sites (server actions, page components, route
// handlers) keep working unchanged. Code that runs OUTSIDE the
// Next.js runtime — Background Functions, standalone scripts —
// should import the helpers directly from `@/lib/workspace-scope`
// to avoid pulling this file's `next/headers` import into the
// bundle. Bundle-load failure mode pinned by
// `src/lib/middleware-invariants.test.ts` and
// `src/lib/workspace-runtime-isolation.test.ts`.
export { strictWorkspaceScope, withWorkspaceFallbackScope } from "@/lib/workspace-scope";

const DEFAULT_WORKSPACE_SLUG_FALLBACK = "default";
const DEFAULT_WORKSPACE_NAME_FALLBACK = "Default Workspace";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
};

export async function ensureDefaultWorkspace() {
  const env = getEnv();
  const slug = env.DEFAULT_WORKSPACE_SLUG?.trim() || DEFAULT_WORKSPACE_SLUG_FALLBACK;
  const name = env.DEFAULT_WORKSPACE_NAME?.trim() || DEFAULT_WORKSPACE_NAME_FALLBACK;
  return prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const workspace = await ensureDefaultWorkspace();
  return { workspaceId: workspace.id, workspaceSlug: workspace.slug };
}

export async function listWorkspacesForUser(userId: string) {
  // SECURITY: previously this function auto-upserted the caller as `owner`
  // of the platform Default Workspace whenever they were `owner`/`admin` of
  // ANY workspace. That granted cross-tenant access to anyone who signed up
  // (every new user becomes owner of their own workspace via signup). The
  // auto-elevation has been removed. Memberships must be granted explicitly.
  await ensureDefaultWorkspace();

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    workspaceSlug: membership.workspace.slug,
    workspaceName: membership.workspace.name,
    role: membership.role,
  }));
}

export async function getWorkspaceContextForUser(userId: string): Promise<WorkspaceContext> {
  const workspaceCookie = (await cookies()).get("pl_workspace")?.value;
  const memberships = await listWorkspacesForUser(userId);
  const selected = memberships.find((item) => item.workspaceId === workspaceCookie) ?? memberships[0];
  if (selected) {
    return {
      workspaceId: selected.workspaceId,
      workspaceSlug: selected.workspaceSlug,
    };
  }
  return getWorkspaceContext();
}

// strictWorkspaceScope + withWorkspaceFallbackScope live in
// `@/lib/workspace-scope` (pure, runtime-agnostic) and are
// re-exported above for backward compatibility.
