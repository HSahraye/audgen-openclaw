import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { cookies } from "next/headers";

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

/**
 * SECURITY NOTE.
 *
 * Historically this helper returned `OR: [{ workspaceId }, { workspaceId: null }]`
 * so legacy rows that pre-dated the multi-tenant migration would still surface
 * in the UI. That is a cross-tenant data-leak hazard once a real tenant exists
 * with orphan rows in the table.
 *
 * We now scope strictly to the caller's workspaceId by default. The legacy
 * orphan-row inclusion can be re-enabled explicitly via the env flag
 * `ALLOW_WORKSPACE_NULL_FALLBACK=true` to ease backfill, but it should be
 * disabled in production.
 *
 * The companion helper `strictWorkspaceScope` is preferred in new code.
 */
export function withWorkspaceFallbackScope(workspaceId: string) {
  if (process.env.ALLOW_WORKSPACE_NULL_FALLBACK === "true") {
    return { OR: [{ workspaceId }, { workspaceId: null }] };
  }
  return { workspaceId };
}

/** Always-strict workspace scope. Use this in new code. */
export function strictWorkspaceScope(workspaceId: string) {
  return { workspaceId };
}
