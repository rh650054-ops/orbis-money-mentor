-- ============================================================
-- Gastos do Relatório lidos do banco (Rick, 19/10/2026): "quem tem Open Finance vai
-- automático" — mercadoria, Uber/99, combustível, comida do dia de rua.
--
-- Only for the logged user WITH a bank connection (others keep the manual numbers).
-- Bank outflows (extrato_lancamentos, tipo 'saida', never own transfers):
--   mercadoria  = categoria mercadoria/insumos (esfera corre)
--               + categoria 'mercado' on the same day as a "Tô no mercado" purchase
--               + what each "Tô no mercado" purchase has beyond the bank outflows
--                 the same day: the purchase counts in full, never twice
--               + manual personal_expenses of category mercadoria
--   transporte  = combustivel/onibus any day; transporte_app (Uber/99) on Foco days
--               + manual (daily_sales.transport_cost, personal_expenses transporte)
--   alimentacao = restaurante/delivery on Foco days + manual (food_cost, expenses)
-- The cost-per-sale (daily_sales.cost) is NOT used here: it would count the same
-- goods twice (once when bought, once when sold).
-- Read only.
-- ============================================================
create or replace function public.relatorio_gastos_banco(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select auth.uid() as id),
  ok as (
    select 1 from public.bank_connections bc
     where bc.user_id = (select id from u) and coalesce(bc.status, '') <> 'deleted'
       and (select id from u) is not null and p_ate >= p_de and p_ate - p_de <= 400
     limit 1
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
  ),
  merc_banco as (
    select s.d, s.v from saidas s
     where s.d between p_de and p_ate
       and (s.c in ('mercadoria', 'insumos')
            or (s.c = 'mercado' and exists (select 1 from compras c where c.d = s.d)))
  ),
  -- each "Tô no mercado" purchase counts in full; the bank only adds what it saw beyond it
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
$$;
revoke all on function public.relatorio_gastos_banco(date, date) from public, anon;
grant execute on function public.relatorio_gastos_banco(date, date) to authenticated;
