-- Vant — the provider's own reference of a bank entry (15/11/2026). ADDITIVE: three columns and
-- one partial unique index. No row is changed, no existing column, function or policy is touched.
--
-- Why: Pluggy re-issues the ids of Mercado Pago transactions, and the importer stored the
-- re-issued id as a new entry (277 copies, R$ 5.6k, 6 sellers on 15/11). Two days of observation
-- in production showed that the provider's own reference survives the re-issue (see
-- supabase/functions/_shared/pluggy-identidade.ts).
--
-- conta_id        the Pluggy account the entry came from (two accounts of one connection are
--                 never compared with each other)
-- provedor_ref    "code:<providerCode>" or "id:<providerId>"; NULL for every bank whose reference
--                 was not proven stable, and for every row stored before this migration
-- ids_anteriores  Pluggy ids this same payment had before (audit trail of each re-issue)
--
-- The unique index only speaks about rows that HAVE a reference: same connection, same account,
-- same reference, same day, same amount. It cannot reject a payment of another account or of
-- another bank, nor two payments with different references. Every stored row has provedor_ref
-- NULL when it is created, so it cannot fail on existing data.

alter table public.auto_detected_sales
  add column if not exists conta_id text,
  add column if not exists provedor_ref text,
  add column if not exists ids_anteriores text[] not null default '{}';

comment on column public.auto_detected_sales.conta_id is 'Pluggy account id the entry came from';
comment on column public.auto_detected_sales.provedor_ref is 'Provider''s own reference (code:<providerCode> / id:<providerId>); only for banks proven to keep it across re-issues';
comment on column public.auto_detected_sales.ids_anteriores is 'Pluggy ids this same payment had before a re-issue';

create unique index if not exists auto_detected_sales_identidade_uq
  on public.auto_detected_sales (bank_connection_id, conta_id, provedor_ref, transaction_date, amount)
  where provedor_ref is not null and conta_id is not null and bank_connection_id is not null;

-- Rollback (nothing else depends on these):
--   drop index if exists public.auto_detected_sales_identidade_uq;
--   alter table public.auto_detected_sales drop column if exists ids_anteriores, drop column if exists provedor_ref, drop column if exists conta_id;
