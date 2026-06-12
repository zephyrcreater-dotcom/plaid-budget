import nextConnect from 'next-connect';
import { DEFAULT_USER_ID } from '../../lib/categories';
import { ensureSupabaseAdminEnv, supabaseAdmin } from '../../lib/supabaseAdmin';

const handler = nextConnect();

handler.get(async (_req, res) => {
  ensureSupabaseAdminEnv();
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, user_id, institution_name, institution_id, item_id, account_type, account_subtype, account_name, mask, plaid_account_id, current_balance, available_balance, created_at, last_synced_at')
    .eq('user_id', DEFAULT_USER_ID)
    .order('institution_name', { ascending: true })
    .order('account_name', { ascending: true });

  if (error) {
    console.error('accounts error:', error);
    return res.status(500).json({
      ok: false,
      message: error.message,
    });
  }

  return res.json({
    ok: true,
    accounts: data || [],
  });
});

export default handler;
