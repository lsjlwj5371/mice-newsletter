import { getGmailClient, type SendResult } from "./client";

export interface SendEmailInput {
  to: string;
  toName?: string | null;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  /** Human-facing URL that unsubscribes this specific recipient (shown on the
   *  user's "Unsubscribe" landing page on GET). */
  unsubscribeUrl: string;
  /** Machine-facing URL that accepts a POST from Gmail/Apple Mail's
   *  List-Unsubscribe=One-Click button, per RFC 8058. */
  unsubscribePostUrl: string;
  /** Stable Message-Id to use for bounce correlation later. */
  messageIdPrefix?: string;
}

/**
 * Build a standards-compliant RFC 5322 email and submit it via the
 * Gmail API. Includes:
 *   - UTF-8 Korean-safe headers (RFC 2047 encoding)
 *   - List-Unsubscribe header (RFC 2369)
 *   - List-Unsubscribe-Post: List-Unsubscribe=One-Click (RFC 8058)
 *     → shows a native "Unsubscribe" button in Gmail's UI
 *   - Custom Message-Id so bounce emails can be matched back later
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const gmail = getGmailClient();

  const messageId = `<${input.messageIdPrefix ?? "nl"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}@${hostFromEmail(input.fromEmail)}>`;

  const toHeader = input.toName
    ? `${encodeRFC2047(input.toName)} <${input.to}>`
    : input.to;
  const fromHeader = `${encodeRFC2047(input.fromName)} <${input.fromEmail}>`;

  const rawMime = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeRFC2047(input.subject)}`,
    `Message-Id: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `List-Unsubscribe: <${input.unsubscribePostUrl}>, <${input.unsubscribeUrl}>, <mailto:unsubscribe@${hostFromEmail(
      input.fromEmail
    )}?subject=unsubscribe>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
    "",
    Buffer.from(input.html, "utf8").toString("base64"),
  ].join("\r\n");

  const encoded = Buffer.from(rawMime, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  return {
    messageId: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
}

/**
 * Encode a string as RFC 2047 when it contains non-ASCII, so Korean
 * Subject / From names show correctly in every mail client.
 */
function encodeRFC2047(s: string): string {
  if (!/[^\x00-\x7F]/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function hostFromEmail(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? "localhost" : email.slice(at + 1);
}
