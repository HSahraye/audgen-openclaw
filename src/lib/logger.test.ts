import { describe, it, expect } from "vitest";
import { redactForLogs } from "./logger";

describe("redactForLogs", () => {
  it("redacts top-level secret-looking keys regardless of casing", () => {
    const got = redactForLogs({
      password: "hunter2",
      apiKey: "abc123",
      API_KEY: "xyz",
      Secret: "shhh",
      keep: "ok",
    }) as Record<string, unknown>;
    expect(got.password).toBe("[REDACTED]");
    expect(got.apiKey).toBe("[REDACTED]");
    expect(got.API_KEY).toBe("[REDACTED]");
    expect(got.Secret).toBe("[REDACTED]");
    expect(got.keep).toBe("ok");
  });

  it("redacts nested secrets", () => {
    const got = redactForLogs({
      user: { id: "u1", email: "a@b.co" },
      config: {
        stripe_secret_key: "sk_live_AAAAAAAAAAAAAAAA",
        webhook_secret: "whsec_BBBBBBBBBBBBBBBB",
      },
    }) as Record<string, Record<string, unknown>>;
    expect(got.user.email).toBe("a@b.co");
    expect(got.config.stripe_secret_key).toBe("[REDACTED]");
    expect(got.config.webhook_secret).toBe("[REDACTED]");
  });

  it("redacts Stripe-shaped values found inside strings", () => {
    const got = redactForLogs({
      note: "Failed call with sk_live_abcdefghijklmnopqrstuvwx12345",
    }) as { note: string };
    expect(got.note).not.toContain("sk_live_abcdefghijklmnopqrstuvwx");
    expect(got.note).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens in free-form strings", () => {
    const got = redactForLogs({
      message: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
    }) as { message: string };
    expect(got.message).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(got.message).toContain("[REDACTED]");
  });

  it("redacts inside arrays", () => {
    const got = redactForLogs([
      { token: "abc", id: "1" },
      { token: "def", id: "2" },
    ]) as Array<Record<string, unknown>>;
    expect(got[0].token).toBe("[REDACTED]");
    expect(got[1].token).toBe("[REDACTED]");
    expect(got[0].id).toBe("1");
  });

  it("handles Error objects without leaking secrets in message/stack", () => {
    const err = new Error("Failed to call Stripe with key sk_live_abcdefghijklmnopqrstuvwxyz");
    const got = redactForLogs(err) as { name: string; message: string; stack?: string };
    expect(got.name).toBe("Error");
    expect(got.message).toContain("[REDACTED]");
    expect(got.message).not.toContain("sk_live_abcdef");
  });

  it("passes through primitives untouched", () => {
    expect(redactForLogs(42)).toBe(42);
    expect(redactForLogs(true)).toBe(true);
    expect(redactForLogs(null)).toBe(null);
    expect(redactForLogs(undefined)).toBe(undefined);
  });

  it("does not redact short non-sensitive strings that happen to contain digits", () => {
    const got = redactForLogs({ leadId: "lead_01HZX9", count: 5 }) as Record<string, unknown>;
    expect(got.leadId).toBe("lead_01HZX9");
    expect(got.count).toBe(5);
  });

  it("hits the depth limit cleanly without crashing", () => {
    type Nested = { next?: Nested; v: number };
    const root: Nested = { v: 0 };
    let cur: Nested = root;
    for (let i = 1; i < 20; i += 1) {
      cur.next = { v: i };
      cur = cur.next;
    }
    const out = redactForLogs(root) as { v: number; next?: unknown };
    expect(out.v).toBe(0);
    // somewhere down the chain, we should see the depth marker
    let asAny: unknown = out;
    let sawLimit = false;
    for (let i = 0; i < 25; i += 1) {
      if (asAny === "[depth limit]") {
        sawLimit = true;
        break;
      }
      if (asAny && typeof asAny === "object" && "next" in asAny) {
        asAny = (asAny as { next: unknown }).next;
      } else {
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });
});
