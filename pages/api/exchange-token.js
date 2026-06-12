import nextConnect from 'next-connect';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import {
  buildPlaidSession,
  getPlaidConnectionsFromCookie,
  sanitizePlaidConnections,
  setPlaidSessionCookie,
} from '../../lib/plaid-session';

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
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accountsResponse = await plaidClient.accountsGet({
      access_token: response.data.access_token,
    });
    const existingConnections = getPlaidConnectionsFromCookie(req);
    const nextConnection = {
      access_token: response.data.access_token,
      item_id: response.data.item_id,
      institution_name: metadata?.institution?.name || 'Connected account',
      accounts: accountsResponse.data.accounts.map((account) => ({
        id: account.account_id,
        name: account.name,
        mask: account.mask,
        subtype: account.subtype,
        type: account.type,
      })),
    };
    const nextConnections = [
      ...existingConnections.filter(
        (connection) => connection.item_id !== nextConnection.item_id
      ),
      nextConnection,
    ];

    setPlaidSessionCookie(res, buildPlaidSession(nextConnections));

    return res.json({
      ok: true,
      message: 'Exchanged public token.',
      item_id: response.data.item_id,
      connections: sanitizePlaidConnections(nextConnections),
    });
  } catch (error) {
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
