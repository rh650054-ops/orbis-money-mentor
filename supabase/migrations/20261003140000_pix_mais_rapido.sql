-- ============================================================
-- PIX NO DEFCON MAIS RÁPIDO — 03/10/2026
-- Rick (11h41): vendeu R$ 40, o Pix de R$ 20 já tinha caído no C6 e o DEFCON
-- ainda mostrava "Pix na conta R$ 0 · 11:37".
-- Por quê: a Pluggy só deixa pedir 1 atualização por hora por banco, e a regra
-- de 61 min com cron de 15 em 15 virava 1 pedido a cada 75 min (10h37 → 11h52).
-- O "· 11:37" era a hora em que a Vant LEU a Pluggy, não a hora em que a Pluggy
-- leu o BANCO, então parecia atualizado sem estar.
--   • pluggy-hora a cada 5 min (pedido à Pluggy: ao completar 60 min, não 61)
--   • banco_pix_do_dia.ultima_sync = quando o banco foi lido de verdade (pluggy_pedido_em)
-- ============================================================
do $$ begin
  perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'pluggy-hora'),
                         schedule := '*/5 0-2,11-23 * * *');
end $$;

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
    select institution_name, coalesce(pluggy_pedido_em, last_synced_at) as lido, status
    from public.bank_connections
    where user_id = auth.uid() and coalesce(status, '') <> 'deleted'
      and public.open_finance_teste(auth.uid())
    order by coalesce(pluggy_pedido_em, last_synced_at) desc nulls last limit 1
  ),
  e as (select * from public.banco_pix_por_dia(auth.uid(), (select dia from d), (select dia from d)))
  select exists (select 1 from b),
         (select institution_name from b),
         case when exists (select 1 from b) then coalesce((select sum(e.total) from e), 0) else 0 end::numeric,
         case when exists (select 1 from b) then coalesce((select sum(e.qtd) from e), 0) else 0 end::int,
         (select lido from b),
         (select status from b);
$$;
