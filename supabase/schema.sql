create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  institution_name text,
  institution_id text,
  access_token text not null,
  item_id text not null,
  account_type text,
  account_subtype text,
  account_name text,
  mask text,
  plaid_account_id text not null,
  current_balance decimal,
  available_balance decimal,
  created_at timestamp default now(),
  last_synced_at timestamp
);

create table if not exists transactions (
  id text primary key,
  account_id uuid references accounts(id) on delete cascade,
  date date,
  name text,
  amount decimal,
  category text,
  plaid_category text[],
  is_transfer boolean default false,
  is_income boolean default false,
  pending boolean,
  created_at timestamp default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category text not null,
  monthly_limit decimal not null,
  month text not null,
  created_at timestamp default now(),
  unique(user_id, category, month)
);

create table if not exists investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  balance decimal,
  contributions_ytd decimal,
  snapshot_date date
);

create index if not exists idx_accounts_user_id on accounts(user_id);
create index if not exists idx_accounts_item_id on accounts(item_id);
create index if not exists idx_accounts_plaid_account_id on accounts(plaid_account_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_category on transactions(category);
create index if not exists idx_budgets_user_month on budgets(user_id, month);
