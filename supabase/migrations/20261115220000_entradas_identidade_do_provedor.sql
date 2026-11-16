-- Vant — the provider's own reference of a bank entry (15/11/2026, revised 16/11).
-- ADDITIVE: three columns, one partial unique index and one new server-only table. No row is
-- changed; no existing column, function, trigger or policy is touched.
--
-- Why: Pluggy re-issues the ids of Mercado Pago transactions, and the importer stored the
-- re-issued id as a new entry. Two days of observation in production showed that the provider's
-- own reference survives the re-issue (see supabase/functions/_shared/pluggy-identidade.ts).
--
-- ALL OR NOTHING: one transaction. It first checks that this is the database it was written for,
-- and at the end checks what it created; any failed check rolls everything back.
-- How to run it, what to check before and after, and how to go back:
-- supabase/implantacao/2026-11-identidade-do-provedor.md
--
-- LOCKS (production, read 15/11: 23,154 rows, 10 MB, 5 indexes, no trigger, no view, not in the
-- realtime publication; no function returns the row type, uses %rowtype, SELECT * or INSERT
-- without a column list, so new columns break nothing that reads it):
--   * ADD COLUMN is metadata-only (no rewrite: nullable, and a constant default) but needs
--     ACCESS EXCLUSIVE for an instant. Waiting for it behind a long statement would queue every
--     other query on the table, so the wait is capped at 3 s: the migration then FAILS CLEANLY
--     (nothing applied) and can simply be run again.
--   * CREATE UNIQUE INDEX takes SHARE (blocks writes, not reads) while it scans the table once.
--     It is partial and no row qualifies yet (every provedor_ref is NULL): one pass over ~23k
--     rows, well under a second. CONCURRENTLY cannot run inside a transaction, and the
--     transaction is what makes this file all-or-nothing.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- 1. Is this the database this file was written for? (objects it depends on, in the shape it expects)
do $$
declare v text;
begin
  if to_regclass('public.auto_detected_sales') is null or to_regclass('public.bank_connections') is null then
    raise exception 'identity migration: auto_detected_sales / bank_connections not found — wrong database';
  end if;
  if not exists (select 1 from pg_index i where i.indrelid = 'public.auto_detected_sales'::regclass and i.indisunique
                   and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['transaction_id']) then
    raise exception 'identity migration: auto_detected_sales has no unique transaction_id — unexpected shape';
  end if;
  if not exists (select 1 from pg_index i where i.indrelid = 'public.bank_connections'::regclass and i.indisprimary) then
    raise exception 'identity migration: bank_connections has no primary key — unexpected shape';
  end if;
  for v in select column_name || ' ' || data_type from information_schema.columns
            where table_schema = 'public' and table_name = 'auto_detected_sales'
              and ((column_name in ('conta_id', 'provedor_ref') and data_type <> 'text') or (column_name = 'ids_anteriores' and data_type <> 'ARRAY')) loop
    raise exception 'identity migration: column already exists with another type (%)', v;
  end loop;
  select pg_get_indexdef(to_regclass('public.auto_detected_sales_identidade_uq')) into v;
  if v is not null and (v not ilike '%unique%' or v not ilike '%(bank_connection_id, conta_id, provedor_ref, transaction_date, amount)%' or v not ilike '%provedor_ref is not null%') then
    raise exception 'identity migration: an index with this name already exists with another definition';
  end if;
end $$;

-- 2. Columns
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

-- 3. Only rows that HAVE a reference: same connection, same account, same reference, same day,
-- same amount. It cannot refuse a payment of another account or bank, nor two payments with
-- different references, and it cannot fail on existing data.
create unique index if not exists auto_detected_sales_identidade_uq
  on public.auto_detected_sales (bank_connection_id, conta_id, provedor_ref, transaction_date, amount)
  where provedor_ref is not null and conta_id is not null and bank_connection_id is not null;

-- 4. The same provider reference coming back with ANOTHER day or amount. It is not assumed to be a
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

-- 5. What was created is what was meant, or nothing stays
do $$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'auto_detected_sales'
        and column_name in ('conta_id', 'provedor_ref', 'ids_anteriores')) <> 3 then
    raise exception 'identity migration: the three columns are not all there';
  end if;
  if not exists (select 1 from pg_index where indexrelid = 'public.auto_detected_sales_identidade_uq'::regclass and indisunique and indisvalid and indpred is not null) then
    raise exception 'identity migration: the unique index is missing, not unique, not partial or not valid';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.banco_entradas_divergencias'::regclass) then
    raise exception 'identity migration: the divergence table has no row level security';
  end if;
  if exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'banco_entradas_divergencias' and grantee in ('anon', 'authenticated')) then
    raise exception 'identity migration: the divergence table is reachable by the app roles';
  end if;
end $$;

commit;

-- GOING BACK
-- Once a function that uses these columns has been published, going back is BY CODE ONLY:
-- republish the four functions from the previous commit. That code ignores the columns, the
-- index constrains only rows that carry a reference (and that code writes none), and what was
-- stored stays as evidence. Columns that hold data are never dropped.
-- Only if the migration was applied and NOTHING was published after it (every column still
-- empty — check first) may the objects be removed:
--   select count(*) from public.auto_detected_sales where provedor_ref is not null or conta_id is not null or ids_anteriores <> '{}';  -- must be 0
--   select count(*) from public.banco_entradas_divergencias;                                                                          -- must be 0
--   drop table public.banco_entradas_divergencias;
--   drop index public.auto_detected_sales_identidade_uq;
--   alter table public.auto_detected_sales drop column ids_anteriores, drop column provedor_ref, drop column conta_id;
