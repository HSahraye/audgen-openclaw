import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SUBMIT_LABEL_SIGNIN,
  SUBMIT_LABEL_SIGNUP,
  SUBMIT_LABEL_SIGNING_IN,
  SUBMIT_LABEL_CREATING,
} from "./submit-button";
import {
  GOOGLE_BUTTON_LABEL,
  GOOGLE_BOOTSTRAP_URL,
} from "./google-signin-button";

// ---------------------------------------------------------------------------
// Source text for static-analysis tests (client components use hooks — no
// DOM renderer available in this vitest environment).
// ---------------------------------------------------------------------------

const SUBMIT_SRC = readFileSync(path.resolve(__dirname, "submit-button.tsx"), "utf8");
const GOOGLE_SRC = readFileSync(path.resolve(__dirname, "google-signin-button.tsx"), "utf8");
const PAGE_SRC = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8");
const AUTH_SRC = readFileSync(
  path.resolve(__dirname, "../../lib/auth/better-auth.ts"),
  "utf8",
);
const BOOTSTRAP_SRC = readFileSync(
  path.resolve(__dirname, "../../app/api/auth/oauth-bootstrap/route.ts"),
  "utf8",
);

// ---------------------------------------------------------------------------
// Part 1 — Submit button loading state
// ---------------------------------------------------------------------------

describe("SubmitButton exported labels", () => {
  it("has distinct default and loading labels for sign-in", () => {
    expect(SUBMIT_LABEL_SIGNIN).toBe("Continue");
    expect(SUBMIT_LABEL_SIGNING_IN).toContain("Signing in");
    expect(SUBMIT_LABEL_SIGNING_IN).not.toBe(SUBMIT_LABEL_SIGNIN);
  });

  it("has distinct default and loading labels for sign-up", () => {
    expect(SUBMIT_LABEL_SIGNUP).toBe("Create workspace");
    expect(SUBMIT_LABEL_CREATING).toContain("Creating account");
    expect(SUBMIT_LABEL_CREATING).not.toBe(SUBMIT_LABEL_SIGNUP);
  });
});

describe("SubmitButton source invariants", () => {
  it("is a 'use client' module", () => {
    const first = SUBMIT_SRC.split("\n").find((l) => l.trim().length > 0 && !l.trim().startsWith("//"));
    expect(first?.trim()).toMatch(/^["']use client["'];?$/);
  });

  it("uses useFormStatus from react-dom", () => {
    expect(SUBMIT_SRC).toContain("useFormStatus");
    expect(SUBMIT_SRC).toContain("react-dom");
  });

  it("renders a Loader2 spinner (matches project spinner pattern)", () => {
    expect(SUBMIT_SRC).toMatch(/Loader2\s+className=["'][^"']*animate-spin/);
  });

  it("disables the button when pending (prevents double-submit)", () => {
    expect(SUBMIT_SRC).toContain("disabled={pending}");
  });

  it("sets aria-busy when pending (accessibility)", () => {
    expect(SUBMIT_SRC).toContain("aria-busy={pending}");
  });

  it("shows the loading label when pending (sign-in branch)", () => {
    expect(SUBMIT_SRC).toContain("SUBMIT_LABEL_SIGNING_IN");
  });

  it("shows the loading label when pending (sign-up branch)", () => {
    expect(SUBMIT_SRC).toContain("SUBMIT_LABEL_CREATING");
  });
});

describe("page.tsx wires SubmitButton", () => {
  it("imports SubmitButton", () => {
    expect(PAGE_SRC).toContain("SubmitButton");
  });

  it("passes isSignup prop to SubmitButton", () => {
    expect(PAGE_SRC).toContain("<SubmitButton isSignup={isSignup}");
  });
});

// ---------------------------------------------------------------------------
// Part 2 — Google sign-in button
// ---------------------------------------------------------------------------

describe("GOOGLE_BUTTON_LABEL / GOOGLE_BOOTSTRAP_URL constants", () => {
  it("label is non-empty and mentions Google", () => {
    expect(GOOGLE_BUTTON_LABEL.length).toBeGreaterThan(5);
    expect(GOOGLE_BUTTON_LABEL.toLowerCase()).toContain("google");
  });

  it("bootstrap URL is the correct OAuth callback route", () => {
    expect(GOOGLE_BOOTSTRAP_URL).toBe("/api/auth/oauth-bootstrap");
  });
});

describe("GoogleSignInButton source invariants", () => {
  it("is a 'use client' module", () => {
    const first = GOOGLE_SRC.split("\n").find((l) => l.trim().length > 0 && !l.trim().startsWith("//"));
    expect(first?.trim()).toMatch(/^["']use client["'];?$/);
  });

  it("renders a Loader2 spinner when pending", () => {
    expect(GOOGLE_SRC).toMatch(/Loader2\s+className=["'][^"']*animate-spin/);
  });

  it("has the correct accessible aria-label", () => {
    expect(GOOGLE_SRC).toContain(`aria-label={GOOGLE_BUTTON_LABEL}`);
  });

  it("disables the button when pending", () => {
    expect(GOOGLE_SRC).toContain("disabled={pending}");
  });

  it("returns null when show=false (graceful degradation)", () => {
    expect(GOOGLE_SRC).toContain("if (!show) return null");
  });

  it("calls authClient.signIn.social with provider google", () => {
    expect(GOOGLE_SRC).toContain('provider: "google"');
    expect(GOOGLE_SRC).toContain("authClient.signIn.social");
  });

  it("uses GOOGLE_BOOTSTRAP_URL as the callbackURL", () => {
    expect(GOOGLE_SRC).toContain("callbackURL: GOOGLE_BOOTSTRAP_URL");
  });
});

describe("page.tsx wires GoogleSignInButton", () => {
  it("imports GoogleSignInButton", () => {
    expect(PAGE_SRC).toContain("GoogleSignInButton");
  });

  it("passes show={hasGoogleOAuth} — hides button when env var absent", () => {
    expect(PAGE_SRC).toContain("hasGoogleOAuth");
    expect(PAGE_SRC).toContain("show={hasGoogleOAuth}");
  });

  it("derives hasGoogleOAuth from GOOGLE_CLIENT_ID env var", () => {
    expect(PAGE_SRC).toContain("GOOGLE_CLIENT_ID");
  });

  it("renders an 'or' divider when Google OAuth is configured", () => {
    expect(PAGE_SRC).toContain(">or<");
    expect(PAGE_SRC).toContain("hasGoogleOAuth");
  });
});

// ---------------------------------------------------------------------------
// Part 2 — Better Auth config includes Google social provider
// ---------------------------------------------------------------------------

describe("Better Auth config — Google social provider", () => {
  it("reads clientId from process.env.GOOGLE_CLIENT_ID (never hardcoded)", () => {
    expect(AUTH_SRC).toContain("GOOGLE_CLIENT_ID");
    expect(AUTH_SRC).not.toMatch(/clientId:\s*["'][0-9a-zA-Z_-]{20,}/);
  });

  it("reads clientSecret from process.env.GOOGLE_CLIENT_SECRET (never hardcoded)", () => {
    expect(AUTH_SRC).toContain("GOOGLE_CLIENT_SECRET");
    expect(AUTH_SRC).not.toMatch(/clientSecret:\s*["'][^"']{10,}/);
  });

  it("passes socialProviders to betterAuth()", () => {
    expect(AUTH_SRC).toContain("socialProviders");
    expect(AUTH_SRC).toContain("google");
  });

  it("omits google provider gracefully when env vars are absent", () => {
    // The pattern must be conditional — not unconditional object literal.
    expect(AUTH_SRC).toMatch(/googleClientId\s*&&\s*googleClientSecret/);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — OAuth bootstrap route
// ---------------------------------------------------------------------------

describe("oauth-bootstrap route", () => {
  it("redirects to /login when no session", () => {
    expect(BOOTSTRAP_SRC).toContain('"/login"');
    expect(BOOTSTRAP_SRC).toContain("session?.user");
  });

  it("creates workspace + membership + workspaceSettings for new OAuth users", () => {
    expect(BOOTSTRAP_SRC).toContain("prisma.workspace.create");
    expect(BOOTSTRAP_SRC).toContain("prisma.membership.create");
    expect(BOOTSTRAP_SRC).toContain("prisma.workspaceSettings.create");
  });

  it("sets the active workspace cookie after bootstrap", () => {
    expect(BOOTSTRAP_SRC).toContain("pl_workspace");
    expect(BOOTSTRAP_SRC).toContain("cookieStore.set");
  });

  it("skips workspace creation for returning users (has existing membership)", () => {
    expect(BOOTSTRAP_SRC).toContain("existing");
    expect(BOOTSTRAP_SRC).toContain("prisma.membership.findFirst");
  });

  it("redirects to / on success", () => {
    expect(BOOTSTRAP_SRC).toContain('new URL("/", request.url)');
  });

  it("bootstraps with same default settings as email signup (brandName, tone, offer style)", () => {
    expect(BOOTSTRAP_SRC).toContain('"AuditGen"');
    expect(BOOTSTRAP_SRC).toContain('"consultative"');
    expect(BOOTSTRAP_SRC).toContain('"outcome-focused"');
  });
});
