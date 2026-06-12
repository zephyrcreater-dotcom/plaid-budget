import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PLAID_SESSION_COOKIE = 'plaid_session';

function getCookieSecret() {
  const plaidEnv = (process.env.PLAID_ENV || 'sandbox').toLowerCase();

  if (plaidEnv === 'sandbox') {
    return process.env.PLAID_SECRET_SANDBOX || process.env.PLAID_SECRET || '';
  }

  return process.env.PLAID_SECRET || process.env.PLAID_SECRET_SANDBOX || '';
}

function getEncryptionKey() {
  return createHash('sha256').update(getCookieSecret()).digest();
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());

  return cookies.reduce((accumulator, cookie) => {
    if (!cookie) {
      return accumulator;
    }

    const [name, ...valueParts] = cookie.split('=');
    accumulator[name] = decodeURIComponent(valueParts.join('='));
    return accumulator;
  }, {});
}

function encryptSessionData(sessionData) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const serialized = JSON.stringify(sessionData);
  const encrypted = Buffer.concat([
    cipher.update(serialized, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptSessionData(encryptedSessionData) {
  if (!encryptedSessionData) {
    return null;
  }

  const payload = Buffer.from(encryptedSessionData, 'base64');
  const iv = payload.slice(0, 12);
  const authTag = payload.slice(12, 28);
  const encrypted = payload.slice(28);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(decrypted);
}

export function setPlaidSessionCookie(res, sessionData) {
  const isProduction = process.env.NODE_ENV === 'production';
  const encryptedSessionData = encryptSessionData(sessionData);
  const cookie = [
    `${PLAID_SESSION_COOKIE}=${encodeURIComponent(encryptedSessionData)}`,
    'Path=/',
    'HttpOnly',
    isProduction ? 'SameSite=None' : 'SameSite=Lax',
    isProduction ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}

export function getPlaidSessionFromCookie(req) {
  const cookies = parseCookies(req);
  const encryptedSessionData = cookies[PLAID_SESSION_COOKIE];

  if (!encryptedSessionData) {
    return null;
  }

  try {
    return decryptSessionData(encryptedSessionData);
  } catch (error) {
    console.error(
      'plaid-session decrypt error:',
      error.message || error
    );
    return null;
  }
}

export function getPlaidConnectionsFromCookie(req) {
  const session = getPlaidSessionFromCookie(req);

  if (!session) {
    return [];
  }

  if (Array.isArray(session.connections)) {
    return session.connections;
  }

  if (session.access_token) {
    return [session];
  }

  return [];
}

export function buildPlaidSession(connections) {
  return {
    connections,
  };
}

export function sanitizePlaidConnections(connections) {
  return connections.map(({ access_token, ...connection }) => connection);
}
