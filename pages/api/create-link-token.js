import nextConnect from 'next-connect';
import { CountryCode, Products } from 'plaid';
import { plaidClient, getPlaidError } from '../../lib/plaid';

const handler = nextConnect();

handler.post(async (req, res) => {
  const plaidEnv = (process.env.PLAID_ENV || 'sandbox').toLowerCase();

  console.log('ENV CHECK:', {
    client_id: process.env.PLAID_CLIENT_ID ? 'set' : 'missing',
    secret: process.env.PLAID_SECRET ? 'set' : 'missing',
    env: plaidEnv,
  });

  try {
    const userId =
      req.body?.userId ||
      req.body?.userEmail ||
      `user-${Date.now()}`;

    const request = {
      client_name: 'Next.js Plaid Starter',
      country_codes: [CountryCode.Us],
      language: 'en',
      products: [Products.Auth, Products.Transactions],
      user: {
        client_user_id: String(userId),
      },
    };

    const response = await plaidClient.linkTokenCreate(request);

    res.json({
      ok: true,
      message: 'Created link token.',
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error) {
    console.error('Plaid error:', error.response?.data || error.message || error);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

export default handler;
