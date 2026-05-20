import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

const env = getEnv();

// BETTER_AUTH_URL is the canonical public-facing origin Better Auth is
// reachable at.  In production this must be "https://salegen.org".  The
// operator should set BETTER_AUTH_URL on Netlify; if absent we fall back
// through APP_URL / NEXT_PUBLIC_APP_URL and finally the production default.
const PRODUCTION_URL = "https://salegen.org";
const resolvedBaseURL =
  process.env.BETTER_AUTH_URL ||
  env.APP_URL ||
  env.NEXT_PUBLIC_APP_URL ||
  (env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3000");

// Build the trusted-origins list from every URL source we know about, then
// deduplicate.  We always include the production origin and the Netlify
// subdomain so the origin check passes regardless of which URL Netlify
// sends in APP_URL.  localhost:3000 is added for local development only.
const trustedOriginsSet = new Set<string>([
  PRODUCTION_URL,
  "https://salegen.netlify.app",
  ...(env.NODE_ENV !== "production" ? ["http://localhost:3000"] : []),
  ...[resolvedBaseURL, env.APP_URL, env.NEXT_PUBLIC_APP_URL].filter(
    (v): v is string => Boolean(v),
  ),
]);
const trustedOrigins = [...trustedOriginsSet];

// Google OAuth credentials — read strictly from environment; never hardcoded.
// If either var is absent the socialProviders block is omitted entirely so the
// server starts cleanly without Google configured (graceful degradation).
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleProvider =
  googleClientId && googleClientSecret
    ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
    : {};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET || env.SESSION_SECRET || "dev-insecure-better-auth-secret",
  baseURL: resolvedBaseURL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: googleProvider,
  user: {
    modelName: "User",
  },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 6,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
      strategy: "compact",
    },
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  plugins: [nextCookies()],
});
