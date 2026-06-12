import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export function ensureSupabaseAdminEnv() {
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_KEY');
  }
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseServiceKey || 'service_role_placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
