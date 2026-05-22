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
  if (pathname.startsWith("/privacy")) return false;
  if (pathname.startsWith("/terms")) return false;
  if (pathname.startsWith("/accept-invite")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname === "/favicon.ico") return false;
  // Standalone Netlify Functions (background audit generation, etc.).
  // These have their own HMAC-based auth (see audit-async.ts) and are
  // called server-to-server from `regenerateLeadAction`. The fetch
  // does NOT carry a Better-Auth session cookie, so without this
  // bypass the middleware would redirect the internal call to /login.
  if (pathname.startsWith("/.netlify/functions/")) return false;
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

// SECURITY: static-asset / public-metadata paths that must always pass
// through the middleware untouched. Crawler requests for /robots.txt and
// /sitemap.xml were being intercepted and 502'd on production. None of these
// paths overlap with the auth hard-gate list below, so the early bypass is
// safe and does not weaken protection of /settings, /approvals, or
// /automation/approvals.
function isPublicStaticAsset(pathname: string) {
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/icon.svg") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (/\.(?:txt|xml|ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf|css|js|map|json)$/i.test(pathname)) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicStaticAsset(pathname)) return NextResponse.next();

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

// Matcher excludes static asset paths so the middleware function is never
// invoked for crawler / public-metadata requests. The early bypass inside
// the function body above is a belt-and-suspenders for edge cases where the
// negative-lookahead matcher does not cleanly skip a path (some Netlify
// edge runtimes evaluate /robots.txt against the regex differently than
// node-server Next.js).
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|\\.netlify/functions/|.*\\.(?:txt|xml|ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf|css|js|map|json)).*)",
  ],
};
