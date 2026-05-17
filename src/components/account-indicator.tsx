/**
 * AccountIndicator (server component).
 *
 * Renders a small persistent pill in the top-right of every authenticated
 * route showing who you are, which workspace you're in, and a clean
 * sign-out path. Returns null when there is no authenticated session, so
 * /login and other unauthenticated routes render unchanged.
 *
 * Closes the P1 session-clarity gap described in the task brief: prior
 * to this commit there was no in-app indicator of the current account,
 * which led the operator to repeatedly create new test accounts instead
 * of signing out, requiring multiple rounds of database cleanup.
 *
 * Source-of-truth helpers (existing, used as-is):
 *   - getCurrentSession()              src/lib/auth.ts
 *   - listCurrentUserWorkspaces()      src/lib/auth.ts
 *   - switchWorkspaceAction(formData)  src/app/actions/workspace.ts
 *   - POST /api/auth/logout            wraps signOutEverywhere() — clears
 *     better-auth session + legacy `pl_session` + `pl_workspace` cookies
 *     + writes auth audit log.
 */
import { getCurrentSession, listCurrentUserWorkspaces } from "@/lib/auth";
import { AccountIndicatorClient } from "./account-indicator-client";

export async function AccountIndicator() {
  // Cheap fail-closed: any auth subsystem failure → just render nothing.
  // The pill is a UX nicety; it must never crash the global error
  // boundary if e.g. Prisma is briefly unreachable.
  let session: Awaited<ReturnType<typeof getCurrentSession>> | null = null;
  try {
    session = await getCurrentSession();
  } catch {
    return null;
  }
  if (!session) return null;

  let workspaces: Awaited<ReturnType<typeof listCurrentUserWorkspaces>> = [];
  try {
    workspaces = await listCurrentUserWorkspaces();
  } catch {
    workspaces = [];
  }

  const activeWorkspace = workspaces.find((w) => w.workspaceId === session.workspaceId);

  return (
    <AccountIndicatorClient
      userEmail={session.email ?? null}
      userName={session.name ?? null}
      activeWorkspaceId={session.workspaceId}
      activeWorkspaceName={activeWorkspace?.workspaceName ?? session.workspaceSlug}
      workspaces={workspaces.map((w) => ({
        workspaceId: w.workspaceId,
        workspaceName: w.workspaceName,
        role: String(w.role),
      }))}
    />
  );
}
