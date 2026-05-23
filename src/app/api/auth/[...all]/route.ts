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
  let originalText: string;
  try {
    originalText = await res.clone().text();
  } catch {
    return res;
  }
  // Fast path: if the response body doesn't contain a "token" field there is
  // nothing for scrubTokens to remove. Returning the original response object
  // preserves Set-Cookie semantics 1:1 (no header re-wrap), which is critical
  // for the OAuth state / PKCE / session cookies that Better Auth sets on
  // /sign-in/social and /callback/:provider. A previous version unconditionally
  // re-wrapped via `new Headers(res.headers)`, which on some serverless
  // runtimes silently collapses multiple Set-Cookie values into a single
  // comma-joined header — the browser then sees zero cookies and Google
  // sign-in bounces back to /login.
  if (!originalText.includes('"token"')) return res;
  let body: unknown;
  try {
    body = JSON.parse(originalText);
  } catch {
    return res;
  }
  const scrubbed = scrubTokens(body);
  // When we DO need to rewrap (get-session, list-sessions, idToken sign-in)
  // copy headers manually so every Set-Cookie value is preserved as its own
  // header entry. `new Headers(res.headers)` is unsafe here for the same
  // multi-Set-Cookie reason described above.
  const newHeaders = new Headers();
  for (const [k, v] of res.headers.entries()) {
    const kl = k.toLowerCase();
    if (kl === "set-cookie" || kl === "content-length") continue;
    newHeaders.append(k, v);
  }
  const setCookies =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const cookie of setCookies) newHeaders.append("set-cookie", cookie);
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
