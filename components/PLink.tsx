import { NextPage } from 'next';
import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import fetchSwal from '../lib/fetchSwal';

interface PLinkProps {

}

const PLink: NextPage<PLinkProps> = ({}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLinked, setIsLinked] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  useEffect(() => {
    fetch('/api/create-link-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
      .then((response) => response.json())
      .then((res) => {
        if (res.ok !== false) {
          setLinkToken(res.link_token);
        }
      });
  }, []);

  function fetchTransactions() {
    setIsLoadingTransactions(true);

    fetchSwal
      .post('/api/transactions', {})
      .then((res) => {
        if (res.ok !== false) {
          setTransactions(res.transactions || []);
          setIsLinked(true);
        }
      })
      .finally(() => setIsLoadingTransactions(false));
  }

  function handleOnSuccess(public_token: string) {
    fetchSwal
      .post('/api/exchange-token', {
        public_token,
      })
      .then((res) => {
        if (res.ok !== false) {
          setIsLinked(true);
          fetchTransactions();
        }
      });
  }

  function handleOnExit() {
    // handle the case when your user exits Link
    // For the sake of this tutorial, we're not going to be doing anything here.
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onExit: handleOnExit,
    onSuccess: handleOnSuccess,
  });

  return(
    <div>
      <button
        onClick={() => open()}
        disabled={!ready}
        className="mt-5 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        Connect your bank!
      </button>
      <div>
        <button 
          onClick={() => fetchTransactions()}
          disabled={!isLinked || isLoadingTransactions}
          className="mt-5 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {isLoadingTransactions ? 'Loading transactions...' : 'View Transactions'}
        </button>
      </div>
      <div className="mt-6 text-left">
        <p className="font-bold text-lg">Recent Transactions</p>
        {transactions.length === 0 ? (
          <p className="text-gray-600 dark:text-neutral-300 mt-2">
            Connect an account to load the last 30 days of transactions.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transactions.map((transaction) => (
              <li
                key={transaction.transaction_id}
                className="border border-gray-200 dark:border-neutral-700 rounded px-4 py-3"
              >
                <div className="font-semibold">{transaction.name}</div>
                <div className="text-sm text-gray-600 dark:text-neutral-300">
                  {transaction.date} · ${Number(transaction.amount).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default PLink;
