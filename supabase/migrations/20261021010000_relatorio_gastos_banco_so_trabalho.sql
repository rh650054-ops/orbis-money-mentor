-- 21/10/2026 (Mohamed, approved): bank costs in the Relatório only come from accounts
-- the seller uses for work. Before, every connected account counted, so 99/99Food paid
-- from a PERSONAL account (Itaú, papel = 'pessoal') showed up as work transport/food.
--  * An account (institution_name) whose connections are ALL papel = 'pessoal' is ignored.
--    Accounts marked 'trabalho' or not marked at all keep counting (20 connections in prod
--    have no papel; ignoring them would empty their report).
--  * A purchase refunded later (entrada categoria 'estorno', same bank, same value, up to
--    7 days after) no longer counts as a cost.
-- Everything else (mercadoria rules, Foco-day rules, manual costs) is unchanged.
CREATE OR REPLACE FUNCTION public.relatorio_gastos_banco(p_de date, p_ate date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with u as (select auth.uid() as id),
  ok as (
    select 1 from public.bank_connections bc
     where bc.user_id = (select id from u) and coalesce(bc.status, '') <> 'deleted'
       and (select id from u) is not null and p_ate >= p_de and p_ate - p_de <= 400
     limit 1
  ),
  pessoais as (
    select bc.institution_name as banco
      from public.bank_connections bc
     where bc.user_id = (select id from u) and coalesce(bc.status, '') <> 'deleted'
     group by bc.institution_name
    having bool_and(coalesce(bc.papel, '') = 'pessoal')
  ),
  foco as (
    select distinct cs.date as d from public.challenge_sessions cs
     where cs.user_id = (select id from u) and cs.date between p_de and p_ate and cs.started_at is not null
  ),
  compras as (
    select (m.criada_em at time zone 'America/Sao_Paulo')::date as d, m.total
      from public.mercado_compras m
     where m.user_id = (select id from u)
       and (m.criada_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ),
  saidas as (
    select e.data as d, abs(e.valor) as v, e.categoria as c
      from public.extrato_lancamentos e
     where e.user_id = (select id from u) and e.tipo = 'saida' and e.data between p_de - 1 and p_ate + 1
       and coalesce(e.movimento, '') <> 'entre_contas' and coalesce(e.categoria, '') <> 'transferencia_propria'
       and not coalesce(e.fora_analise, false)
       and coalesce(e.banco, '') not in (select banco from pessoais where banco is not null)
       and not exists (
         select 1 from public.extrato_lancamentos x
          where x.user_id = e.user_id and x.tipo = 'entrada' and x.categoria = 'estorno'
            and coalesce(x.banco, '') = coalesce(e.banco, '') and abs(x.valor) = abs(e.valor)
            and x.data between e.data and e.data + 7)
  ),
  merc_banco as (
    select s.d, s.v from saidas s
     where s.d between p_de and p_ate
       and (s.c in ('mercadoria', 'insumos')
            or (s.c = 'mercado' and exists (select 1 from compras c where c.d = s.d)))
  ),
  compras_extra as (
    select greatest(0, c.total - coalesce((select sum(m.v) from merc_banco m where m.d = c.d), 0)) as extra
      from compras c
  ),
  manual as (
    select
      coalesce((select sum(pe.amount) from public.personal_expenses pe where pe.user_id = (select id from u) and pe.date between p_de and p_ate and lower(coalesce(pe.category, '')) like '%mercadoria%'), 0) as merc,
      coalesce((select sum(pe.amount) from public.personal_expenses pe where pe.user_id = (select id from u) and pe.date between p_de and p_ate and (lower(coalesce(pe.category, '')) like '%transporte%' or lower(coalesce(pe.category, '')) like '%combust%')), 0)
        + coalesce((select sum(ds.transport_cost) from public.daily_sales ds where ds.user_id = (select id from u) and ds.date between p_de and p_ate), 0) as transp,
      coalesce((select sum(pe.amount) from public.personal_expenses pe where pe.user_id = (select id from u) and pe.date between p_de and p_ate and (lower(coalesce(pe.category, '')) like '%aliment%' or lower(coalesce(pe.category, '')) like '%almoc%' or lower(coalesce(pe.category, '')) like '%lanche%')), 0)
        + coalesce((select sum(ds.food_cost) from public.daily_sales ds where ds.user_id = (select id from u) and ds.date between p_de and p_ate), 0) as alim
  )
  select case when exists (select 1 from ok) then jsonb_build_object(
    'mercadoria', round(coalesce((select sum(v) from merc_banco), 0) + coalesce((select sum(extra) from compras_extra), 0) + (select merc from manual), 2),
    'transporte', round(coalesce((select sum(s.v) from saidas s where s.d between p_de and p_ate
                    and (s.c in ('combustivel', 'onibus') or (s.c = 'transporte_app' and s.d in (select d from foco)))), 0) + (select transp from manual), 2),
    'alimentacao', round(coalesce((select sum(s.v) from saidas s where s.d between p_de and p_ate
                    and s.c in ('restaurante', 'delivery') and s.d in (select d from foco)), 0) + (select alim from manual), 2)
  ) end;
$function$;
