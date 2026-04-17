import crypto from "node:crypto";

/**
 * Form access tokens. Payload: `fV1:{formId}`.
 *
 * Signed so admins can share a single public URL and the server can
 * verify it without a DB lookup per click. The token itself doesn't
 * authorize anything beyond "this form exists and was shared" — we
 * still re-check form.is_open + form.closed_at on submit.
 */

const TOKEN_VERSION = "fV1";

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

export function signFormToken(formId: string): string {
  const payload = `${TOKEN_VERSION}:${formId}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function verifyFormToken(token: string): { formId: string } | null {
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
    const [version, formId] = payload.split(":");
    if (version !== TOKEN_VERSION || !formId) return null;
    return { formId };
  } catch {
    return null;
  }
}
