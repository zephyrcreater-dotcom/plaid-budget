import nextConnect from 'next-connect';
import { getUserFromRequest, respondUnauthorized } from '../../lib/auth';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import { ensureSupabaseAdminEnv, supabaseAdmin } from '../../lib/supabaseAdmin';

const handler = nextConnect();

handler.post(async (req, res) => {
  console.log('exchange-token body:', req.body);
  const { public_token, metadata } = req.body;

  if (!public_token) {
    return res.status(400).json({
      ok: false,
      message: 'Missing public_token.',
    });
  }

  try {
    const user = await getUserFromRequest(req);
    ensureSupabaseAdminEnv();
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accountsResponse = await plaidClient.accountsGet({
      access_token: response.data.access_token,
    });
    const plaidAccounts = accountsResponse.data.accounts || [];
    const { data: existingAccounts, error: existingAccountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, plaid_account_id')
      .eq('user_id', DEFAULT_USER_ID)
      .in('plaid_account_id', plaidAccounts.map((account) => account.account_id));

    if (existingAccountsError) {
      throw existingAccountsError;
    }

    const existingAccountsByPlaidId = (existingAccounts || []).reduce((accumulator, account) => {
      accumulator[account.plaid_account_id] = account;
      return accumulator;
    }, {});
    const savedRows = [];

    for (const account of plaidAccounts) {
      const payload = {
        user_id: user.id,
        institution_name: metadata?.institution?.name || 'Connected account',
        institution_id: metadata?.institution?.institution_id || null,
        access_token: response.data.access_token,
        item_id: response.data.item_id,
        account_type: account.type || null,
        account_subtype: account.subtype || null,
        account_name: account.name || null,
        mask: account.mask || null,
        plaid_account_id: account.account_id,
        current_balance: account.balances?.current ?? null,
        available_balance: account.balances?.available ?? null,
      };

      const existingAccount = existingAccountsByPlaidId[account.account_id];
      const query = existingAccount
        ? supabaseAdmin.from('accounts').update(payload).eq('id', existingAccount.id).select('id, user_id, institution_name, institution_id, item_id, account_type, account_subtype, account_name, mask, plaid_account_id, current_balance, available_balance, created_at, last_synced_at')
        : supabaseAdmin.from('accounts').insert(payload).select('id, user_id, institution_name, institution_id, item_id, account_type, account_subtype, account_name, mask, plaid_account_id, current_balance, available_balance, created_at, last_synced_at');
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data[0]) {
        savedRows.push(data[0]);
      }
    }

    return res.json({
      ok: true,
      message: 'Exchanged public token.',
      item_id: response.data.item_id,
      accounts: savedRows,
    });
  } catch (error) {
    if (error.statusCode === 401) {
      return respondUnauthorized(res);
    }
    console.error(
      'exchange-token error:',
      error.response?.data || error.message || error
    );
    return res.status(500).json(getPlaidError(error));
  }
});

export default handler;

export const config = {
  api: {
    bodyParser: true,
  },
};
