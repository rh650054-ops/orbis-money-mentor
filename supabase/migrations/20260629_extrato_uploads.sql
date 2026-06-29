-- Orbis — verificacao de vendas por extrato (desafio)
-- Guarda o resultado AUDITADO do extrato (so card+pix que ENTROU conta; dinheiro NAO).
-- Dois "slots" por dia: pix e cartao. Reenvio substitui o slot (upsert).
-- Total verificado do dia = slot pix + slot cartao.

create table if not exists public.extrato_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('pix', 'cartao')),
  total_verificado numeric not null default 0,
  qtd_vendas int not null default 0,
  total_ignorado numeric not null default 0,
  vendas jsonb not null default '[]'::jsonb,
  motor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dia, tipo)
);

create index if not exists extrato_uploads_dia_idx on public.extrato_uploads (dia);
create index if not exists extrato_uploads_user_dia_idx on public.extrato_uploads (user_id, dia);

alter table public.extrato_uploads enable row level security;

-- Cada vendedor mexe SO no proprio extrato.
drop policy if exists "extrato_select_own" on public.extrato_uploads;
create policy "extrato_select_own" on public.extrato_uploads
  for select using (auth.uid() = user_id);

drop policy if exists "extrato_insert_own" on public.extrato_uploads;
create policy "extrato_insert_own" on public.extrato_uploads
  for insert with check (auth.uid() = user_id);

drop policy if exists "extrato_update_own" on public.extrato_uploads;
create policy "extrato_update_own" on public.extrato_uploads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
