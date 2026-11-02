-- 02/11/2026: PagBank (via Pluggy) stores every credit 6 hours EARLIER than it happened.
-- Evidence: across ~650 PagBank entries the fastest read arrived 6h00 after the stored time
-- (every other bank: seconds); a Pix the bank statement lists at 00:41 of day 2 arrived as
-- 18:41 of day 1; after +6h a seller's day matches his PagBank statement to the cent.
-- Effect before the fix: morning Pix looked like 5 a.m. and moved to the PREVIOUS day, and
-- late-night Pix stayed on the wrong day (ranking, financeiro, relatório all read this).
-- The importer (pluggy-entradas.ts) now shifts new PagBank entries; this fixes the old ones.
-- Run BEFORE deploying the new importer. Guarded: runs once (banco_correcoes marker).
create table if not exists public.banco_correcoes (
  nome text primary key,
  feito_em timestamptz not null default now()
);
alter table public.banco_correcoes enable row level security;

with marca as (
  insert into public.banco_correcoes (nome) values ('pagbank_6h') on conflict do nothing returning 1
)
update public.auto_detected_sales a
   set transacted_at = a.transacted_at + interval '6 hours',
       transaction_date = ((a.transacted_at + interval '6 hours') at time zone 'America/Sao_Paulo')::date
  from public.bank_connections bc
 where bc.id = a.bank_connection_id
   and bc.institution_name ~* 'pag\s*bank|pagseguro'
   and a.transacted_at is not null
   and exists (select 1 from marca);

-- past days of the ranking come from this cache: rebuild it now instead of waiting for :25
select public.ranking_cache_atualizar(45);
