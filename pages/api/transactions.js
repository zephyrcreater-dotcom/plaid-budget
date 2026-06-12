import nextConnect from 'next-connect';
import { getUserFromRequest, respondUnauthorized } from '../../lib/auth';
import { ensureSupabaseAdminEnv, supabaseAdmin } from '../../lib/supabaseAdmin';

const handler = nextConnect();

handler.get(async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    ensureSupabaseAdminEnv();
    const { month, category, accountId, search } = req.query;
    let query = supabaseAdmin
      .from('transactions')
      .select('id, date, name, amount, category, plaid_category, is_transfer, is_income, pending, created_at, account_id, accounts!inner(id, institution_name, account_name, account_type, account_subtype, mask, plaid_account_id)')
      .eq('accounts.user_id', user.id)
      .order('date', { ascending: false });

    if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNumber] = month.split('-').map(Number);
      const startDate = `${month}-01`;
      const endDate = new Date(year, monthNumber, 0).toISOString().slice(0, 10);
      query = query.gte('date', startDate).lte('date', endDate);
    }

    if (typeof category === 'string' && category.length > 0) {
      query = query.eq('category', category);
    }

    if (typeof accountId === 'string' && accountId.length > 0) {
      query = query.eq('account_id', accountId);
    }

    if (typeof search === 'string' && search.length > 0) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      ok: true,
      transactions: data || [],
    });
  } catch (error) {
    if (error.statusCode === 401) {
      return respondUnauthorized(res);
    }
    console.error(
      'transactions error:',
      error.message || error
    );
    return res.status(500).json({
      ok: false,
      message: error.message || 'Unexpected transactions error.',
    });
  }
});

export default handler;
