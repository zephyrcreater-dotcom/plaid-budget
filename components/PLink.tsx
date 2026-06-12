import { NextPage } from 'next';
import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import fetchSwal from '../lib/fetchSwal';

interface PLinkProps {

}

const CHART_COLORS = ['#2BB0ED', '#127FBF', '#40C3F7', '#7B8794', '#0B69A3', '#CBD2D9'];

function currencyFormatter(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getTransactionCategory(transaction: any) {
  if (typeof transaction.category === 'string' && transaction.category.length > 0) {
    return transaction.category;
  }

  if (Array.isArray(transaction.category) && transaction.category.length > 0) {
    return transaction.category[0];
  }

  if (transaction.personal_finance_category?.primary) {
    return transaction.personal_finance_category.primary
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  return 'Uncategorized';
}

function chartValueFormatter(value: any) {
  return currencyFormatter(Number(value || 0));
}

const PLink: NextPage<PLinkProps> = ({}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLinked, setIsLinked] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionsMessage, setTransactionsMessage] = useState(
    'Connect an account to load the last 30 days of transactions.'
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const availableMonths = Array.from(
    new Set(
      transactions.map((transaction) => String(transaction.date).slice(0, 7))
    )
  ).sort((a, b) => (a < b ? 1 : -1));

  const activeMonth = selectedMonth || availableMonths[0] || null;
  const monthTransactions = activeMonth
    ? transactions.filter((transaction) => String(transaction.date).startsWith(activeMonth))
    : [];
  const categoryTotals = monthTransactions.reduce((accumulator: Record<string, number>, transaction) => {
    const amount = Number(transaction.amount || 0);

    if (amount <= 0) {
      return accumulator;
    }

    const category = getTransactionCategory(transaction);
    accumulator[category] = (accumulator[category] || 0) + amount;
    return accumulator;
  }, {});
  const categoryChartData = Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);
  const totalSpent = monthTransactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount || 0);
    return amount > 0 ? sum + amount : sum;
  }, 0);
  const totalIncome = monthTransactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount || 0);
    return amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);
  const remainingDaysInMonth = activeMonth
    ? (() => {
        const [year, month] = activeMonth.split('-').map(Number);
        const today = new Date();
        const lastDay = new Date(year, month, 0);
        const diffMs = lastDay.getTime() - today.getTime();
        return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      })()
    : 0;

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

    loadDashboard(true);
  }, []);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  useEffect(() => {
    if (!isLinked) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      runSync(true);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [isLinked]);

  function updateLastUpdated(nextAccounts: any[]) {
    const syncedAtValues = nextAccounts
      .map((account) => account.last_synced_at)
      .filter(Boolean)
      .sort((a, b) => (a < b ? 1 : -1));

    setLastUpdated(syncedAtValues[0] || null);
  }

  async function loadAccounts() {
    const response = await fetch('/api/accounts');
    const res = await response.json();

    if (res.ok === false) {
      return [];
    }

    const nextAccounts = res.accounts || [];
    setAccounts(nextAccounts);
    setIsLinked(nextAccounts.length > 0);
    updateLastUpdated(nextAccounts);
    return nextAccounts;
  }

  async function loadTransactions() {
    const response = await fetch('/api/transactions');
    const res = await response.json();

    if (res.ok === false) {
      setTransactionsMessage(res.message || 'Unable to load transactions.');
      return [];
    }

    const nextTransactions = res.transactions || [];
    setTransactions(nextTransactions);
    setTransactionsMessage(
      nextTransactions.length > 0
        ? 'Recent transactions loaded.'
        : 'No transactions synced yet. Run a sync to load your latest activity.'
    );
    return nextTransactions;
  }

  async function loadDashboard(silent = false) {
    if (!silent) {
      setIsLoadingTransactions(true);
    }

    try {
      const nextAccounts = await loadAccounts();

      if (nextAccounts.length > 0) {
        await loadTransactions();
      } else {
        setTransactions([]);
        setTransactionsMessage('Connect an account to load the last 30 days of transactions.');
      }
    } finally {
      if (!silent) {
        setIsLoadingTransactions(false);
      }
    }
  }

  async function runSync(silent = false) {
    setIsLoadingTransactions(true);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
      });
      const res = await response.json();

      if (res.ok === false) {
        setTransactionsMessage(res.message || 'Unable to sync transactions.');
        return;
      }

      const nextAccounts = await loadAccounts();
      await loadTransactions();

      if (!silent) {
        setTransactionsMessage(
          `Sync complete. ${res.accounts_synced || nextAccounts.length} accounts refreshed.`
        );
      }
    } finally {
      setIsLoadingTransactions(false);
    }
  }

  function handleOnSuccess(public_token: string, metadata: any) {
    fetchSwal
      .post('/api/exchange-token', {
        public_token,
        metadata,
      })
      .then((res) => {
        if (res.ok !== false) {
          setAccounts(res.accounts || []);
          setIsLinked(true);
          updateLastUpdated(res.accounts || []);
          runSync();
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

  function copyBudgetSummary() {
    const lines = [
      `${activeMonth ? formatMonthLabel(activeMonth) : 'Current Month'} Budget Summary`,
      `Total spent: ${currencyFormatter(totalSpent)}`,
      `Total income: ${currencyFormatter(totalIncome)}`,
      `Remaining days in month: ${remainingDaysInMonth}`,
      '',
      'Spending by category:',
      ...categoryChartData.map((entry) => `- ${entry.name}: ${currencyFormatter(entry.value)}`),
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setTransactionsMessage('Budget summary copied to clipboard.');
    });
  }

  return(
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wider text-gray-500 dark:text-neutral-300">
                Connected Accounts
              </p>
              <h3 className="mt-0 mb-2 text-2xl font-semibold">
                {accounts.length} linked {accounts.length === 1 ? 'account' : 'accounts'}
              </h3>
              <p className="mb-0 text-base text-gray-600 dark:text-neutral-300">
                Add multiple banks and cards to see one combined budget view.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
              <button
                onClick={() => open()}
                disabled={!ready}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg"
              >
                {accounts.length > 0 ? 'Add another bank or card' : 'Connect your bank'}
              </button>
              <button 
                onClick={() => runSync()}
                disabled={!isLinked || isLoadingTransactions}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg"
              >
                {isLoadingTransactions ? 'Syncing...' : 'Refresh Transactions'}
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-600 p-4">
                <p className="mb-0 text-base text-gray-600 dark:text-neutral-300">
                  No accounts connected yet.
                </p>
              </div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border border-gray-200 dark:border-neutral-700 p-4"
                >
                  <div className="font-semibold text-lg">{account.institution_name}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-neutral-300">
                    <div>
                      {account.account_name}
                      {account.mask ? ` •••• ${account.mask}` : ''}
                    </div>
                    <div className="capitalize">
                      {account.account_type} {account.account_subtype ? `· ${account.account_subtype}` : ''}
                    </div>
                    <div>
                      Current: {currencyFormatter(Number(account.current_balance || 0))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 mb-0 text-sm text-gray-500 dark:text-neutral-400">
            {lastUpdated
              ? `Last updated ${new Date(lastUpdated).toLocaleString()}`
              : transactionsMessage}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <p className="mb-2 text-sm uppercase tracking-wider text-gray-500 dark:text-neutral-300">
            Month Selector
          </p>
          <select
            value={activeMonth || ''}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-3 text-base"
          >
            {availableMonths.length === 0 ? (
              <option value="">No months available yet</option>
            ) : (
              availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))
            )}
          </select>
          <button
            onClick={copyBudgetSummary}
            disabled={categoryChartData.length === 0}
            className="mt-4 w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 disabled:opacity-50"
          >
            Copy Budget Summary
          </button>
          <p className="mt-4 mb-0 text-base text-gray-600 dark:text-neutral-300">
            {transactionsMessage}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <p className="mb-2 text-sm uppercase tracking-wider text-gray-500 dark:text-neutral-300">Spent This Month</p>
          <div className="text-4xl font-bold">{currencyFormatter(totalSpent)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <p className="mb-2 text-sm uppercase tracking-wider text-gray-500 dark:text-neutral-300">Income This Month</p>
          <div className="text-4xl font-bold">{currencyFormatter(totalIncome)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <p className="mb-2 text-sm uppercase tracking-wider text-gray-500 dark:text-neutral-300">Days Left</p>
          <div className="text-4xl font-bold">{remainingDaysInMonth}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="mt-0 mb-0 text-2xl font-semibold">Spending by Category</h3>
          </div>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD2D9" />
                <XAxis dataKey="name" tick={{ fill: '#7B8794', fontSize: 12 }} />
                <YAxis tickFormatter={(value: any) => `$${value}`} tick={{ fill: '#7B8794', fontSize: 12 }} />
                <Tooltip formatter={chartValueFormatter} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <h3 className="mt-0 mb-0 text-2xl font-semibold">Category Mix</h3>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  paddingAngle={3}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={chartValueFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <h3 className="mt-0 mb-4 text-2xl font-semibold">Category Breakdown</h3>
          {categoryChartData.length === 0 ? (
            <p className="mb-0 text-base text-gray-600 dark:text-neutral-300">
              No spending data yet for this month.
            </p>
          ) : (
            <div className="space-y-3">
              {categoryChartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-neutral-700 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-base">{entry.name}</span>
                  </div>
                  <span className="font-semibold">{currencyFormatter(entry.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
          <h3 className="mt-0 mb-4 text-2xl font-semibold">Recent Transactions</h3>
          {monthTransactions.length === 0 ? (
            <p className="mb-0 text-base text-gray-600 dark:text-neutral-300">
              {transactionsMessage}
            </p>
          ) : (
            <ul className="space-y-3">
              {monthTransactions.slice(0, 12).map((transaction) => (
                <li
                  key={transaction.id}
                  className="border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{transaction.name}</div>
                      <div className="text-sm text-gray-600 dark:text-neutral-300">
                        {transaction.accounts?.institution_name || 'Connected account'} · {getTransactionCategory(transaction)} · {transaction.date}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {currencyFormatter(Number(transaction.amount || 0))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default PLink;
