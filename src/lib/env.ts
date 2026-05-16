import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_CALENDLY_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),

  APP_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
  SESSION_SECRET: z.string().optional(),
  AUTH_OWNER_PASSWORD: z.string().optional(),
  AUTH_ADMIN_PASSWORD: z.string().optional(),
  AUTH_MEMBER_PASSWORD: z.string().optional(),
  AUTH_SALES_PASSWORD: z.string().optional(),
  AUTH_VIEWER_PASSWORD: z.string().optional(),

  AUDIT_LINK_SECRET: z.string().optional(),
  AUDIT_LINK_TTL_SECONDS: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SAAS_PRICE_STARTER: z.string().optional(),
  STRIPE_SAAS_PRICE_GROWTH: z.string().optional(),
  STRIPE_SAAS_PRICE_AGENCY: z.string().optional(),
  STRIPE_SAAS_PRICE_ENTERPRISE: z.string().optional(),
  STRIPE_SAAS_TRIAL_DAYS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  POSTMARK_API_KEY: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_PHONE: z.string().optional(),
  AUTOMATION_RUNNER_SECRET: z.string().optional(),

  CRM_WEBHOOK_URL: z.string().url().optional(),
  CRM_WEBHOOK_SECRET: z.string().optional(),
  // SECURITY: shared secret used to verify inbound webhooks at
  // /api/communication/events. Configure this when wiring up provider
  // delivery/open/click/bounce/unsubscribe events. If unset in production,
  // the endpoint refuses anonymous calls.
  COMMUNICATION_WEBHOOK_SECRET: z.string().optional(),

  PUBLIC_INGEST_API_KEY: z.string().optional(),
  PUBLIC_INGEST_API_SECRET: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  DEFAULT_WORKSPACE_SLUG: z.string().optional(),
  DEFAULT_WORKSPACE_NAME: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  // SECURITY: when "true", workspace-scoped queries also match rows with
  // workspaceId=null (legacy orphan rows). Leave unset in production.
  ALLOW_WORKSPACE_NULL_FALLBACK: z.enum(["true", "false"]).optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
});

type ParsedEnv = z.infer<typeof envSchema>;

let cachedEnv: ParsedEnv | null = null;

export function getEnv(): ParsedEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function isAuthEnabled() {
  const env = getEnv();
  return env.APP_AUTH_ENABLED === "true";
}

export function assertProductionEnv() {
  const env = getEnv();
  const shouldEnforce = env.NODE_ENV === "production" && (process.env.ENFORCE_ENV_VALIDATION === "true" || process.env.NETLIFY === "true");
  if (!shouldEnforce) return;

  const requiredInProd = z.object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//i, "DATABASE_URL must be a postgres connection string."),
    APP_URL: z.string().url(),
    SESSION_SECRET: z.string().min(24),
    AUDIT_LINK_SECRET: z.string().min(24),
  });
  requiredInProd.parse({
    DATABASE_URL: env.DATABASE_URL,
    APP_URL: env.APP_URL,
    SESSION_SECRET: env.SESSION_SECRET,
    AUDIT_LINK_SECRET: env.AUDIT_LINK_SECRET,
  });
  if (env.APP_AUTH_ENABLED === "true" && !env.BETTER_AUTH_SECRET) {
    // Keep validation aligned with runtime auth config, which falls back to SESSION_SECRET.
    z.object({
      SESSION_SECRET: z.string().min(24),
    }).parse({
      SESSION_SECRET: env.SESSION_SECRET,
    });
  } else if (env.APP_AUTH_ENABLED === "true" && env.BETTER_AUTH_SECRET) {
    z.object({
      BETTER_AUTH_SECRET: z.string().min(24),
    }).parse({
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    });
  }

  if (env.STRIPE_SECRET_KEY) {
    z.object({
      STRIPE_WEBHOOK_SECRET: z.string().min(8),
    }).parse({
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    });
  }

  if (env.RESEND_API_KEY) {
    z.object({ RESEND_FROM_EMAIL: z.string().email() }).parse({ RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL });
  }
  if (env.POSTMARK_API_KEY) {
    z.object({ POSTMARK_FROM_EMAIL: z.string().email() }).parse({ POSTMARK_FROM_EMAIL: env.POSTMARK_FROM_EMAIL });
  }
}

export function getAppOrigin() {
  const env = getEnv();
  return env.NEXT_PUBLIC_APP_URL || env.APP_URL || "";
}

export function getAdminEmails() {
  const env = getEnv();
  return (env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}
