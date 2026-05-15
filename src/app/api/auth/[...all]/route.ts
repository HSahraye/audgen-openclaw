import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/better-auth";

const { GET: rawGet, POST: rawPost } = toNextJsHandler(auth);

/**
 * SECURITY: strip session `token` fields from any JSON response returned by
 * better-auth's catch-all handler.
 *
 * Endpoints like `/api/auth/list-sessions` and `/api/auth/get-session`
 * default to returning the raw session token alongside metadata. That token
 * is the equivalent of the session cookie — handing it back to JS turns any
 * XSS into full session theft on every active device.
 *
 * The session itself is delivered through an HttpOnly `__Secure-*` cookie.
 * Client code never needs the token value; an opaque session `id` is enough
 * for "manage devices" + revoke flows.
 *
 * We deliberately do not touch sign-in/sign-up responses — they don't expose
 * the token in the body anyway (it's set via Set-Cookie). The filter is a
 * no-op for those.
 */
const SENSITIVE_KEYS = new Set(["token"]);

function scrubTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubTokens);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = scrubTokens(v);
    }
    return out;
  }
  return value;
}

async function scrubResponse(res: Response): Promise<Response> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return res;
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    return res;
  }
  const scrubbed = scrubTokens(body);
  const newHeaders = new Headers(res.headers);
  // Recalculate content-length to avoid mismatches downstream.
  newHeaders.delete("content-length");
  return new Response(JSON.stringify(scrubbed), {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

export async function GET(request: Request) {
  const res = await rawGet(request);
  return scrubResponse(res);
}

export async function POST(request: Request) {
  const res = await rawPost(request);
  return scrubResponse(res);
}
