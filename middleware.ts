import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isAuthEnabled } from "./src/lib/env";

function isInternalPath(pathname: string) {
  if (pathname.startsWith("/audit/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/public/")) return false;
  if (pathname.startsWith("/api/stripe/webhook")) return false;
  if (pathname.startsWith("/login")) return false;
  if (pathname.startsWith("/signup")) return false;
  if (pathname.startsWith("/about")) return false;
  if (pathname.startsWith("/accept-invite")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname === "/favicon.ico") return false;
  return true;
}

// SECURITY: routes that must require an authenticated session even when the
// global APP_AUTH_ENABLED kill switch is off. These pages expose sensitive
// configuration (billing, approval workflows) and must never be accessible
// via unauthenticated deep links in any deploy context.
function isProtectedHardGate(pathname: string) {
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;
  if (pathname === "/approvals" || pathname.startsWith("/approvals/")) return true;
  if (pathname === "/automation/approvals" || pathname.startsWith("/automation/approvals/")) return true;
  return false;
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedHardGate(pathname)) {
    const betterAuthSession = getSessionCookie(request);
    const legacySession = request.cookies.get("pl_session")?.value;
    if (betterAuthSession || legacySession) return NextResponse.next();
    return redirectToLogin(request, pathname);
  }

  if (!isAuthEnabled()) return NextResponse.next();
  if (!isInternalPath(pathname)) return NextResponse.next();

  const betterAuthSession = getSessionCookie(request);
  const legacySession = request.cookies.get("pl_session")?.value;
  if (betterAuthSession || legacySession) return NextResponse.next();

  return redirectToLogin(request, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
