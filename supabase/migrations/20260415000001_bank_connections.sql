-- bank_connections: stores Open Finance connections per user (via Pluggy.ai)
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  institution_name text not null,
  institution_logo text,
  status text not null default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bank_connections enable row level security;
create policy "Users select own bank_connections" on public.bank_connections
  for select using (auth.uid() = user_id);
create policy "Users insert own bank_connections" on public.bank_connections
  for insert with check (auth.uid() = user_id);
create policy "Users update own bank_connections" on public.bank_connections
  for update using (auth.uid() = user_id);
create policy "Users delete own bank_connections" on public.bank_connections
  for delete using (auth.uid() = user_id);

-- auto_detected_sales: credit transactions detected via Open Finance
create table if not exists public.auto_detected_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  transaction_id text not null unique,
  amount numeric not null,
  description text,
  transaction_date date not null,
  status text not null default 'pending', -- pending | confirmed | ignored
  daily_sale_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_detected_sales enable row level security;
create policy "Users select own auto_detected_sales" on public.auto_detected_sales
  for select using (auth.uid() = user_id);
create policy "Users insert own auto_detected_sales" on public.auto_detected_sales
  for insert with check (auth.uid() = user_id);
create policy "Users update own auto_detected_sales" on public.auto_detected_sales
  for update using (auth.uid() = user_id);
create policy "Users delete own auto_detected_sales" on public.auto_detected_sales
  for delete using (auth.uid() = user_id);

-- Enable realtime so the app receives push notifications on new rows
alter publication supabase_realtime add table public.auto_detected_sales;
