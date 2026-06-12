import nextConnect from 'next-connect';
import { plaidClient, getPlaidError } from '../../lib/plaid';
import { createPlaidSession, setPlaidSessionCookie } from '../../lib/plaid-session';

const handler = nextConnect();

handler.post(async (req, res) => {
  console.log('exchange-token body:', req.body);
  const { public_token } = req.body;

  if (!public_token) {
    return res.status(400).json({
      ok: false,
      message: 'Missing public_token.',
    });
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const sessionId = createPlaidSession(response.data.access_token);

    setPlaidSessionCookie(res, sessionId);

    return res.json({
      ok: true,
      message: 'Exchanged public token.',
      item_id: response.data.item_id,
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
