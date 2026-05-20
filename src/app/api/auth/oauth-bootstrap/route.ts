import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth/better-auth";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

// Must match the constant in src/lib/auth.ts
const ACTIVE_WORKSPACE_COOKIE = "pl_workspace";

// Generates a unique workspace slug derived from a display name.
async function uniqueOAuthSlug(displayName: string): Promise<string> {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace";
  let slug = base;
  let attempt = 0;
  while (await prisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

/**
 * GET /api/auth/oauth-bootstrap
 *
 * Callback target for Google (and future social) OAuth flows. After Better
 * Auth completes the OAuth handshake and creates the user + session, it
 * redirects here. This handler:
 *   1. Reads the active session.
 *   2. Checks whether the user already owns a workspace (returning users, or
 *      email users who sign in via Google after initial email signup).
 *   3. If no workspace exists, bootstraps one with the same defaults as the
 *      email signup path in src/lib/auth.ts::signUpWithEmailPassword.
 *   4. Sets the active workspace cookie.
 *   5. Redirects to "/".
 *
 * The email/password signup path is NOT affected — it creates its workspace
 * directly in signUpWithEmailPassword and never redirects through this route.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userId = session.user.id;

  // Check for existing workspace membership (returning users / email users
  // linking Google after signup).
  const existing = await prisma.membership.findFirst({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  });

  const workspaceId = existing
    ? existing.workspaceId
    : await (async () => {
        // Bootstrap workspace — same shape as email signup path.
        const displayName = (
          session.user.name ||
          (session.user as { email?: string }).email?.split("@")[0] ||
          "My Agency"
        ).trim();

        const slug = await uniqueOAuthSlug(displayName);
        const workspace = await prisma.workspace.create({
          data: {
            name: displayName,
            slug,
            status: "trialing",
            planTier: "free_trial",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });

        await prisma.membership.create({
          data: { userId, workspaceId: workspace.id, role: "owner" },
        });

        await prisma.workspaceSettings.create({
          data: {
            workspaceId: workspace.id,
            brandName: "AuditGen",
            defaultTone: "consultative",
            defaultOfferStyle: "outcome-focused",
          },
        });

        return workspace.id;
      })();

  // Set active workspace cookie so the dashboard loads the right tenant.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL("/", request.url));
}
