import nextConnect from 'next-connect';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import {
  getPlaidConnectionsFromCookie,
  sanitizePlaidConnections,
} from '../../lib/plaid-session';
import { areTransactionsReady } from '../../lib/plaid-webhook-state';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProductNotReady(error) {
  return error?.response?.data?.error_code === 'PRODUCT_NOT_READY';
}

async function getTransactionsWithRetry(accessToken, retriesLeft = 2) {
  try {
    let cursor = null;
    let hasMore = true;
    const transactions = [];

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
        count: 100,
      });

      transactions.push(...response.data.added);
      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
    }

    return {
      pending: false,
      transactions,
      cursor,
    };
  } catch (error) {
    if (isProductNotReady(error) && retriesLeft > 0) {
      await delay(1000);
      return getTransactionsWithRetry(accessToken, retriesLeft - 1);
    }

    if (isProductNotReady(error)) {
      return {
        pending: true,
        message: 'Your transactions are being loaded, check back in a few minutes',
      };
    }

    throw error;
  }
}

function filterTransactionsToLastYear(transactions) {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const startDate = formatDate(oneYearAgo);
  const endDate = formatDate(today);

  return transactions.filter((transaction) => {
    return transaction.date >= startDate && transaction.date <= endDate;
  });
}

const handler = nextConnect();

handler.post(async (req, res) => {
  const { access_token: requestAccessToken } = req.body;
  const cookieConnections = getPlaidConnectionsFromCookie(req);
  const connections = requestAccessToken
    ? [
        {
          access_token: requestAccessToken,
          item_id: 'manual-access-token',
          institution_name: 'Connected account',
          accounts: [],
        },
      ]
    : cookieConnections;

  if (connections.length === 0) {
    return res.json({
      ok: true,
      message: 'Connect an account to load transactions.',
      transactions: [],
      connections: [],
      pending: false,
      last_updated: null,
    });
  }

  try {
    const syncResults = await Promise.all(
      connections.map(async (connection) => {
        const syncResult = await getTransactionsWithRetry(connection.access_token);

        if (syncResult.pending) {
          return {
            connection,
            pending: true,
            transactions: [],
          };
        }

        const transactions = filterTransactionsToLastYear(syncResult.transactions).map(
          (transaction) => ({
            ...transaction,
            institution_name: connection.institution_name,
            connection_item_id: connection.item_id,
          })
        );

        return {
          connection,
          pending: false,
          transactions,
          cursor: syncResult.cursor,
        };
      })
    );

    const allTransactions = syncResults.flatMap((result) => result.transactions);
    const pendingConnections = syncResults.filter((result) => result.pending);
    const lastUpdated = new Date().toISOString();

    return res.json({
      ok: true,
      pending: pendingConnections.length > 0,
      message:
        pendingConnections.length > 0
          ? 'Your transactions are being loaded, check back in a few minutes'
          : 'Fetched transactions.',
      total_transactions: allTransactions.length,
      transactions: allTransactions,
      transactions_ready: syncResults.some((result) =>
        areTransactionsReady(result.connection.item_id)
      ),
      connections: sanitizePlaidConnections(connections),
      pending_connections: pendingConnections.map((result) => ({
        item_id: result.connection.item_id,
        institution_name: result.connection.institution_name,
      })),
      last_updated: lastUpdated,
    });
  } catch (error) {
    console.error(
      'transactions error:',
      error.response?.data || error.message || error
    );
    return res.status(500).json(getPlaidError(error));
  }
});

export default handler;
