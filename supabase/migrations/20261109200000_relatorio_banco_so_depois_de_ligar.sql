-- 09/11/2026: the report uses the bank only from the day the seller connected it.
-- Before that, it shows what the seller typed (as the reconcile already does since 10/10).
--
-- Case: a seller connected Mercado Pago today. The first import brought the last 7 days, and the
-- report immediately replaced his typed week: calote went from ~8% to 27% (Pix that fell on a
-- later day, date-only from Mercado Pago, were read as unpaid), and the merchandise cost he typed
-- every day vanished (with a bank, merchandise came only from bank purchases).
--
-- Changes (report only; the ranking keeps its own rule, ranking_valor_dias is untouched):
--   • banco_ligou_em(user): the day of the FIRST bank ever connected (deleted ones too).
--   • banco_conferencia: no bank row for days before it -> the report uses the typed day.
--   • relatorio_calote_banco: "caiu depois" only for days from it on.
--   • relatorio_gastos_banco: before it, merchandise = what was typed (daily_sales.cost) and
--     transport/food = typed only; from it on, unchanged (bank + typed).

create or replace function public.banco_ligou_em(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select min((bc.created_at at time zone 'America/Sao_Paulo')::date)
    from public.bank_connections bc where bc.user_id = p_user;
$$;
revoke all on function public.banco_ligou_em(uuid) from public, anon, authenticated;

create or replace function public.banco_conferencia(p_de date, p_ate date)
returns table(dia date, lancou numeric, pix_cartao numeric, dinheiro numeric, caiu numeric, maquininha numeric, conta_ranking numeric, faltou numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ligou date;
begin
  if u is null or p_ate < p_de or p_ate - p_de > 400 then
    return;
  end if;
  ligou := public.banco_ligou_em(u);

  return query
  with r as (
    select x.dia, x.valor, x.pelo_banco from public.ranking_valor_dias(p_de, p_ate, u) x
  ),
  -- bank that counts today: Pro (or test), a counting connection with entries
  banco_hoje as (
    select greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), public.ranking_banco_desde()) as desde
      from public.bank_connections bc
     where bc.user_id = u and coalesce(bc.status, '') <> 'deleted'
       and (public.orbis_pro_ativo(u) or public.open_finance_teste(u))
       and public.banco_conta_de_venda(bc.id, null)
       and exists (select 1 from public.auto_detected_sales a where a.bank_connection_id = bc.id)
  ),
  ds as (
    select s.date::date as d,
           sum(coalesce(s.total_profit, 0))::numeric as lancou,
           sum(coalesce(s.pix_sales, 0) + coalesce(s.card_sales, 0))::numeric as pix_cartao,
           sum(coalesce(s.cash_sales, 0))::numeric as dinheiro
      from public.daily_sales s
     where s.user_id = u and s.date::date between p_de and p_ate
     group by s.date::date
  ),
  e as (select * from public.banco_entradas_por_dia(u, p_de, p_ate))
  select ds.d, ds.lancou, ds.pix_cartao, ds.dinheiro,
         coalesce(e.total, 0)::numeric, coalesce(e.maquininha, 0)::numeric,
         r.valor,
         greatest(0, ds.pix_cartao - coalesce(e.total, 0))::numeric
    from ds
    join r on r.dia = ds.d
    left join e on e.dia = ds.d
   where ds.lancou > 0
     and ligou is not null and ds.d >= ligou   -- 09/11: before the bank, the typed day stands
     and (r.pelo_banco
          or (ds.d = hoje and exists (select 1 from banco_hoje b where b.desde is not null and ds.d >= b.desde)))
   order by ds.d;
end $$;

create or replace function public.relatorio_calote_banco(p_de date, p_ate date)
returns table(dia date, recuperado numeric, n integer)
language sql stable security definer set search_path = public as $$
  with u as (select auth.uid() as id),
  dias as (
    select r.dia from public.ranking_valor_dias(p_de, p_ate, (select id from u)) r
     where r.pelo_banco and (select id from u) is not null and p_ate >= p_de and p_ate - p_de <= 400
       and r.dia >= coalesce(public.banco_ligou_em((select id from u)), 'infinity'::date)  -- 09/11
  ),
  fim as (
    select cs.date as d, max(cs.ended_at) as fim from public.challenge_sessions cs
     where cs.user_id = (select id from u) and cs.date between p_de and p_ate and cs.ended_at is not null
     group by cs.date
  ),
  e as (
    select x.dia, x.amount, x.quando > f.fim as depois
      from public.banco_entradas_detalhe((select id from u), p_de, p_ate) x
      join fim f on f.d = x.dia
     where x.dia in (select dia from dias)
  ),
  t as (
    select e.dia,
           coalesce(sum(e.amount) filter (where not coalesce(e.depois, false)), 0) as antes,
           coalesce(sum(e.amount) filter (where e.depois), 0) as depois,
           count(*) filter (where e.depois)::int as n
      from e group by e.dia
  )
  select t.dia,
         round(least(t.depois, greatest(
           coalesce(nullif(public.banco_lancado_dia((select id from u), t.dia), 0),
                    (select coalesce(s.total_profit, 0) + coalesce(s.total_debt, 0) from public.daily_sales s
                      where s.user_id = (select id from u) and s.date = t.dia))
           - coalesce((select s.cash_sales from public.daily_sales s where s.user_id = (select id from u) and s.date = t.dia), 0)
           - t.antes, 0)), 2),
         t.n
    from t
   where t.depois > 0;
$$;

create or replace function public.relatorio_gastos_banco(p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select auth.uid() as id),
  lig as (select coalesce(public.banco_ligou_em((select id from u)), 'infinity'::date) as d),  -- 09/11
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
       and e.data >= (select d from lig)   -- 09/11: bank spending only from the day it was connected
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
      from compras c where c.d >= (select d from lig)
  ),
  -- 09/11: before the bank, the merchandise the seller typed at the end of the day (and his notes)
  antes as (
    select coalesce((select sum(ds.cost) from public.daily_sales ds
                      where ds.user_id = (select id from u) and ds.date between p_de and p_ate
                        and ds.date < (select d from lig)), 0)
         + coalesce((select sum(c.total) from compras c where c.d < (select d from lig)), 0) as merc
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
    'mercadoria', round(coalesce((select sum(v) from merc_banco), 0) + coalesce((select sum(extra) from compras_extra), 0)
                        + (select merc from manual) + (select merc from antes), 2),
    'transporte', round(coalesce((select sum(s.v) from saidas s where s.d between p_de and p_ate
                    and (s.c in ('combustivel', 'onibus') or (s.c = 'transporte_app' and s.d in (select d from foco)))), 0) + (select transp from manual), 2),
    'alimentacao', round(coalesce((select sum(s.v) from saidas s where s.d between p_de and p_ate
                    and s.c in ('restaurante', 'delivery') and s.d in (select d from foco)), 0) + (select alim from manual), 2)
  ) end;
$$;
