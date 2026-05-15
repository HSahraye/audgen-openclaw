import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks: better-auth session + env + next/headers + next/navigation + getCurrentSession
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/better-auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

const mockGetAdminEmails = vi.fn();
const mockIsAuthEnabled = vi.fn();
vi.mock("@/lib/env", () => ({
  getAdminEmails: () => mockGetAdminEmails(),
  isAuthEnabled: () => mockIsAuthEnabled(),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundError";
  }
}
class RedirectError extends Error {
  constructor(public to: string) {
    super("NEXT_REDIRECT");
    this.name = "RedirectError";
  }
}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

const mockGetCurrentSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentSession: () => mockGetCurrentSession(),
}));

import {
  requirePlatformAdmin,
  isCurrentUserPlatformAdmin,
  assertApiSessionWorkspace,
} from "@/lib/authz";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requirePlatformAdmin", () => {
  it("allows access when auth is disabled (dev convenience)", async () => {
    mockIsAuthEnabled.mockReturnValue(false);
    const result = await requirePlatformAdmin();
    expect(result.source).toBe("auth-disabled");
  });

  it("fails closed when ADMIN_EMAILS is empty even with a session", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue([]);
    mockGetSession.mockResolvedValue({
      user: { id: "u1", email: "anyone@example.com" },
    });
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a normal signed-in user not on the allowlist", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["staff@presencelabs.net"]);
    mockGetSession.mockResolvedValue({
      user: { id: "u1", email: "hamid@gmail.com" },
    });
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a missing session (unauthenticated)", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["staff@presencelabs.net"]);
    mockGetSession.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows when the better-auth user email is on the allowlist (case-insensitive)", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["staff@presencelabs.net"]);
    mockGetSession.mockResolvedValue({
      user: { id: "u1", email: "Staff@PresenceLabs.net" },
    });
    const result = await requirePlatformAdmin();
    expect(result.email).toBe("staff@presencelabs.net");
    expect(result.source).toBe("better-auth");
  });

  it("rejects legacy/pl_session callers (no better-auth user) even when allowlist is set", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["staff@presencelabs.net"]);
    // legacy session has no better-auth user
    mockGetSession.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("isCurrentUserPlatformAdmin", () => {
  it("returns true when auth is disabled", async () => {
    mockIsAuthEnabled.mockReturnValue(false);
    expect(await isCurrentUserPlatformAdmin()).toBe(true);
  });

  it("returns false when allowlist is empty", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue([]);
    expect(await isCurrentUserPlatformAdmin()).toBe(false);
  });

  it("returns true when current user email matches allowlist", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["a@b.co"]);
    mockGetSession.mockResolvedValue({ user: { id: "u", email: "a@b.co" } });
    expect(await isCurrentUserPlatformAdmin()).toBe(true);
  });
});

describe("assertApiSessionWorkspace", () => {
  it("returns null when there is no session", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetCurrentSession.mockResolvedValue(null);
    expect(await assertApiSessionWorkspace()).toBeNull();
  });

  it("returns the session when workspaceId is present", async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockGetCurrentSession.mockResolvedValue({
      workspaceId: "ws_1",
      userId: "u_1",
      role: "owner",
      authProvider: "better-auth",
    });
    const session = await assertApiSessionWorkspace();
    expect(session).toMatchObject({ workspaceId: "ws_1", userId: "u_1" });
  });
});
