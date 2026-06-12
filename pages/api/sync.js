import nextConnect from 'next-connect';
import { DEFAULT_USER_ID, detectIncome, detectTransfer, mapPlaidCategoryToCustomCategory } from '../../lib/categories';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import { ensureSupabaseAdminEnv, supabaseAdmin } from '../../lib/supabaseAdmin';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function uniqueById(rows) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.id, row);
  });
  return Array.from(map.values());
}

async function upsertTransactionsForItem(accounts, plaidAccountsById, accessToken) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const transactionsResponse = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: formatDate(thirtyDaysAgo),
    end_date: formatDate(today),
    options: {
      count: 500,
      offset: 0,
    },
  });

  const transactions = transactionsResponse.data.transactions || [];
  const rows = transactions
    .map((transaction) => {
      const account = accounts.find(
        (item) => item.plaid_account_id === transaction.account_id
      );

      if (!account) {
        return null;
      }

      const plaidAccount = plaidAccountsById[transaction.account_id] || account;
      const isTransfer = detectTransfer(transaction, plaidAccount);
      const isIncome = !isTransfer && detectIncome(transaction, plaidAccount);
      const category = isTransfer
        ? 'Transfers/Payments'
        : isIncome
          ? 'Income'
          : mapPlaidCategoryToCustomCategory(transaction);

      return {
        id: transaction.transaction_id,
        account_id: account.id,
        date: transaction.date,
        name: transaction.name,
        amount: transaction.amount,
        category,
        plaid_category: transaction.category || [],
        is_transfer: isTransfer,
        is_income: isIncome,
        pending: transaction.pending,
        created_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      insertedOrUpdated: 0,
    };
  }

  const { error } = await supabaseAdmin
    .from('transactions')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  return {
    insertedOrUpdated: rows.length,
  };
}

async function updateAccountBalances(accounts, plaidAccountsById) {
  const syncTime = new Date().toISOString();

  await Promise.all(
    accounts.map(async (account) => {
      const plaidAccount = plaidAccountsById[account.plaid_account_id];

      if (!plaidAccount) {
        return;
      }

      const { error } = await supabaseAdmin
        .from('accounts')
        .update({
          current_balance: plaidAccount.balances?.current ?? null,
          available_balance: plaidAccount.balances?.available ?? null,
          last_synced_at: syncTime,
        })
        .eq('id', account.id);

      if (error) {
        throw error;
      }
    })
  );
}

const handler = nextConnect();

async function handleSync(_req, res) {
  try {
    ensureSupabaseAdminEnv();
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('user_id', DEFAULT_USER_ID);

    if (accountsError) {
      throw accountsError;
    }

    const safeAccounts = accounts || [];

    if (safeAccounts.length === 0) {
      return res.json({
        ok: true,
        accounts_synced: 0,
        transactions_upserted: 0,
      });
    }

    const itemsByKey = safeAccounts.reduce((accumulator, account) => {
      const key = `${account.item_id}:${account.access_token}`;

      if (!accumulator[key]) {
        accumulator[key] = [];
      }

      accumulator[key].push(account);
      return accumulator;
    }, {});

    let transactionsUpserted = 0;
    let syncedAccountsCount = 0;

    for (const itemAccounts of Object.values(itemsByKey)) {
      const accessToken = itemAccounts[0].access_token;
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });
      const plaidAccounts = accountsResponse.data.accounts || [];
      const plaidAccountsById = plaidAccounts.reduce((accumulator, account) => {
        accumulator[account.account_id] = account;
        return accumulator;
      }, {});

      const syncResult = await upsertTransactionsForItem(
        itemAccounts,
        plaidAccountsById,
        accessToken
      );

      await updateAccountBalances(itemAccounts, plaidAccountsById);

      transactionsUpserted += syncResult.insertedOrUpdated;
      syncedAccountsCount += itemAccounts.length;
    }

    return res.json({
      ok: true,
      accounts_synced: syncedAccountsCount,
      transactions_upserted: transactionsUpserted,
    });
  } catch (error) {
    console.error('sync error:', error);
    return res.status(500).json(getPlaidError(error));
  }
}

handler.get(handleSync);
handler.post(handleSync);

export default handler;
