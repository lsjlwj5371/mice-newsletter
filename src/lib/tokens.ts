import crypto from "node:crypto";

/**
 * Stateless HMAC-signed tokens for unsubscribe / tracking links.
 *
 * Payload format: `{send_id}:{recipient_email}:{kind}`
 * Signed with HMAC-SHA256 using TOKEN_SECRET.
 *
 * URL-safe base64 for both payload + signature so the token fits in a
 * query string without any escaping issues.
 *
 * Why stateless? So we can embed the URL at send time without having
 * to pre-generate a DB row per token or hit the DB to look up validity
 * at click time. DB is consulted only to apply the effect of the click.
 */

const TOKEN_VERSION = "v1";
type TokenKind = "u" | "o" | "c"; // unsubscribe / open / click

function getSecret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("TOKEN_SECRET env var is missing or too short");
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function sign(payload: string): string {
  return b64url(
    crypto.createHmac("sha256", getSecret()).update(payload).digest()
  );
}

export interface TokenClaims {
  sendId: string;
  email: string;
  kind: TokenKind;
}

export function signToken(claims: TokenClaims): string {
  const payload = `${TOKEN_VERSION}:${claims.kind}:${claims.sendId}:${claims.email}`;
  const signature = sign(payload);
  return `${b64url(payload)}.${signature}`;
}

export function verifyToken(token: string): TokenClaims | null {
  try {
    const [encoded, providedSig] = token.split(".");
    if (!encoded || !providedSig) return null;
    const payload = fromB64url(encoded).toString("utf8");
    const expectedSig = sign(payload);
    if (
      !crypto.timingSafeEqual(
        Buffer.from(providedSig),
        Buffer.from(expectedSig)
      )
    ) {
      return null;
    }
    const parts = payload.split(":");
    if (parts.length < 4 || parts[0] !== TOKEN_VERSION) return null;
    const [, kind, sendId, ...emailParts] = parts;
    if (!["u", "o", "c"].includes(kind)) return null;
    return {
      kind: kind as TokenKind,
      sendId,
      email: emailParts.join(":"), // emails can't contain ':' but defensive join
    };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(sendId: string, email: string, appUrl: string): string {
  const token = signToken({ sendId, email, kind: "u" });
  return `${appUrl}/u/${token}`;
}
