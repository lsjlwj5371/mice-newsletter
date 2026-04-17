import { google, type gmail_v1 } from "googleapis";

let _client: gmail_v1.Gmail | null = null;

/**
 * Gmail API client authenticated with the OAuth2 refresh token stored
 * in env. The googleapis library auto-refreshes access tokens, so a
 * single refresh token lasts indefinitely (subject to Google's own
 * rotation policies).
 */
export function getGmailClient(): gmail_v1.Gmail {
  if (_client) return _client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail env not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)"
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  _client = google.gmail({ version: "v1", auth: oauth2 });
  return _client;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}
