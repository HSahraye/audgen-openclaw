import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Module-level env state; snapshot + restore around each test.
const SAVED = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  AUDIT_LINK_SECRET: process.env.AUDIT_LINK_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
};

import { getPublicBaseUrl, buildPublicUrl, buildShortAuditUrl } from "./url";

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.APP_URL;
  delete process.env.VERCEL_URL;
  // url.ts → audit-links → env.getEnv → zod expects DATABASE_URL + AUDIT_LINK_SECRET.
  // Provide stable test values so the indirect import doesn't blow up.
  process.env.DATABASE_URL =
    "postgresql://x:x@localhost:5432/x?schema=public";
  process.env.AUDIT_LINK_SECRET = "test-audit-secret-32-characters-long-x";
});

afterEach(() => {
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("getPublicBaseUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.APP_URL = "https://other.example.com";
    expect(getPublicBaseUrl()).toBe("https://app.example.com");
  });

  it("falls back to APP_URL when NEXT_PUBLIC_APP_URL is missing", () => {
    process.env.APP_URL = "https://app2.example.com";
    expect(getPublicBaseUrl()).toBe("https://app2.example.com");
  });

  it("falls back to VERCEL_URL (with https:// prepended) when both APP urls missing", () => {
    process.env.VERCEL_URL = "preview-xyz.vercel.app";
    expect(getPublicBaseUrl()).toBe("https://preview-xyz.vercel.app");
  });

  it("falls back to http://localhost:3000 when nothing is set", () => {
    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });

  it("strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com///";
    expect(getPublicBaseUrl()).toBe("https://app.example.com");
  });

  it("prepends https:// for bare hosts (no scheme)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "bare-host.example.com";
    expect(getPublicBaseUrl()).toBe("https://bare-host.example.com");
  });

  it("preserves http:// scheme explicitly", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4000";
    expect(getPublicBaseUrl()).toBe("http://localhost:4000");
  });

  it("trims surrounding whitespace before parsing", () => {
    process.env.NEXT_PUBLIC_APP_URL = "  https://wrapped.example.com  ";
    expect(getPublicBaseUrl()).toBe("https://wrapped.example.com");
  });

  it("whitespace-only NEXT_PUBLIC_APP_URL falls through to localhost (NOT to APP_URL)", () => {
    // Pinning current behaviour: getPublicBaseUrl uses || (logical OR) on
    // the env values BEFORE trimming, so a whitespace-only string is
    // truthy and 'wins' the || chain even though normalizeBaseUrl trims
    // it back to empty. The 'if (explicit) return explicit' check then
    // sees the empty string and falls through to VERCEL_URL → localhost.
    // If a future refactor moves to ?? or trims first, APP_URL would
    // become the fallback — update both this test and the code together.
    process.env.NEXT_PUBLIC_APP_URL = "   ";
    process.env.APP_URL = "https://app3.example.com";
    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("buildPublicUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  it("joins base + leading-slash path with no double slash", () => {
    expect(buildPublicUrl("/foo/bar")).toBe("https://app.example.com/foo/bar");
  });

  it("prepends a leading slash when missing", () => {
    expect(buildPublicUrl("foo/bar")).toBe("https://app.example.com/foo/bar");
  });

  it("preserves a query string on the path", () => {
    expect(buildPublicUrl("/foo?bar=1")).toBe(
      "https://app.example.com/foo?bar=1",
    );
  });
});

describe("buildShortAuditUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  it("uses the short slug path when slug is present", () => {
    expect(
      buildShortAuditUrl({ id: "lead_long_id", shortSlug: "acme" }),
    ).toBe("https://app.example.com/a/acme");
  });

  it("falls back to the signed /audit/[id]?token=... path when slug is missing", () => {
    const url = buildShortAuditUrl({ id: "lead_xyz", shortSlug: null });
    expect(url.startsWith("https://app.example.com/audit/lead_xyz?token=")).toBe(true);
  });
});
