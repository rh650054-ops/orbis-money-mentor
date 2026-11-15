-- Vant — the provider's own reference of a bank entry (15/11/2026). ADDITIVE: three columns, one
-- partial unique index and one new server-only table. No row is changed; no existing column,
-- function or policy is touched.
--
-- Why: Pluggy re-issues the ids of Mercado Pago transactions, and the importer stored the
-- re-issued id as a new entry. Two days of observation in production showed that the provider's
-- own reference survives the re-issue (see supabase/functions/_shared/pluggy-identidade.ts).
--
-- LOCKS (production, read 15/11: 23,154 rows, 10 MB, 5 indexes, no trigger, no view, not in the
-- realtime publication; no function returns the row type, uses %rowtype, SELECT * or INSERT
-- without a column list, so new columns break nothing that reads it):
--   * the three ADD COLUMN are metadata-only (no rewrite: nullable, and a constant default), but
--     each needs ACCESS EXCLUSIVE for an instant. Waiting for it behind a long statement would
--     queue every other query on the table, so the wait is capped at 3 s: the migration then
--     FAILS CLEANLY (nothing applied) and can simply be run again.
--   * CREATE UNIQUE INDEX takes SHARE (blocks writes, not reads) while it scans the table once.
--     The index is partial and no row qualifies yet (every provedor_ref is NULL), so it is a
--     single pass over ~23k rows: well under a second. CONCURRENTLY is not used because it cannot
--     run inside the transaction that makes this migration all-or-nothing.
-- (session level, reset at the end: SET LOCAL would be a no-op if this file is ever run outside a transaction)
set lock_timeout = '3s';
set statement_timeout = '30s';

-- conta_id        the Pluggy account the entry came from (two accounts of one connection are
--                 never compared with each other)
-- provedor_ref    "code:<providerCode>" or "id:<providerId>"; NULL for every bank whose reference
--                 was not proven, and for every row stored before this migration. It is filled
--                 only by the importer, for a row whose own Pluggy id came back carrying it.
-- ids_anteriores  Pluggy ids this same payment had before (audit trail of each re-issue)
alter table public.auto_detected_sales
  add column if not exists conta_id text,
  add column if not exists provedor_ref text,
  add column if not exists ids_anteriores text[] not null default '{}';

comment on column public.auto_detected_sales.conta_id is 'Pluggy account id the entry came from';
comment on column public.auto_detected_sales.provedor_ref is 'Provider''s own reference (code:<providerCode> / id:<providerId>); only for banks proven to keep it across re-issues';
comment on column public.auto_detected_sales.ids_anteriores is 'Pluggy ids this same payment had before a re-issue';

-- Only rows that HAVE a reference: same connection, same account, same reference, same day, same
-- amount. It cannot refuse a payment of another account or bank, nor two payments with different
-- references, and it cannot fail on existing data.
create unique index if not exists auto_detected_sales_identidade_uq
  on public.auto_detected_sales (bank_connection_id, conta_id, provedor_ref, transaction_date, amount)
  where provedor_ref is not null and conta_id is not null and bank_connection_id is not null;

-- The same provider reference coming back with ANOTHER day or amount. It is not assumed to be a
-- new payment (that would inflate the money) nor a correction of the stored one (that would
-- rewrite history): it waits here, outside every total, until someone decides.
create table if not exists public.banco_entradas_divergencias (
  id bigint generated always as identity primary key,
  -- like auto_detected_sales: no key on the users table (apagar_dados_do_usuario sweeps every
  -- table that has user_id); the row goes with its connection
  user_id uuid not null,
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  conta_id text not null,
  provedor_ref text not null,
  transaction_id_guardado text not null,
  transaction_id_novo text not null,
  data_guardada date not null,
  valor_guardado numeric not null,
  data_nova date not null,
  valor_novo numeric not null,
  visto_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolucao text,
  unique (bank_connection_id, conta_id, provedor_ref, data_nova, valor_novo)
);
alter table public.banco_entradas_divergencias enable row level security;
revoke all on public.banco_entradas_divergencias from anon, authenticated;
comment on table public.banco_entradas_divergencias is 'Same provider reference seen with another day or amount; kept out of every total until decided. Server only.';

reset lock_timeout;
reset statement_timeout;

-- Rollback (nothing else depends on these):
--   drop table if exists public.banco_entradas_divergencias;
--   drop index if exists public.auto_detected_sales_identidade_uq;
--   alter table public.auto_detected_sales drop column if exists ids_anteriores, drop column if exists provedor_ref, drop column if exists conta_id;
