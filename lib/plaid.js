import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

function getPlaidSecret() {
  if (PLAID_ENV === 'sandbox') {
    return process.env.PLAID_SECRET_SANDBOX;
  }

  return process.env.PLAID_SECRET;
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID || '',
      'PLAID-SECRET': getPlaidSecret() || '',
      'Plaid-Version': '2020-09-14',
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export function getPlaidError(error) {
  const plaidError = error?.response?.data;

  return {
    ok: false,
    message: plaidError?.error_message || error.message || 'Unexpected Plaid error.',
    error: plaidError || null,
  };
}
