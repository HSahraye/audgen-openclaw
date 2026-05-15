import crypto from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted prisma mocks so the route module sees them at import time.
const mocks = vi.hoisted(() => ({
  outboundFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
  communicationCreate: vi.fn(),
  outboundUpdateMany: vi.fn(),
  unsubUpsertEmail: vi.fn(),
  unsubUpsertPhone: vi.fn(),
  triggerWorkflows: vi.fn(),
  assertApiSessionWorkspace: vi.fn(),
  isAuthEnabled: vi.fn(),
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: {
      findUnique: mocks.outboundFindUnique,
      updateMany: mocks.outboundUpdateMany,
    },
    lead: { findFirst: mocks.leadFindFirst },
    communicationEvent: { create: mocks.communicationCreate },
    unsubscribedContact: {
      upsert: (...args: unknown[]) => {
        const arg = args[0] as { where: Record<string, unknown> };
        if ("workspaceId_email" in arg.where) return mocks.unsubUpsertEmail(...args);
        return mocks.unsubUpsertPhone(...args);
      },
    },
  },
}));

vi.mock("@/lib/automation/workflows", () => ({
  triggerWorkflows: mocks.triggerWorkflows,
}));
vi.mock("@/lib/authz", () => ({
  assertApiSessionWorkspace: mocks.assertApiSessionWorkspace,
}));
vi.mock("@/lib/env", () => ({
  isAuthEnabled: mocks.isAuthEnabled,
  getEnv: () => ({ COMMUNICATION_WEBHOOK_SECRET: "test-secret" }),
}));
vi.mock("@/lib/request-security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/request-security")>();
  return {
    ...actual,
    enforceRateLimit: mocks.enforceRateLimit,
    verifyHmacSignature: actual.verifyHmacSignature,
  };
});

// next/headers must be mock-controllable per-test.
const mockHeaders = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({
    get: (k: string) => mockHeaders.get(k.toLowerCase()) ?? null,
  }),
}));

import { POST } from "./route";

function sign(rawBody: string, ts: string, secret = "test-secret") {
  return crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
}

function request(body: unknown, headersInit: Record<string, string> = {}) {
  mockHeaders.clear();
  for (const [k, v] of Object.entries(headersInit)) mockHeaders.set(k.toLowerCase(), v);
  return new Request("http://localhost/api/communication/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headersInit },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  });
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.communicationCreate.mockResolvedValue({ id: "evt_1" });
  mocks.outboundUpdateMany.mockResolvedValue({ count: 1 });
  mocks.unsubUpsertEmail.mockResolvedValue({});
  mocks.triggerWorkflows.mockResolvedValue(undefined);
  mockHeaders.clear();
});

describe("POST /api/communication/events", () => {
  it("rejects unauthorized callers (no signature, no session)", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: "lead_1",
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue(null);
    const res = await POST(request({
      outboundMessageId: "om_1",
      eventType: "open",
    }));
    expect(res.status).toBe(404);
    expect(mocks.communicationCreate).not.toHaveBeenCalled();
  });

  it("ignores attacker-injected workspaceId in body (not in schema anymore)", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: "lead_1",
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const body = { outboundMessageId: "om_1", eventType: "open", workspaceId: "ws_attacker" };
    const raw = JSON.stringify(body);
    const sig = sign(raw, ts);
    // Build the Request manually so the raw body matches what we signed.
    mockHeaders.clear();
    mockHeaders.set("x-presencelabs-ts", ts);
    mockHeaders.set("x-presencelabs-signature", sig);
    const req = new Request("http://localhost/api/communication/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-presencelabs-ts": ts,
        "x-presencelabs-signature": sig,
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.communicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_real" }),
      }),
    );
  });

  it("rejects HMAC with bad signature", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: null,
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue(null);
    const ts = String(Math.floor(Date.now() / 1000));
    const body = { outboundMessageId: "om_1", eventType: "click" };
    const raw = JSON.stringify(body);
    mockHeaders.clear();
    mockHeaders.set("x-presencelabs-ts", ts);
    mockHeaders.set("x-presencelabs-signature", "0".repeat(64));
    const req = new Request("http://localhost/api/communication/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-presencelabs-ts": ts,
        "x-presencelabs-signature": "0".repeat(64),
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("rejects HMAC with stale timestamp", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: null,
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue(null);
    const staleTs = String(Math.floor(Date.now() / 1000) - 10 * 60); // 10 min ago
    const body = { outboundMessageId: "om_1", eventType: "open" };
    const raw = JSON.stringify(body);
    const sig = sign(raw, staleTs);
    mockHeaders.clear();
    mockHeaders.set("x-presencelabs-ts", staleTs);
    mockHeaders.set("x-presencelabs-signature", sig);
    const req = new Request("http://localhost/api/communication/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-presencelabs-ts": staleTs,
        "x-presencelabs-signature": sig,
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("authenticated workspace member can write to their own workspace", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: "lead_1",
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue({
      workspaceId: "ws_real",
      userId: "u1",
      role: "owner",
      authProvider: "better-auth",
    });
    mocks.leadFindFirst.mockResolvedValue({ id: "lead_1" });
    const res = await POST(request({
      outboundMessageId: "om_1",
      leadId: "lead_1",
      eventType: "open",
    }));
    expect(res.status).toBe(200);
    expect(mocks.communicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_real", leadId: "lead_1" }),
      }),
    );
  });

  it("blocks an authenticated user from writing to another workspace via outboundMessageId", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_other",
      workspaceId: "ws_B",
      leadId: "lead_B",
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue({
      workspaceId: "ws_A",
      userId: "uA",
      role: "owner",
      authProvider: "better-auth",
    });
    const res = await POST(request({
      outboundMessageId: "om_other",
      eventType: "unsubscribe",
      metadata: { email: "victim@example.com" },
    }));
    expect(res.status).toBe(404);
    expect(mocks.communicationCreate).not.toHaveBeenCalled();
    expect(mocks.unsubUpsertEmail).not.toHaveBeenCalled();
  });

  it("nulls a leadId that does not belong to the resolved workspace", async () => {
    mocks.isAuthEnabled.mockReturnValue(true);
    mocks.outboundFindUnique.mockResolvedValue({
      id: "om_1",
      workspaceId: "ws_real",
      leadId: null,
    });
    mocks.assertApiSessionWorkspace.mockResolvedValue({
      workspaceId: "ws_real",
      userId: "u1",
      role: "owner",
      authProvider: "better-auth",
    });
    mocks.leadFindFirst.mockResolvedValue(null);
    const res = await POST(request({
      outboundMessageId: "om_1",
      leadId: "lead_in_other_workspace",
      eventType: "open",
    }));
    expect(res.status).toBe(200);
    expect(mocks.communicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: null }) }),
    );
  });
});
