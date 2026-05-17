// Pure helpers for the signup flow. No side effects, no I/O. Live in their
// own module so they can be unit-tested without spinning up Prisma /
// better-auth / Next request scope.

export const SIGNUP_ERROR_CODES = [
  "invalid-email",
  "password-too-short",
  "password-too-long",
  "missing-password",
  "missing-name",
  "missing-workspace-name",
  "email-in-use",
  "service-unavailable",
  "unknown",
] as const;

export type SignupErrorCode = (typeof SIGNUP_ERROR_CODES)[number];

export type SignupValidationResult =
  | {
      ok: true;
      data: { email: string; password: string; name: string; workspaceName: string };
    }
  | { ok: false; code: SignupErrorCode; reason: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// better-auth's default password policy is min 8, max 128. Pre-validate
// here so we can return a typed error code BEFORE invoking better-auth.
// Keep these in sync with `emailAndPassword` config in src/lib/auth/better-auth.ts.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function validateSignupInput(input: {
  email: string;
  password: string;
  name?: string;
  workspaceName?: string;
}): SignupValidationResult {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = (input.name ?? "").trim();
  const workspaceName = (input.workspaceName ?? "").trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, code: "invalid-email", reason: "Email address is required and must be valid." };
  }
  if (!password) {
    return { ok: false, code: "missing-password", reason: "Password is required." };
  }
  if (password.length < PASSWORD_MIN) {
    return {
      ok: false,
      code: "password-too-short",
      reason: `Password must be at least ${PASSWORD_MIN} characters.`,
    };
  }
  if (password.length > PASSWORD_MAX) {
    return {
      ok: false,
      code: "password-too-long",
      reason: `Password must be at most ${PASSWORD_MAX} characters.`,
    };
  }
  if (!workspaceName) {
    return {
      ok: false,
      code: "missing-workspace-name",
      reason: "Workspace name is required.",
    };
  }

  return {
    ok: true,
    data: { email, password, name: name || email.split("@")[0] || "User", workspaceName },
  };
}

export function classifySignupError(error: unknown): { code: SignupErrorCode; reason: string } {
  const message = error instanceof Error ? error.message : "";
  const lowered = message.toLowerCase();

  // better-auth uses these substrings on validation failures.
  if (lowered.includes("user_already_exists") || lowered.includes("already exists") || lowered.includes("user with this email")) {
    return { code: "email-in-use", reason: "An account with this email already exists." };
  }
  if (lowered.includes("invalid_email") || lowered.includes("invalid email")) {
    return { code: "invalid-email", reason: "Email address is invalid." };
  }
  if (lowered.includes("password") && (lowered.includes("short") || lowered.includes("min"))) {
    return { code: "password-too-short", reason: `Password must be at least ${PASSWORD_MIN} characters.` };
  }
  if (lowered.includes("password") && (lowered.includes("long") || lowered.includes("max"))) {
    return { code: "password-too-long", reason: `Password must be at most ${PASSWORD_MAX} characters.` };
  }

  // Postgres / Prisma transport errors. Surface as a 5xx-style code so the
  // user understands this is an infrastructure problem, not their inputs.
  if (
    lowered.includes("postgresql connection") ||
    lowered.includes("connection: closed") ||
    lowered.includes("kind: closed") ||
    lowered.includes("can't reach database server") ||
    lowered.includes("p1001") ||
    lowered.includes("p1002") ||
    lowered.includes("p1017")
  ) {
    return {
      code: "service-unavailable",
      reason: "We're having trouble reaching the account database. Please retry in a moment.",
    };
  }

  return { code: "unknown", reason: "Sign up failed. Please retry." };
}

export const SIGNUP_ERROR_MESSAGES: Record<SignupErrorCode, string> = {
  "invalid-email": "Email address is invalid.",
  "password-too-short": `Password must be at least ${PASSWORD_MIN} characters.`,
  "password-too-long": `Password must be at most ${PASSWORD_MAX} characters.`,
  "missing-password": "Password is required.",
  "missing-name": "Full name is required.",
  "missing-workspace-name": "Workspace name is required.",
  "email-in-use": "An account with this email already exists. Try signing in instead.",
  "service-unavailable":
    "We could not reach the account database. Please retry in a moment.",
  unknown: "Sign up failed. Please check your inputs and try again.",
};
