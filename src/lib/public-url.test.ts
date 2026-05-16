import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientPublicBaseUrl, buildClientPublicUrl } from "./public-url";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

describe("getClientPublicBaseUrl", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    }
  });

  it("returns the explicit env var stripped of trailing slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com//";
    expect(getClientPublicBaseUrl()).toBe("https://app.example.com");
  });

  it("prepends https:// when the env var is bare host", () => {
    process.env.NEXT_PUBLIC_APP_URL = "app.example.com";
    expect(getClientPublicBaseUrl()).toBe("https://app.example.com");
  });

  it("respects http:// scheme when explicitly set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4000";
    expect(getClientPublicBaseUrl()).toBe("http://localhost:4000");
  });

  it("trims whitespace around the env var", () => {
    process.env.NEXT_PUBLIC_APP_URL = "   https://x.test   ";
    expect(getClientPublicBaseUrl()).toBe("https://x.test");
  });

  it("falls back to localhost when env var is missing and no window is present", () => {
    // vitest runs in node env, so window is undefined here
    expect(getClientPublicBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("buildClientPublicUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    }
  });

  it("joins base + path with a single slash", () => {
    expect(buildClientPublicUrl("/audit/lead_1")).toBe(
      "https://app.example.com/audit/lead_1",
    );
  });

  it("adds a leading slash when path is missing one", () => {
    expect(buildClientPublicUrl("audit/lead_1")).toBe(
      "https://app.example.com/audit/lead_1",
    );
  });

  it("preserves query strings on the path", () => {
    expect(buildClientPublicUrl("/audit/lead_1?token=abc")).toBe(
      "https://app.example.com/audit/lead_1?token=abc",
    );
  });
});
