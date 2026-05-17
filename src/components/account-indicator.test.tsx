import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { signOutFromIndicator } from "./account-indicator-client";

// The render shape of the AccountIndicatorClient is asserted via static
// analysis on the source file. Function-invoking the component the way
// pipeline-funnel-tiles.test.tsx and prep-action-card.test.tsx do does
// not work here because the indicator is a *client* component with
// useRouter/useState/useEffect, and there is no React renderer in this
// vitest environment (test config is `environment: "node"`, no JSDOM).
//
// The signOutFromIndicator helper is exported separately for exactly
// this reason — its decision logic can be unit-tested without mounting
// the component, and that is what the operator most needs locked in
// (the canonical /api/auth/logout POST + the navigate-to-/login on
// success).

const CLIENT_SOURCE = readFileSync(
  path.resolve(__dirname, "account-indicator-client.tsx"),
  "utf8",
);

describe("AccountIndicatorClient template invariants (static)", () => {
  it("is a 'use client' module (must be — uses hooks)", () => {
    const firstStmt = CLIENT_SOURCE.split("\n").find(
      (line) => line.trim().length > 0 && !line.trim().startsWith("//"),
    );
    expect(firstStmt?.trim()).toMatch(/^["']use client["'];?$/);
  });

  it("renders the active workspace name placeholder", () => {
    expect(CLIENT_SOURCE).toContain("activeWorkspaceName");
  });

  it("renders the user-name / email placeholder for the trigger pill", () => {
    expect(CLIENT_SOURCE).toContain("displayName");
    expect(CLIENT_SOURCE).toContain("userEmail");
  });

  it("hides the pill from PDF / print exports (print:hidden)", () => {
    expect(CLIENT_SOURCE).toContain("print:hidden");
  });

  it("declares the dropdown trigger as a popup menu (a11y)", () => {
    expect(CLIENT_SOURCE).toContain('aria-haspopup="menu"');
  });

  it("uses the existing switchWorkspaceAction (no new helper)", () => {
    expect(CLIENT_SOURCE).toContain('from "@/app/actions/workspace"');
    expect(CLIENT_SOURCE).toContain("switchWorkspaceAction");
  });

  it("calls the canonical /api/auth/logout endpoint (NOT a hand-rolled cookie clear)", () => {
    expect(CLIENT_SOURCE).toContain('"/api/auth/logout"');
    expect(CLIENT_SOURCE).toMatch(/method:\s*"POST"/);
  });

  it("does NOT directly invoke authClient.signOut() — that would skip the legacy + workspace cookie cleanup that signOutEverywhere() performs", () => {
    expect(CLIENT_SOURCE).not.toContain("authClient.signOut");
    expect(CLIENT_SOURCE).not.toContain('from "better-auth/react"');
  });

  it("exposes test hooks for the e2e/unit overlap (data-testid attributes)", () => {
    expect(CLIENT_SOURCE).toContain('data-testid="account-indicator"');
    expect(CLIENT_SOURCE).toContain('data-testid="account-indicator-signout"');
    // The active-workspace marker is conditionally applied via a ternary,
    // so we look for the literal id string anywhere in the source.
    expect(CLIENT_SOURCE).toContain('"account-indicator-active-workspace"');
  });
});

describe("signOutFromIndicator", () => {
  it("POSTs to /api/auth/logout, then navigates to /login on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    const push = vi.fn();
    const refresh = vi.fn();
    const ok = await signOutFromIndicator({
      fetch: fetchMock as unknown as typeof fetch,
      push,
      refresh,
    });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(push).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("returns false and does NOT navigate when the logout endpoint returns non-ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const push = vi.fn();
    const refresh = vi.fn();
    const ok = await signOutFromIndicator({
      fetch: fetchMock as unknown as typeof fetch,
      push,
      refresh,
    });
    expect(ok).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns false on network error and does NOT navigate", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const push = vi.fn();
    const refresh = vi.fn();
    const ok = await signOutFromIndicator({
      fetch: fetchMock as unknown as typeof fetch,
      push,
      refresh,
    });
    expect(ok).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses POST verb (the canonical /api/auth/logout endpoint requires POST)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    await signOutFromIndicator({
      fetch: fetchMock as unknown as typeof fetch,
      push: () => {},
      refresh: () => {},
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
  });
});
