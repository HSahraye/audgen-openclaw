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
import { cookies } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
// Indirected through a client-side `next/dynamic({ ssr: false })`
// wrapper so the indicator's `useRouter` / `usePathname` hooks never
// execute during the static prerender of `/_global-error`, where
// AppRouterContext is absent and the hook would crash with
// "Cannot read properties of null (reading 'useContext')".
// See `account-indicator-client-mount.tsx` for the rationale.
import { AccountIndicatorClientMount } from "./account-indicator-client-mount";

export async function AccountIndicator() {
  // Skip DB/session resolution when no auth cookies are present — anonymous
  // visitors (e.g. /login marketing) should not pay for getBetterSession().
  const cookieStore = await cookies();
  const hasLegacySession = Boolean(cookieStore.get("pl_session")?.value);
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const hasBetterAuthSession = Boolean(
    getSessionCookie(
      new Request("http://localhost", {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      }),
    ),
  );
  if (!hasLegacySession && !hasBetterAuthSession) return null;

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
    <AccountIndicatorClientMount
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
