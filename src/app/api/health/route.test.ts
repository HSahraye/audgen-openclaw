import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET, HEAD } from "./route";

const SAVED = {
  COMMIT_REF: process.env.COMMIT_REF,
  GITHUB_SHA: process.env.GITHUB_SHA,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  NETLIFY_COMMIT_REF: process.env.NETLIFY_COMMIT_REF,
};

beforeEach(() => {
  delete process.env.COMMIT_REF;
  delete process.env.GITHUB_SHA;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  delete process.env.NETLIFY_COMMIT_REF;
});

afterEach(() => {
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("GET /api/health", () => {
  it("returns 200 with the expected JSON shape", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("auditgen");
    expect(typeof body.ts).toBe("string");
    expect(() => new Date(body.ts).toISOString()).not.toThrow();
    expect(body.commit).toBeNull();
  });

  it("sets a no-store cache header so monitors poll fresh data", () => {
    const res = GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("surfaces the deploy commit when COMMIT_REF is set (truncated to 12 chars)", async () => {
    process.env.COMMIT_REF = "abcdef0123456789abcdef0123456789abcdef01";
    const res = GET();
    const body = await res.json();
    expect(body.commit).toBe("abcdef012345");
  });

  it("prefers COMMIT_REF over GITHUB_SHA when both are set", async () => {
    process.env.COMMIT_REF = "aaaaaaaaaaaa1";
    process.env.GITHUB_SHA = "bbbbbbbbbbbb2";
    const res = GET();
    const body = await res.json();
    expect(body.commit).toBe("aaaaaaaaaaaa");
  });

  it("falls back to NETLIFY_COMMIT_REF when nothing more specific is set", async () => {
    process.env.NETLIFY_COMMIT_REF = "netlify-commit-abc";
    const res = GET();
    const body = await res.json();
    expect(body.commit).toBe("netlify-comm");
  });
});

describe("HEAD /api/health", () => {
  it("returns 200 with no body and a no-store cache header", () => {
    const res = HEAD();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});
