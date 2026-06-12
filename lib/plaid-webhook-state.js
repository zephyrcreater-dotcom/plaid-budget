const globalState = globalThis;

if (!globalState.__plaidTransactionReadyItems) {
  globalState.__plaidTransactionReadyItems = new Set();
}

const readyItems = globalState.__plaidTransactionReadyItems;

export function markTransactionsReady(itemId) {
  if (itemId) {
    readyItems.add(itemId);
  }
}

export function areTransactionsReady(itemId) {
  if (!itemId) {
    return false;
  }

  return readyItems.has(itemId);
}
