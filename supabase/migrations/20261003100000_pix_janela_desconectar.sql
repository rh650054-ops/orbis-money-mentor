-- ============================================================
-- PIX DO BANCO: janela do dia, banco desconectado, leitura mais frequente — 03/10/2026
-- Pedido do Rick (03/10, 9h): "caiu um Pix de 20 e um de 150 ontem e não contabilizou",
-- "quero uma opção pra desconectar banco", "não está mantendo atualizado".
--
-- 1) Janela do DEFCON com teto: o Pix vai pro DEFCON que estava aberto, mas a janela
--    de um dia acaba às 6h da manhã seguinte. Antes ela ia "até o próximo DEFCON":
--    o Pix das 10h de 02/10 caía em 01/10 porque o DEFCON de 02/10 só abriu às 13h52.
--    Sem hora exata (transacted_at vazio), a hora da leitura só vale se a leitura foi
--    até o dia seguinte; senão fica o dia que o banco informou.
-- 2) Banco desconectado (status 'deleted') não conta mais.
-- 3) O mesmo Pix lido por duas conexões (MeuPluggy espelha o C6) conta uma vez só:
--    fica a cópia com hora exata.
-- 4) Rick entra no teste do Open Finance (open_finance_testers, criado pelo Mohamed em 03/10).
-- 5) bank_connections.pluggy_pedido_em: quando a Vant pediu a última atualização à Pluggy.
--    A Pluggy só aceita 1 pedido por hora por banco; o cron das :07 batia em 59min59s e
--    metade dos pedidos voltava 409.
-- 6) vant_pro_hoje(): "comprovado hoje" da tela Vant Pro (caiu × lançou no mesmo dia).
-- 7) pluggy-hora passa a rodar a cada 15 minutos (o pedido à Pluggy continua 1 por hora).
-- Idempotente, sem comandos de apagar. Ranking NÃO muda (segue a regra de 03/10 do Mohamed).
-- ============================================================

alter table public.bank_connections add column if not exists pluggy_pedido_em timestamptz;

insert into public.open_finance_testers (user_id, nota)
values ('79312077-3496-44b0-b543-4c9f81425425', 'Rick, dono (03/10)')
on conflict do nothing;

create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  base as (
    select a.*,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
      -- banco desconectado não conta
      and not exists (select 1 from public.bank_connections bc
                       where bc.id = a.bank_connection_id and bc.status = 'deleted')
      -- o mesmo Pix lido por outra conexão: fica a cópia com hora (ou a de menor id)
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = a.user_id
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and not exists (select 1 from public.bank_connections bc2 where bc2.id = b.bank_connection_id and bc2.status = 'deleted')
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.quando,
           coalesce(
             (select s.d from sess s
               where x.quando is not null and s.ini <= x.quando
                 and x.quando < (((s.d + 1)::timestamp + interval '6 hours') at time zone 'America/Sao_Paulo')
               order by s.ini desc limit 1),
             (x.quando at time zone 'America/Sao_Paulo')::date,
             x.transaction_date) as dia
    from base x
  )
  select t.dia, sum(t.amount)::numeric, count(*)::int, max(t.quando)
  from tx t
  where t.dia between p_de and p_ate
  group by t.dia;
$$;

-- "Comprovado hoje" da tela Vant Pro: o dia é o do último DEFCON (hoje ou ontem),
-- igual ao banco_pix_do_dia; lançou = o que o vendedor fechou nesse dia.
create or replace function public.vant_pro_hoje()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  d as (
    select coalesce(
      (select max(cs.date) from public.challenge_sessions cs
        where cs.user_id = auth.uid() and cs.date >= (select d from hoje) - 1),
      (select d from hoje)) as dia
  ),
  px as (select * from public.banco_pix_por_dia(auth.uid(), (select dia from d), (select dia from d))),
  lan as (
    select greatest(
      coalesce((select sum(ds.total_profit) from public.daily_sales ds where ds.user_id = auth.uid() and ds.date::date = (select dia from d)), 0),
      coalesce((select sum(cs.total_sold) from public.challenge_sessions cs where cs.user_id = auth.uid() and cs.date = (select dia from d)), 0)
    ) as v
  )
  select jsonb_build_object(
    'dia', (select dia from d),
    'hoje', (select dia from d) = (select d from hoje),
    'caiu', coalesce((select sum(total) from px), 0),
    'qtd', coalesce((select sum(qtd) from px), 0),
    'lancou', (select v from lan),
    'ultima_leitura', (select max(last_synced_at) from public.bank_connections
                        where user_id = auth.uid() and coalesce(status, '') <> 'deleted')
  )
  where auth.uid() is not null;
$$;
grant execute on function public.vant_pro_hoje() to authenticated;

-- pluggy-hora a cada 15 min (8h → 23h52 em Brasília)
do $$ begin
  perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'pluggy-hora'),
                         schedule := '7,22,37,52 0-2,11-23 * * *');
end $$;
