import type { NextConfig } from "next";

/**
 * Practical baseline CSP for the AuditGen Next.js App Router.
 *
 * Notes:
 *  - Next.js + Turbopack require some inline scripts and inline styles at
 *    runtime; using 'unsafe-inline' on script-src defeats CSP, so we instead
 *    rely on Next.js's default same-origin script loading and keep
 *    'unsafe-inline' on style-src (Tailwind / Next inject style fragments).
 *  - If a future change adds a nonce-based middleware we should switch
 *    script-src to 'self' 'nonce-...' 'strict-dynamic' and drop the
 *    'unsafe-eval' allowance (Next dev needs it; prod build does not).
 *  - 'connect-src' is broadened to https: + wss: so the app can call
 *    Stripe / analytics / better-auth without breakage. Tighten per env in
 *    a follow-up by emitting the policy from middleware with the actual
 *    origin allowlist.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS: Netlify already sends this in production; keep header in case
  // the app is served from a non-Netlify origin too. Safe at the app layer.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
