import nextConnect from 'next-connect';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import { getPlaidSessionAccessToken, getPlaidSessionId } from '../../lib/plaid-session';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const handler = nextConnect();

handler.post(async (req, res) => {
  const { access_token: requestAccessToken } = req.body;
  const sessionId = getPlaidSessionId(req);
  const access_token =
    requestAccessToken || getPlaidSessionAccessToken(sessionId);

  if (!access_token) {
    return res.status(400).json({
      ok: false,
      message: 'Missing access token or Plaid session.',
    });
  }

  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: formatDate(thirtyDaysAgo),
      end_date: formatDate(today),
      options: {
        count: 250,
        offset: 0,
      },
    });

    return res.json({
      ok: true,
      message: 'Fetched transactions.',
      accounts: response.data.accounts,
      item: response.data.item,
      request_id: response.data.request_id,
      total_transactions: response.data.total_transactions,
      transactions: response.data.transactions,
    });
  } catch (error) {
    return res.status(500).json(getPlaidError(error));
  }
});

export default handler;
