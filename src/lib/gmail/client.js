/**
 * Gmail OAuth + API client
 *
 * Privacy contract (enforced here):
 *   - We request gmail.readonly scope ONLY
 *   - We fetch thread metadata (headers only) — never message body
 *   - We extract: threadId, sender domain, message count
 *   - Subject is read for pattern detection then DISCARDED — never stored
 */

const OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// ── OAuth URLs ─────────────────────────────────────────────────

export function getOAuthUrl(userId) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force refresh_token on every auth
    state: userId,     // carry userId through callback
  });
  return `${OAUTH_BASE}?${params}`;
}

// ── Token exchange / refresh ───────────────────────────────────

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }
  return res.json();
  // Returns: { access_token, refresh_token, expires_in, scope, token_type }
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }
  return res.json();
  // Returns: { access_token, expires_in }
}

// ── Gmail API calls ────────────────────────────────────────────

// ATS domains that send application-related emails
const ATS_QUERY = [
  'from:greenhouse.io',
  'from:lever.co',
  'from:ashby.io',
  'from:myworkdayjobs.com',
  'from:taleo.net',
  'from:icims.com',
  'from:bamboohr.com',
  'from:smartrecruiters.com',
  'from:jobs-noreply.linkedin.com',
  'from:noreply.linkedin.com',
].join(' OR ');

/**
 * Returns recent ATS-related thread IDs (last 14 days).
 */
export async function getJobThreads(accessToken, maxResults = 50) {
  const query = `(${ATS_QUERY}) newer_than:14d`;
  const url = `${GMAIL_API}/threads?maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail threads.list failed: ${res.status}`);
  const data = await res.json();
  return data.threads || [];
}

/**
 * Returns thread metadata — headers only, no body.
 * Subject is returned for pattern detection only (not stored in DB).
 */
export async function getThreadMetadata(accessToken, threadId) {
  const url = `${GMAIL_API}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail threads.get failed: ${res.status}`);
  const data = await res.json();

  const messages = data.messages || [];
  if (!messages.length) return null;

  const firstMsg = messages[0];
  const headers = firstMsg?.payload?.headers || [];

  const from = headers.find((h) => h.name === 'From')?.value || '';
  const subject = headers.find((h) => h.name === 'Subject')?.value || '';

  // Extract only the domain — this is all we keep from "From"
  const domainMatch = from.match(/@([\w.-]+)/);
  const senderDomain = domainMatch ? domainMatch[1].toLowerCase() : '';

  return {
    threadId,
    senderDomain,
    subject,          // used for pattern detection only — caller must not store this
    messageCount: messages.length,
  };
}
