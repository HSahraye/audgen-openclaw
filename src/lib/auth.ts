import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth as betterAuth } from "@/lib/auth/better-auth";
import { prisma } from "@/lib/prisma";
import { getEnv, isAuthEnabled } from "./env";
import { getWorkspaceContext, getWorkspaceContextForUser, listWorkspacesForUser } from "./workspace";
import { logger } from "./logger";
import {
  classifySignupError,
  validateSignupInput,
  type SignupErrorCode,
} from "./auth/signup-validation";

export type AppRole = "owner" | "admin" | "member" | "sales" | "viewer";
const SESSION_COOKIE = "pl_session";
const ACTIVE_WORKSPACE_COOKIE = "pl_workspace";
const LEGACY_USER_COOKIE = "pl_legacy_user";

type SessionPayload = {
  role: AppRole;
  exp: number;
};

function getSessionSecret() {
  const env = getEnv();
  return env.SESSION_SECRET || "dev-insecure-session-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = sign(body);
  return `${body}.${mac}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  if (expected.length !== mac.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readRoleFromSessionToken(token: string | undefined): AppRole | null {
  return decodeSession(token)?.role ?? null;
}

export async function issueSession(role: AppRole) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const token = encodeSession({ role, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function getBetterSession() {
  try {
    return await betterAuth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return null;
  }
}

async function resolveMembershipRole(userId: string, workspaceId: string): Promise<AppRole | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) return null;
  if (membership.role === "owner") return "owner";
  if (membership.role === "admin") return "admin";
  return "member";
}

export async function getCurrentRole(): Promise<AppRole | null> {
  if (!isAuthEnabled()) return "admin";
  const betterSession = await getBetterSession();
  if (betterSession?.user?.id) {
    const active = await getWorkspaceContextForUser(betterSession.user.id);
    const role = await resolveMembershipRole(betterSession.user.id, active.workspaceId);
    if (role) return role;
  }
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  return session?.role ?? null;
}

export async function requireRole(roles: AppRole[]) {
  const role = await getCurrentRole();
  const hasAccess = (() => {
    if (!role) return false;
    if (role === "owner") return true;
    if (roles.includes(role)) return true;
    if (role === "admin") return roles.some((candidate) => candidate === "member" || candidate === "sales" || candidate === "viewer");
    if (role === "member") return roles.some((candidate) => candidate === "sales" || candidate === "viewer");
    return false;
  })();
  if (!hasAccess) {
    redirect("/login");
  }
  return role ?? "viewer";
}

export async function getCurrentSession() {
  const betterSession = await getBetterSession();
  if (betterSession?.user?.id) {
    const active = await getWorkspaceContextForUser(betterSession.user.id);
    const role = await resolveMembershipRole(betterSession.user.id, active.workspaceId);
    if (!role) return null;
    return {
      role,
      workspaceId: active.workspaceId,
      workspaceSlug: active.workspaceSlug,
      userId: betterSession.user.id,
      email: betterSession.user.email,
      name: betterSession.user.name,
      authProvider: "better-auth" as const,
    };
  }
  const role = await getCurrentRole();
  if (!role) return null;
  const legacyUserId = (await cookies()).get(LEGACY_USER_COOKIE)?.value ?? null;
  const legacyUser =
    legacyUserId
      ? await prisma.user.findUnique({
          where: { id: legacyUserId },
          select: { id: true, email: true, name: true },
        })
      : null;
  if (legacyUser?.id) {
    const active = await getWorkspaceContextForUser(legacyUser.id);
    const membershipRole = await resolveMembershipRole(legacyUser.id, active.workspaceId);
    return {
      role: membershipRole || role,
      workspaceId: active.workspaceId,
      workspaceSlug: active.workspaceSlug,
      userId: legacyUser.id,
      email: legacyUser.email ?? null,
      name: legacyUser.name ?? null,
      authProvider: "legacy" as const,
    };
  }
  const { workspaceId, workspaceSlug } = await getWorkspaceContext();
  return {
    role,
    workspaceId,
    workspaceSlug,
    userId: legacyUser?.id ?? null,
    email: legacyUser?.email ?? null,
    name: legacyUser?.name ?? null,
    authProvider: "legacy" as const,
  };
}

export async function requireSessionRole(roles: AppRole[]) {
  const session = await getCurrentSession();
  if (!session || !roles.includes(session.role)) {
    redirect("/login");
  }
  return session;
}

export function resolveRoleFromPassword(password: string): AppRole | null {
  const env = getEnv();
  if (env.AUTH_OWNER_PASSWORD && password === env.AUTH_OWNER_PASSWORD) return "owner";
  if (env.AUTH_ADMIN_PASSWORD && password === env.AUTH_ADMIN_PASSWORD) return "admin";
  if (env.AUTH_MEMBER_PASSWORD && password === env.AUTH_MEMBER_PASSWORD) return "member";
  if (env.AUTH_SALES_PASSWORD && password === env.AUTH_SALES_PASSWORD) return "sales";
  if (env.AUTH_VIEWER_PASSWORD && password === env.AUTH_VIEWER_PASSWORD) return "viewer";
  return null;
}

async function writeAuthAudit(action: string, metadata?: Record<string, unknown>, userId?: string) {
  const workspace = await getWorkspaceContext();
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.workspaceId,
      action,
      actorRole: "system",
      metadataJson: JSON.stringify({ ...metadata, userId: userId ?? null }),
    },
  });
}

// Best-effort variant: never throws. Used inside catch blocks where we are
// already returning a typed error to the caller and must not turn a single
// failure into a double fault that ends up at the global error boundary.
async function tryWriteAuthAudit(action: string, metadata?: Record<string, unknown>, userId?: string) {
  try {
    await writeAuthAudit(action, metadata, userId);
  } catch (auditError) {
    logger.error("auth_audit_write_failed", {
      action,
      reason: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
}

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function getFailedAuthState(identifier: string) {
  const existing = failedAttempts.get(identifier);
  if (!existing) return { locked: false, retryAfterMs: 0 };
  const now = Date.now();
  if (existing.lockedUntil <= now) {
    failedAttempts.delete(identifier);
    return { locked: false, retryAfterMs: 0 };
  }
  return { locked: true, retryAfterMs: existing.lockedUntil - now };
}

export function registerFailedAuthAttempt(identifier: string) {
  const now = Date.now();
  const existing = failedAttempts.get(identifier) ?? { count: 0, lockedUntil: 0 };
  const nextCount = existing.count + 1;
  const lockMs = nextCount >= 5 ? Math.min(15 * 60_000, 60_000 * 2 ** (nextCount - 5)) : 0;
  failedAttempts.set(identifier, { count: nextCount, lockedUntil: now + lockMs });
}

export function clearFailedAuthAttempts(identifier: string) {
  failedAttempts.delete(identifier);
}

function slugifyWorkspace(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

async function uniqueWorkspaceSlug(baseName: string) {
  const base = slugifyWorkspace(baseName);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const identifier = email.trim().toLowerCase();
  const throttle = getFailedAuthState(identifier);
  if (throttle.locked) {
    return { ok: false as const, error: "Too many failed attempts. Please wait and retry." };
  }
  try {
    const result = await betterAuth.api.signInEmail({
      body: { email: identifier, password },
      headers: await headers(),
    });
    clearFailedAuthAttempts(identifier);
    await writeAuthAudit("auth.login", { provider: "better-auth", email: identifier }, result?.user?.id);
    return { ok: true as const };
  } catch (error) {
    registerFailedAuthAttempt(identifier);
    await writeAuthAudit("auth.login.failed", { provider: "better-auth", email: identifier, reason: error instanceof Error ? error.message : "unknown" });
    return { ok: false as const, error: "Invalid email or password." };
  }
}

export type SignUpResult =
  | { ok: true; workspaceId: string }
  | { ok: false; code: SignupErrorCode; error: string };

export async function signUpWithEmailPassword(input: {
  email: string;
  password: string;
  name?: string;
  workspaceName?: string;
}): Promise<SignUpResult> {
  // Pre-validate inputs BEFORE invoking better-auth so common cases
  // (empty email, password too short, missing workspace name) return a
  // typed error code that the UI can render specifically. This stops
  // every signup failure from collapsing into a generic "Authentication
  // failed" UI message.
  const validation = validateSignupInput(input);
  if (!validation.ok) {
    logger.warn("auth_signup_rejected_validation", {
      code: validation.code,
      // email is included for support triage; logger.ts redacts secrets.
      email: input.email,
    });
    await tryWriteAuthAudit("auth.signup.rejected", {
      provider: "better-auth",
      email: input.email,
      code: validation.code,
    });
    return { ok: false, code: validation.code, error: validation.reason };
  }

  const { email, password, name, workspaceName } = validation.data;

  try {
    const signup = await betterAuth.api.signUpEmail({
      body: { email, password, name },
      headers: await headers(),
    });
    const userId = signup?.user?.id;
    if (!userId) {
      // better-auth resolved without throwing but produced no user. Treat
      // as a service-level failure rather than a silent ok:false.
      logger.error("auth_signup_no_user_returned", { email });
      await tryWriteAuthAudit("auth.signup.failed", {
        provider: "better-auth",
        email,
        reason: "no_user_returned",
      });
      return {
        ok: false,
        code: "unknown",
        error: "Sign up failed. Please retry.",
      };
    }
    const slug = await uniqueWorkspaceSlug(workspaceName);
    const workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        slug,
        status: "trialing",
        planTier: "free_trial",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      update: { role: "owner" },
      create: { userId, workspaceId: workspace.id, role: "owner" },
    });
    await prisma.workspaceSettings.upsert({
      where: { workspaceId: workspace.id },
      update: {},
      create: {
        workspaceId: workspace.id,
        brandName: "Presence Labs",
        defaultTone: "consultative",
        defaultOfferStyle: "outcome-focused",
      },
    });
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    await tryWriteAuthAudit(
      "auth.signup",
      { provider: "better-auth", email, workspaceId: workspace.id },
      userId,
    );
    await tryWriteAuthAudit(
      "workspace.create",
      { workspaceId: workspace.id, source: "signup" },
      userId,
    );
    return { ok: true, workspaceId: workspace.id };
  } catch (error) {
    const classified = classifySignupError(error);
    // Log the actual exception server-side so a real diagnosis is
    // possible from Netlify function logs. Previously this was buried
    // inside an audit-log row that nobody reads in production.
    logger.error("auth_signup_failed", {
      email,
      code: classified.code,
      reason: classified.reason,
      // Pass the original Error to logger so it scrubs and serialises
      // name/message/stack consistently.
      error: error instanceof Error ? error : new Error(String(error)),
    });
    await tryWriteAuthAudit("auth.signup.failed", {
      provider: "better-auth",
      email,
      code: classified.code,
      reason: classified.reason,
    });
    return { ok: false, code: classified.code, error: classified.reason };
  }
}

export async function signOutEverywhere() {
  try {
    await betterAuth.api.signOut({
      headers: await headers(),
    });
  } catch {
    // no-op: legacy session will still be cleared
  }
  await clearSession();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  await writeAuthAudit("auth.logout");
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session?.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, image: true, emailVerified: true },
  });
}

export async function getCurrentWorkspace() {
  const session = await getCurrentSession();
  if (!session) return null;
  return prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
}

export async function listCurrentUserWorkspaces() {
  const session = await getCurrentSession();
  if (!session?.userId) {
    const fallback = await getWorkspaceContext();
    return [{ workspaceId: fallback.workspaceId, workspaceSlug: fallback.workspaceSlug, workspaceName: fallback.workspaceSlug, role: "owner" as const }];
  }
  return listWorkspacesForUser(session.userId);
}

export async function setActiveWorkspace(workspaceId: string) {
  const session = await getCurrentSession();
  if (!session?.userId) return false;
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId } },
    select: { workspaceId: true },
  });
  if (!membership) return false;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  await writeAuthAudit("workspace.switch", { workspaceId }, session.userId);
  return true;
}

export async function ensureLegacyWorkspaceUser(role: AppRole, workspaceId: string) {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(LEGACY_USER_COOKIE)?.value;
  if (existingId) {
    const existing = await prisma.user.findUnique({
      where: { id: existingId },
      select: { id: true },
    });
    if (existing) {
      await prisma.membership.upsert({
        where: { userId_workspaceId: { userId: existing.id, workspaceId } },
        update: {
          role: role === "owner" || role === "admin" ? role : "member",
        },
        create: {
          userId: existing.id,
          workspaceId,
          role: role === "owner" || role === "admin" ? role : "member",
        },
      });
      return existing.id;
    }
  }

  const email = `legacy-${role}@local.presencelabs`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: `Legacy ${role}`,
      emailVerified: false,
    },
    select: { id: true },
  });
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    update: {
      role: role === "owner" || role === "admin" ? role : "member",
    },
    create: {
      userId: user.id,
      workspaceId,
      role: role === "owner" || role === "admin" ? role : "member",
    },
  });

  cookieStore.set(LEGACY_USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return user.id;
}

export async function requireWorkspaceRole(roles: Array<"owner" | "admin" | "member">) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const normalized = session.role === "sales" || session.role === "viewer" ? "member" : session.role;
  if (!roles.includes(normalized as "owner" | "admin" | "member")) {
    redirect("/");
  }
  return {
    ...session,
    role: normalized as "owner" | "admin" | "member",
  };
}

export function isInternalPath(pathname: string) {
  if (pathname.startsWith("/audit/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/public/")) return false;
  if (pathname.startsWith("/api/stripe/webhook")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/signup")) return false;
  if (pathname.startsWith("/accept-invite")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname === "/favicon.ico") return false;
  return true;
}
