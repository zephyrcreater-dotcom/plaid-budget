import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PLAID_ACCESS_TOKEN_COOKIE = 'plaid_access_token';

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

function encryptAccessToken(accessToken) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(accessToken, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptAccessToken(encryptedAccessToken) {
  if (!encryptedAccessToken) {
    return null;
  }

  const payload = Buffer.from(encryptedAccessToken, 'base64');
  const iv = payload.slice(0, 12);
  const authTag = payload.slice(12, 28);
  const encrypted = payload.slice(28);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

export function setPlaidAccessTokenCookie(res, accessToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  const encryptedAccessToken = encryptAccessToken(accessToken);
  const cookie = [
    `${PLAID_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(encryptedAccessToken)}`,
    'Path=/',
    'HttpOnly',
    isProduction ? 'SameSite=None' : 'SameSite=Lax',
    isProduction ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookie);
}

export function getPlaidAccessTokenFromCookie(req) {
  const cookies = parseCookies(req);
  const encryptedAccessToken = cookies[PLAID_ACCESS_TOKEN_COOKIE];

  if (!encryptedAccessToken) {
    return null;
  }

  try {
    return decryptAccessToken(encryptedAccessToken);
  } catch (error) {
    console.error(
      'plaid-session decrypt error:',
      error.message || error
    );
    return null;
  }
}
