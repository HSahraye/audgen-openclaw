import { getEnv } from "@/lib/env";

/**
 * Defensive guard for any URL string that will be interpolated into HTML.
 * Returns the URL only if it's a syntactically valid http(s) URL; any
 * other input becomes null so callers fall back to no link. Today the
 * only caller (automation/outreach) constructs unsubscribeUrl from
 * buildPublicUrl + encodeURIComponent — safe by construction — but this
 * helper prevents a future caller from accidentally introducing an XSS
 * via a workspace setting or external webhook payload.
 */
function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** HTML-escape a small string for safe interpolation into an attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unsubscribeBlock(unsubscribeUrl?: string): string {
  const safe = safeHttpUrl(unsubscribeUrl);
  if (!safe) return "";
  return `<br/><br/><a href="${escapeHtml(safe)}">Unsubscribe</a>`;
}

/**
 * Exposed for unit tests only. Not part of the public module API.
 */
export const _internalForTesting = {
  safeHttpUrl,
  escapeHtml,
  unsubscribeBlock,
};

export type EmailSendInput = {
  workspaceId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
};

export type EmailSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
};

export async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const env = getEnv();
  const provider = env.RESEND_API_KEY ? "resend" : env.POSTMARK_API_KEY ? "postmark" : "noop";
  if (provider === "noop") {
    return { ok: true, provider: "noop", providerMessageId: `noop-${Date.now()}` };
  }

  if (provider === "resend") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL || "noreply@example.com",
          to: [input.to],
          subject: input.subject,
          html: `${input.html}${unsubscribeBlock(input.unsubscribeUrl)}`,
          text: input.text,
          tags: [{ name: "workspace_id", value: input.workspaceId }],
        }),
      });
      if (!response.ok) {
        return { ok: false, provider, error: `Resend status ${response.status}` };
      }
      const payload = (await response.json()) as { id?: string };
      return { ok: true, provider, providerMessageId: payload.id };
    } catch (error) {
      return { ok: false, provider, error: error instanceof Error ? error.message : "Email send failed." };
    }
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_API_KEY || "",
      },
      body: JSON.stringify({
        From: env.POSTMARK_FROM_EMAIL || "noreply@example.com",
        To: input.to,
        Subject: input.subject,
        HtmlBody: `${input.html}${unsubscribeBlock(input.unsubscribeUrl)}`,
        TextBody: input.text,
      }),
    });
    if (!response.ok) return { ok: false, provider, error: `Postmark status ${response.status}` };
    const payload = (await response.json()) as { MessageID?: string };
    return { ok: true, provider, providerMessageId: payload.MessageID };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
