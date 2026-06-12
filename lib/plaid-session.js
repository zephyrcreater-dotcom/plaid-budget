import { randomBytes } from 'crypto';

const PLAID_SESSION_COOKIE = 'plaid_session_id';
const plaidSessions = new Map();

export function createPlaidSession(accessToken) {
  const sessionId = randomBytes(24).toString('hex');
  plaidSessions.set(sessionId, accessToken);
  return sessionId;
}

export function getPlaidSessionAccessToken(sessionId) {
  if (!sessionId) {
    return null;
  }

  return plaidSessions.get(sessionId) || null;
}

export function getPlaidSessionId(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${PLAID_SESSION_COOKIE}=`)
  );

  if (!sessionCookie) {
    return null;
  }

  return decodeURIComponent(sessionCookie.split('=').slice(1).join('='));
}

export function setPlaidSessionCookie(res, sessionId) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookie = [
    `${PLAID_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    isProduction ? 'SameSite=None' : 'SameSite=Lax',
    isProduction ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}
