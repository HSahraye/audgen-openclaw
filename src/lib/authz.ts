import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth as betterAuth } from "@/lib/auth/better-auth";
import { getAdminEmails, isAuthEnabled } from "@/lib/env";
import { getCurrentSession } from "@/lib/auth";

/**
 * Platform-admin gate.
 *
 * "Admin" here means **platform operator** (Presence Labs staff), not
 * "workspace owner". A workspace owner has elevated rights inside their own
 * workspace; they must NOT be able to view cross-tenant ops data.
 *
 * Allowed iff:
 *   - auth is disabled (dev/local convenience), OR
 *   - the better-auth session user's verified email is in ADMIN_EMAILS.
 *
 * On failure we render the standard Next.js 404 (`notFound()`) rather than
 * 403 so the existence of admin routes is not advertised to enumerators.
 */
export async function requirePlatformAdmin() {
  // In test/dev with auth disabled, allow access so existing test suites that
  // pre-date this gate keep working. Production must set APP_AUTH_ENABLED=true.
  if (!isAuthEnabled()) {
    return { userId: null, email: null, source: "auth-disabled" as const };
  }

  const allowlist = getAdminEmails();
  if (allowlist.length === 0) {
    // Fail closed: if no admin emails are configured, /admin is unreachable.
    notFound();
  }

  // IMPORTANT: only better-auth sessions count for platform admin. The legacy
  // shared-password fallback (pl_session) cannot satisfy this gate even if it
  // somehow encoded "owner" — anonymous role passwords have no email and no
  // attribution, so they must never reach cross-tenant ops surfaces.
  let betterSession: Awaited<ReturnType<typeof betterAuth.api.getSession>> | null = null;
  try {
    betterSession = await betterAuth.api.getSession({ headers: await headers() });
  } catch {
    betterSession = null;
  }

  const email = betterSession?.user?.email?.toLowerCase() ?? null;
  if (!email || !allowlist.includes(email)) {
    notFound();
  }

  return {
    userId: betterSession!.user!.id,
    email,
    source: "better-auth" as const,
  };
}

/**
 * Convenience wrapper that returns true/false instead of throwing.
 * Use this when rendering UI hints (e.g. showing/hiding the /admin link).
 * Never use this as the security gate — the server-side requirePlatformAdmin()
 * call inside the protected page/route is the source of truth.
 */
export async function isCurrentUserPlatformAdmin() {
  if (!isAuthEnabled()) return true;
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) return false;
  try {
    const session = await betterAuth.api.getSession({ headers: await headers() });
    const email = session?.user?.email?.toLowerCase();
    return Boolean(email && allowlist.includes(email));
  } catch {
    return false;
  }
}

/**
 * Workspace membership assertion for API routes / server actions.
 *
 * Returns the current session bound to a workspace the caller is provably a
 * member of. If the caller is not authenticated or not a member, we either
 * redirect to /login (for page/server-action contexts) or callers can catch
 * and translate to a 404 (for API routes — see assertApiSessionWorkspace).
 */
export async function assertSessionWorkspace() {
  const session = await getCurrentSession();
  if (!session?.workspaceId) {
    redirect("/login");
  }
  return session;
}

/**
 * API-route variant: returns the session or `null`. Caller is expected to
 * translate `null` to a 401/404 response. Never trust a workspaceId from the
 * request body, headers, or query string — always use `session.workspaceId`.
 */
export async function assertApiSessionWorkspace() {
  if (!isAuthEnabled()) {
    return { workspaceId: null, userId: null, role: "owner" as const, authProvider: "auth-disabled" as const };
  }
  const session = await getCurrentSession();
  if (!session?.workspaceId) return null;
  return session;
}
