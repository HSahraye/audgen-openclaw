import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, redactForLogs } from "./logger";

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

describe("logger LOG_LEVEL filter", () => {
  const SAVED = process.env.LOG_LEVEL;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    if (SAVED === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = SAVED;
  });

  it("defaults to info (emits all three levels)", () => {
    delete process.env.LOG_LEVEL;
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=warn suppresses info but emits warn + error", () => {
    process.env.LOG_LEVEL = "warn";
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=error only emits errors", () => {
    process.env.LOG_LEVEL = "error";
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=silent suppresses everything", () => {
    process.env.LOG_LEVEL = "silent";
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("LOG_LEVEL=off and LOG_LEVEL=none are aliases for silent", () => {
    process.env.LOG_LEVEL = "off";
    logger.error("e");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockClear();
    process.env.LOG_LEVEL = "none";
    logger.error("e");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("unrecognised LOG_LEVEL falls back to info default", () => {
    process.env.LOG_LEVEL = "verbose"; // not a supported value
    logger.info("i");
    logger.warn("w");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
