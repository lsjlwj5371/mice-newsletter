import crypto from "node:crypto";

/**
 * Referral tokens identify who referred whom.
 *
 * Payload: `rV1:{referrerRecipientId}`
 * Signed with TOKEN_SECRET (HMAC-SHA256).
 *
 * Unlike unsubscribe tokens, these aren't tied to a specific send — a
 * referrer's link can be shared and reused by multiple people.
 */

const TOKEN_VERSION = "rV1";

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

export function signReferralToken(referrerRecipientId: string | null): string {
  // null referrer is allowed (admin-generated generic link)
  const payload = `${TOKEN_VERSION}:${referrerRecipientId ?? ""}`;
  const signature = sign(payload);
  return `${b64url(payload)}.${signature}`;
}

export function verifyReferralToken(token: string): {
  referrerRecipientId: string | null;
} | null {
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
    const [version, referrerId] = payload.split(":");
    if (version !== TOKEN_VERSION) return null;
    return { referrerRecipientId: referrerId || null };
  } catch {
    return null;
  }
}
