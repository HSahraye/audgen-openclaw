type LogLevel = "info" | "warn" | "error";

/**
 * Keys whose values must never appear in logs. Match is case-insensitive on
 * the key name and uses a broad "contains" test so e.g. `apiKey`,
 * `stripe_secret_key`, `authorizationHeader`, `passwordHash`, and
 * `refresh_token` all redact correctly.
 *
 * If you need more granularity later, switch this to exact-match + an
 * allowlist. For now, "if it looks like a secret, redact it" is the right
 * default for a sales-engine app handling Stripe / Twilio / Resend / Better
 * Auth credentials.
 */
const SECRET_KEY_PATTERNS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "credential",
  "private",
  "passphrase",
  "webhook_secret",
  "client_secret",
];

const SECRET_VALUE_PATTERNS: RegExp[] = [
  // Stripe live/test keys
  /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/g,
  /\brk_(live|test)_[A-Za-z0-9]{16,}\b/g,
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  // Anthropic / generic provider keys
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  // Generic "Bearer <token>" headers
  /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/gi,
  // Long alphanumeric secrets with key markers
  /\b(?:apikey|api_key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9._\-]{16,}["']?/gi,
];

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_STRING_LEN = 2000;

function keyLooksSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function scrubString(value: string): string {
  if (value.length > MAX_STRING_LEN) {
    value = `${value.slice(0, MAX_STRING_LEN)}…[truncated]`;
  }
  let out = value;
  for (const re of SECRET_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED);
  }
  return out;
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      // stack is helpful but can leak query strings / headers; scrub it.
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keyLooksSensitive(k)) {
        out[k] = REDACTED;
        continue;
      }
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  // functions, symbols, etc.
  return undefined;
}

/**
 * Exposed for tests and for the rare caller that needs to scrub a value
 * before passing it to a structured store (Sentry, PostHog, etc.).
 */
export function redactForLogs(value: unknown): unknown {
  return redact(value);
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const scrubbedMeta =
    meta && Object.keys(meta).length > 0
      ? (redact(meta) as Record<string, unknown>)
      : undefined;
  const payload = {
    level,
    message: scrubString(message),
    ts: new Date().toISOString(),
    ...(scrubbedMeta ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    emit("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit("error", message, meta);
  },
};
