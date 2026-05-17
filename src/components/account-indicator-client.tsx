"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchWorkspaceAction } from "@/app/actions/workspace";

// Routes where the indicator MUST NOT render even if a session resolves.
// Production runs with APP_AUTH_ENABLED unset/false, which causes the
// server-side getCurrentSession() to return a synthetic admin session
// for every request — so the parent server component cannot rely on
// session presence alone to gate visibility on auth-entry pages.
const NEVER_RENDER_INDICATOR_PATHS = new Set([
  "/login",
  "/accept-invite",
  "/about",
]);

export type AccountIndicatorWorkspace = {
  workspaceId: string;
  workspaceName: string;
  role: string;
};

export type AccountIndicatorProps = {
  userEmail: string | null;
  userName: string | null;
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  workspaces: AccountIndicatorWorkspace[];
};

/**
 * Pure helper extracted so it can be unit-tested without mounting the
 * component. Calls the canonical /api/auth/logout endpoint (which is
 * already wired to signOutEverywhere() — clears all three cookies +
 * writes the auth audit log) and then navigates to /login.
 *
 * Returns true on success, false on failure so callers can render an
 * error state instead of silently falling back to the same logged-in
 * page.
 */
export async function signOutFromIndicator(deps: {
  fetch: typeof fetch;
  push: (href: string) => void;
  refresh: () => void;
}): Promise<boolean> {
  try {
    const res = await deps.fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  // Use both push + refresh: push does the navigation, refresh ensures
  // the new page sees the cleared session cookies on its server-render.
  deps.push("/login");
  deps.refresh();
  return true;
}

function avatarInitials(name: string | null, email: string | null): string {
  const base = (name ?? email ?? "U").trim();
  if (!base) return "U";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AccountIndicatorClient({
  userEmail,
  userName,
  activeWorkspaceId,
  activeWorkspaceName,
  workspaces,
}: AccountIndicatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSwitching, startSwitchTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown on outside click / Escape so it doesn't get
  // stuck open while the user navigates.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onSignOut = async () => {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    const ok = await signOutFromIndicator({
      fetch: window.fetch.bind(window),
      push: (href) => router.push(href),
      refresh: () => router.refresh(),
    });
    if (!ok) {
      setSignOutError("Sign-out failed. Please retry.");
      setSigningOut(false);
    }
    // On success the navigation away will unmount this component, so
    // we deliberately do not setSigningOut(false) on the happy path.
  };

  const onSwitchWorkspace = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    startSwitchTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      await switchWorkspaceAction(fd);
      setOpen(false);
      router.refresh();
    });
  };

  // Suppress on auth-entry / unauthenticated marketing pages even if a
  // synthetic session resolved server-side. Without this guard the pill
  // would appear on /login when APP_AUTH_ENABLED is unset and the
  // legacy auth fallback grants a virtual admin session.
  if (pathname && NEVER_RENDER_INDICATOR_PATHS.has(pathname)) {
    return null;
  }

  const initials = avatarInitials(userName, userEmail);
  const displayName = userName?.trim() || userEmail || "Signed in";

  return (
    <div
      ref={containerRef}
      className="fixed right-3 top-3 z-50 print:hidden"
      data-testid="account-indicator"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu — signed in as ${displayName}`}
        className="inline-flex max-w-[80vw] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-300"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black uppercase text-lime-300"
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-slate-900">{displayName}</span>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {activeWorkspaceName}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className={`ml-1 h-2 w-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Signed in
            </p>
            <p className="mt-0.5 truncate text-sm font-black text-slate-950" data-testid="account-indicator-name">
              {userName?.trim() || "—"}
            </p>
            <p className="truncate text-xs font-semibold text-slate-600" data-testid="account-indicator-email">
              {userEmail ?? "<no email on record>"}
            </p>
          </div>

          {workspaces.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </p>
              <ul className="grid gap-1">
                {workspaces.map((w) => {
                  const isActive = w.workspaceId === activeWorkspaceId;
                  return (
                    <li key={w.workspaceId}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        disabled={isSwitching}
                        onClick={() => onSwitchWorkspace(w.workspaceId)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-black transition ${
                          isActive
                            ? "bg-lime-100 text-lime-900"
                            : "text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        }`}
                      >
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate" data-testid={isActive ? "account-indicator-active-workspace" : undefined}>
                            {w.workspaceName}
                          </span>
                          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {w.role}
                          </span>
                        </span>
                        {isActive ? (
                          <svg viewBox="0 0 14 12" aria-hidden="true" className="h-3 w-3 shrink-0 text-lime-700">
                            <path
                              d="M1 6.5l4 4L13 1"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              disabled={signingOut}
              data-testid="account-indicator-signout"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
            {signOutError ? (
              <p
                role="alert"
                data-testid="account-indicator-signout-error"
                className="mt-2 text-[11px] font-bold text-rose-600"
              >
                {signOutError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
