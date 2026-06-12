import { ensureSupabaseAdminEnv, supabaseAdmin } from './supabaseAdmin';

function unauthorizedError() {
  const error: any = new Error('Unauthorized');
  error.statusCode = 401;
  return error;
}

export async function getUserFromRequest(req: any) {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw unauthorizedError();
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();

  if (!accessToken) {
    throw unauthorizedError();
  }

  ensureSupabaseAdminEnv();

  const { user, error } = await supabaseAdmin.auth.api.getUser(accessToken);

  if (error || !user) {
    throw unauthorizedError();
  }

  return user;
}

export function respondUnauthorized(res: any) {
  return res.status(401).json({
    ok: false,
    error: 'Unauthorized',
  });
}
