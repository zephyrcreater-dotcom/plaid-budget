export const CATEGORY_NAMES = [
  'Food & Dining',
  'Golf & Sports',
  'Shopping',
  'Health & Fitness',
  'Church & Giving',
  'Subscriptions',
  'Home & Utilities',
  'Auto & Gas',
  'Travel',
  'Transfers/Payments',
  'Income',
];

function getTransactionText(transaction: any) {
  const rawCategory = Array.isArray(transaction.category)
    ? transaction.category.join(' ')
    : '';
  const financeCategory = transaction.personal_finance_category?.primary || '';

  return [
    transaction.name,
    transaction.merchant_name,
    rawCategory,
    financeCategory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function detectTransfer(transaction: any, account: any): boolean {
  const text = getTransactionText(transaction);
  const amount = Number(transaction.amount || 0);
  const accountType = String(account?.account_type || account?.type || '').toLowerCase();
  const accountSubtype = String(account?.account_subtype || account?.subtype || '').toLowerCase();
  const isCredit = accountType === 'credit';
  const isDepository = accountType === 'depository';
  const mentionsTransfer = /(transfer|payment|autopay|ach|online payment|credit card payment|card payment)/.test(text);

  if (isCredit && amount < 0 && mentionsTransfer) {
    return true;
  }

  if (isDepository && amount > 0 && mentionsTransfer) {
    return true;
  }

  if ((accountSubtype === 'checking' || accountSubtype === 'savings') && amount > 0 && mentionsTransfer) {
    return true;
  }

  return false;
}

export function detectIncome(transaction: any, account: any): boolean {
  const text = getTransactionText(transaction);
  const amount = Number(transaction.amount || 0);
  const accountType = String(account?.account_type || account?.type || '').toLowerCase();

  if (accountType !== 'depository' || amount >= 0) {
    return false;
  }

  if (detectTransfer(transaction, account)) {
    return false;
  }

  return /(payroll|income|deposit|direct deposit|paycheck|wages|salary)/.test(text);
}

export function mapPlaidCategoryToCustomCategory(transaction: any): string {
  const text = getTransactionText(transaction);

  if (/(restaurant|fast food|coffee|grocer|grocery|food|dining|bar)/.test(text)) {
    return 'Food & Dining';
  }

  if (/(golf|sport|fitness club|gym membership|athletic|recreation)/.test(text)) {
    return 'Golf & Sports';
  }

  if (/(shopping|retail|clothing|electronics|merchandise)/.test(text)) {
    return 'Shopping';
  }

  if (/(doctor|hospital|pharmacy|health|medical|dentist|vision|fitness)/.test(text)) {
    return 'Health & Fitness';
  }

  if (/(church|charity|donation|tithe|giving|nonprofit)/.test(text)) {
    return 'Church & Giving';
  }

  if (/(subscription|netflix|spotify|hulu|membership|software|streaming)/.test(text)) {
    return 'Subscriptions';
  }

  if (/(home|utility|electric|water|internet|phone|rent|mortgage|insurance)/.test(text)) {
    return 'Home & Utilities';
  }

  if (/(gas|fuel|auto|car wash|vehicle|parking|toll)/.test(text)) {
    return 'Auto & Gas';
  }

  if (/(travel|hotel|airline|flight|vacation|rental car|lodging)/.test(text)) {
    return 'Travel';
  }

  if (/(transfer|payment|autopay|ach)/.test(text)) {
    return 'Transfers/Payments';
  }

  return 'Shopping';
}
