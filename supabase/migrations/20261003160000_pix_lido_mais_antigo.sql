-- ============================================================
-- DEFCON: a hora do banco é a do banco MAIS ATRASADO — 03/10/2026
-- Rick (12h41): o DEFCON dizia "Pix na conta R$ 20 · 12:35", mas 3 Pix do C6
-- não tinham entrado. O 12:35 era do Santander (ligado às 12h09); o C6 tinha
-- sido lido pela última vez às 11h45. Com 2+ bancos, a linha agora mostra a
-- leitura mais antiga: é até ali que dá pra confiar no número.
-- ============================================================
create or replace function public.banco_pix_do_dia(p_dia date default null)
returns table(tem_banco boolean, banco text, total numeric, qtd integer, ultima_sync timestamptz, status text)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  d as (
    select coalesce(
      p_dia,
      (select max(cs.date) from public.challenge_sessions cs
        where cs.user_id = auth.uid() and cs.date >= (select d from hoje) - 1),
      (select d from hoje)) as dia
  ),
  b as (
    select institution_name, coalesce(pluggy_pedido_em, created_at) as lido, status
    from public.bank_connections
    where user_id = auth.uid() and coalesce(status, '') <> 'deleted'
      and public.open_finance_teste(auth.uid())
    order by coalesce(pluggy_pedido_em, created_at) asc nulls first limit 1
  ),
  e as (select * from public.banco_pix_por_dia(auth.uid(), (select dia from d), (select dia from d)))
  select exists (select 1 from b),
         (select institution_name from b),
         case when exists (select 1 from b) then coalesce((select sum(e.total) from e), 0) else 0 end::numeric,
         case when exists (select 1 from b) then coalesce((select sum(e.qtd) from e), 0) else 0 end::int,
         (select lido from b),
         (select status from b);
$$;
