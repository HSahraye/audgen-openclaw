import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  SIGNUP_ERROR_CODES,
  SIGNUP_ERROR_MESSAGES,
  classifySignupError,
  validateSignupInput,
} from "@/lib/auth/signup-validation";

// REGRESSION GUARD for the production P0 where every signup failure
// collapsed into a generic "Authentication failed. Check inputs and retry."
// banner because `signUpWithEmailPassword` returned `{ ok: false, error: "Sign up failed." }`
// with no typed code. Now we pre-validate, classify, and surface specific
// reasons. These tests lock that contract.

describe("validateSignupInput", () => {
  const baseValid = {
    email: "founder@acme.example",
    password: "correcthorsebatterystaple",
    name: "Sam Founder",
    workspaceName: "Acme HVAC",
  };

  it("accepts a fully-populated valid payload", () => {
    const result = validateSignupInput(baseValid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe("founder@acme.example");
    expect(result.data.password.length).toBeGreaterThanOrEqual(PASSWORD_MIN);
    expect(result.data.workspaceName).toBe("Acme HVAC");
  });

  it("lower-cases the email and trims whitespace", () => {
    const result = validateSignupInput({ ...baseValid, email: "  Founder@Acme.example  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe("founder@acme.example");
  });

  it("rejects an empty email with code invalid-email", () => {
    const result = validateSignupInput({ ...baseValid, email: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid-email");
  });

  it("rejects a malformed email with code invalid-email", () => {
    const result = validateSignupInput({ ...baseValid, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid-email");
  });

  it("rejects empty password with code missing-password", () => {
    const result = validateSignupInput({ ...baseValid, password: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing-password");
  });

  it("rejects a too-short password with code password-too-short", () => {
    const result = validateSignupInput({ ...baseValid, password: "short1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("password-too-short");
  });

  it("rejects a too-long password with code password-too-long", () => {
    const result = validateSignupInput({ ...baseValid, password: "x".repeat(PASSWORD_MAX + 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("password-too-long");
  });

  it("rejects empty workspace name with code missing-workspace-name", () => {
    const result = validateSignupInput({ ...baseValid, workspaceName: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing-workspace-name");
  });

  it("falls back to email-prefix when name is empty", () => {
    const result = validateSignupInput({ ...baseValid, name: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("founder");
  });
});

describe("classifySignupError", () => {
  it("maps better-auth duplicate-email errors to email-in-use", () => {
    const cases = [
      new Error("USER_ALREADY_EXISTS"),
      new Error("user with this email already exists"),
      new Error("User already exists in the database"),
    ];
    for (const err of cases) {
      const result = classifySignupError(err);
      expect(result.code, err.message).toBe("email-in-use");
    }
  });

  // REGRESSION GUARD against the original over-broad `"already exists"`
  // substring match. Prisma P2002 unique-constraint failures on tables
  // OTHER than User (workspace slug, membership composite, account
  // providerAccountId) can include the bare phrase "already exists" in
  // adapter-wrapped messages. Those are NOT duplicate-email problems
  // and must NOT be reported to the user as "An account with this email
  // already exists." Otherwise a workspace-slug collision at signup
  // would tell users an account they have never created already exists.
  it("does NOT misclassify non-user 'already exists' errors as email-in-use", () => {
    const nonEmailDuplicates = [
      new Error("Workspace with this slug already exists"),
      new Error("Membership for this user/workspace pair already exists"),
      new Error("Account already exists for provider"),
      new Error("Unique constraint failed on the fields: (`slug`)"),
    ];
    for (const err of nonEmailDuplicates) {
      const result = classifySignupError(err);
      expect(result.code, err.message).not.toBe("email-in-use");
    }
  });

  it("maps password-too-short style errors to password-too-short", () => {
    const result = classifySignupError(new Error("Password must be at least 8 characters (min)"));
    expect(result.code).toBe("password-too-short");
  });

  it("maps Postgres connection-closed errors to service-unavailable", () => {
    const cases = [
      new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }"),
      new Error("Can't reach database server at db.example:5432"),
      new Error("PrismaClientInitializationError: P1001"),
    ];
    for (const err of cases) {
      const result = classifySignupError(err);
      expect(result.code, err.message).toBe("service-unavailable");
    }
  });

  it("falls back to unknown for arbitrary errors", () => {
    const result = classifySignupError(new Error("totally unrelated boom"));
    expect(result.code).toBe("unknown");
  });

  it("falls back to unknown for non-Error inputs", () => {
    expect(classifySignupError("string-thrown").code).toBe("unknown");
    expect(classifySignupError(null).code).toBe("unknown");
    expect(classifySignupError(undefined).code).toBe("unknown");
  });
});

describe("SIGNUP_ERROR_MESSAGES coverage", () => {
  it("has a human message for every declared code", () => {
    for (const code of SIGNUP_ERROR_CODES) {
      expect(SIGNUP_ERROR_MESSAGES[code], code).toBeTruthy();
    }
  });
});
