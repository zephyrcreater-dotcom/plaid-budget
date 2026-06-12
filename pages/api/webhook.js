import nextConnect from 'next-connect';
import { markTransactionsReady } from '../../lib/plaid-webhook-state';

const READY_WEBHOOK_CODES = new Set([
  'TRANSACTIONS_SYNC',
  'INITIAL_UPDATE',
  'DEFAULT_UPDATE',
]);

const handler = nextConnect();

handler.post(async (req, res) => {
  console.log('plaid webhook body:', req.body);

  const { webhook_type, webhook_code, item_id } = req.body || {};

  if (webhook_type === 'TRANSACTIONS' && READY_WEBHOOK_CODES.has(webhook_code)) {
    markTransactionsReady(item_id);
    console.log('plaid webhook marked transactions ready:', {
      item_id,
      webhook_code,
    });
  }

  return res.json({
    ok: true,
    message: 'Webhook received.',
  });
});

export default handler;
