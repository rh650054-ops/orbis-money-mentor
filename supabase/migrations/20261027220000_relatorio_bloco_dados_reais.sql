-- 27/10/2026 — Relatório audit: every number must come from real data.
-- Changes to relatorio_bloco (same signature, same grants: postgres/service_role only):
--  1. Street time. The Foco writes worked_minutes WITHOUT the pauses (the block timer stops
--     while paused) in most sessions, and the old function subtracted the pauses again, so
--     "vendendo" was cut twice (one seller showed 76% paused). Now, per session:
--       street = max(worked, min(wall clock, worked + pauses))   -- real time on the street
--       pausa  = min(pauses, street);  parado = idle gaps (>20 min) minus pauses, within street
--       ativo  = street - pausa - parado
--     The idle timeline ends at started_at + street (or the last sale), so a Foco left open
--     overnight no longer turns the whole night into "parado".
--  2. Conversion only over days with approaches actually tapped. The Foco counts every sale as
--     an approach, so a day where the seller never tapped "abordagem" had approaches = sales and
--     showed ~100%. A day counts for conversion when sales < 90% of approaches. New fields:
--     vendas.abordagens_conv / vendas.vendas_conv, dias[].conv_ok, horas[].abordagens_conv /
--     horas[].vendas_conv. vendas.conversao and abordagens_por_venda use only those days.
--  3. Ticket = value of the Foco sales / number of Foco sales (same rows). Before it was
--     daily_sales total / Foco count (typed days without Foco and tips inflated it).
--  4. Calote. "Caiu mais dinheiro" already moves the amount from total_debt to total_profit, so
--     total_debt is what is STILL missing. Now: valor (total) = faltou + recuperado,
--     perdido = faltou, taxa = recuperado / total. Before, the recovered part was subtracted twice.
CREATE OR REPLACE FUNCTION public.relatorio_bloco(p_user uuid, p_de date, p_ate date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with
sess as (
  select s.id, s.date, s.started_at, s.ended_at, s.worked_minutes, s.paused_seconds, s.current_block_index
  from public.challenge_sessions s
  where s.user_id = p_user and s.date between p_de and p_ate
),
sess_w as (
  select s.*,
    coalesce(s.ended_at, now()) as fim_calc,
    case when s.started_at is not null and coalesce(s.ended_at, now()) > s.started_at
         then extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60 else 0 end::numeric as wall,
    case
      when s.worked_minutes is not null then greatest(0, s.worked_minutes)::numeric
      when s.started_at is not null and coalesce(s.ended_at, now()) > s.started_at
        then least(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60,
                   (coalesce(s.current_block_index, 0) + 1) * 60)::numeric
      else 0::numeric
    end as wmin
  from sess s
),
pz as (
  select p.session_id, coalesce(p.motivo, 'outro') as motivo, p.inicio,
         least(coalesce(p.fim, p.inicio + make_interval(secs => coalesce(p.segundos, 0))), s.fim_calc) as fim
  from public.defcon_pausas p
  join sess_w s on s.id = p.session_id
  where p.user_id = p_user and p.inicio is not null
),
pz_ord as (
  select pz.*, max(fim) over (partition by session_id order by inicio rows between unbounded preceding and 1 preceding) as prev_max
  from pz where fim > inicio
),
pz_grp as (
  select pz_ord.*, sum(case when prev_max is null or inicio > prev_max then 1 else 0 end) over (partition by session_id order by inicio, fim) as grp
  from pz_ord
),
pz_merged as (
  select session_id, grp, min(inicio) as ini, max(fim) as fim from pz_grp group by session_id, grp
),
pz_sess as (
  select session_id, sum(extract(epoch from (fim - ini))) / 60 as pmin from pz_merged group by session_id
),
pz_motivo as (
  select motivo, count(*)::int as n, (sum(extract(epoch from (fim - inicio))) / 60)::numeric as minutos
  from pz where fim > inicio group by motivo
),
sess_r as (
  select s.*, coalesce(ps.pmin, coalesce(s.paused_seconds, 0) / 60.0)::numeric as praw
  from sess_w s left join pz_sess ps on ps.session_id = s.id
),
sess_t as (
  select r.*,
    (case when r.wall > 0 then greatest(r.wmin, least(r.wall, r.wmin + r.praw)) else r.wmin end)::numeric as street
  from sess_r r
),
sess_p as (
  select t.*, least(t.praw, t.street)::numeric as pmin from sess_t t
),
vd as (
  select d.session_id, d.created_at, d.amount, d.method, s.date
  from public.defcon_sales d
  join sess s on s.id = d.session_id
  where d.user_id = p_user and d.method <> 'gorjeta' and not coalesce(d.late, false)
),
gj as (
  select d.amount
  from public.defcon_sales d join sess s on s.id = d.session_id
  where d.user_id = p_user and d.method = 'gorjeta'
),
fim_rua as (
  select s.id as session_id,
         greatest(least(s.fim_calc, s.started_at + make_interval(secs => (s.street * 60)::double precision)),
                  coalesce((select max(v.created_at) from vd v where v.session_id = s.id), s.started_at)) as t
  from sess_p s where s.started_at is not null
),
pts as (
  select id as session_id, started_at as t from sess where started_at is not null
  union all select session_id, created_at from vd
  union all select session_id, t from fim_rua
),
gaps as (
  select session_id, extract(epoch from (lead(t) over (partition by session_id order by t) - t)) / 60 as g from pts
),
idle_sess as (
  select session_id, sum(g - 20) as gmin from gaps where g >= 20 group by session_id
),
sess_f as (
  select s.*, least(greatest(0, s.street - s.pmin), greatest(0, coalesce(i.gmin, 0) - s.pmin))::numeric as parado
  from sess_p s left join idle_sess i on i.session_id = s.id
),
blk as (
  select b.session_id, s.date, b.started_at, coalesce(b.approaches_count, 0) as ab
  from public.challenge_blocks b join sess s on s.id = b.session_id
  where b.user_id = p_user
),
-- a day counts for conversion only when approaches were tapped: sales < 90% of approaches
-- (prod 30d: smooth curve up to 89%, then a spike of 159 days at exactly 100%)
dia_conv as (
  select d.date,
         coalesce((select sum(ab) from blk where blk.date = d.date), 0) as ab,
         coalesce((select count(*) from vd where vd.date = d.date), 0) as n
  from (select distinct date from sess) d
),
conv_ok as (select date from dia_conv where ab > 0 and n < ab * 0.9),
ds as (
  select * from public.daily_sales where user_id = p_user and date between p_de and p_ate
),
ex as (
  select amount,
    case when lower(coalesce(category, '')) like '%mercadoria%' then 'mercadoria'
         when lower(coalesce(category, '')) like '%transporte%' or lower(coalesce(category, '')) like '%combust%' then 'transporte'
         when lower(coalesce(category, '')) like '%aliment%' or lower(coalesce(category, '')) like '%almoc%'
           or lower(coalesce(category, '')) like '%almoç%' or lower(coalesce(category, '')) like '%lanche%' then 'alimentacao'
         else 'outros' end as cat
  from public.personal_expenses where user_id = p_user and date between p_de and p_ate
),
lp as (
  select amount from public.late_pix_entries where user_id = p_user and sale_date between p_de and p_ate
),
dias_all as (
  select date as d from sess where coalesce(worked_minutes, 0) > 0 or started_at is not null
  union select date from ds where coalesce(total_profit, 0) + coalesce(total_debt, 0) > 0
),
dia_rows as (
  select da.d,
    coalesce((select sum(ab) from blk where blk.date = da.d), 0)::int as abordagens,
    coalesce((select count(*) from vd where vd.date = da.d), 0)::int as vendas,
    exists (select 1 from conv_ok c where c.date = da.d) as conv_ok,
    coalesce((select sum(total_profit) from ds where ds.date = da.d), 0)::numeric as caiu,
    coalesce((select sum(total_debt) from ds where ds.date = da.d), 0)::numeric as faltou,
    coalesce((select sum(street) from sess_f where sess_f.date = da.d), 0)::numeric as worked_min,
    coalesce((select sum(pmin) from sess_f where sess_f.date = da.d), 0)::numeric as pausa_min,
    coalesce((select sum(parado) from sess_f where sess_f.date = da.d), 0)::numeric as parado_min
  from dias_all da
),
hora_rows as (
  select h,
    coalesce((select count(*) from vd where extract(hour from vd.created_at at time zone 'America/Sao_Paulo') = h), 0)::int as vendas,
    coalesce((select sum(amount) from vd where extract(hour from vd.created_at at time zone 'America/Sao_Paulo') = h), 0)::numeric as valor,
    coalesce((select sum(ab) from blk where blk.started_at is not null and extract(hour from blk.started_at at time zone 'America/Sao_Paulo') = h), 0)::int as abordagens,
    coalesce((select count(*) from vd where vd.date in (select date from conv_ok) and extract(hour from vd.created_at at time zone 'America/Sao_Paulo') = h), 0)::int as vendas_conv,
    coalesce((select sum(ab) from blk where blk.date in (select date from conv_ok) and blk.started_at is not null and extract(hour from blk.started_at at time zone 'America/Sao_Paulo') = h), 0)::int as abordagens_conv
  from generate_series(0, 23) as h
),
tot as (
  select
    (select count(*) from dia_rows where worked_min > 0 or vendas > 0 or caiu > 0) as dias_na_rua,
    (select count(*) from ds) as dias_com_registro,
    (select coalesce(sum(total_profit), 0) from ds)::numeric as caiu,
    (select coalesce(sum(total_debt), 0) from ds)::numeric as faltou,
    (select coalesce(sum(cash_sales), 0) from ds)::numeric as dinheiro,
    (select coalesce(sum(pix_sales), 0) from ds)::numeric as pix,
    (select coalesce(sum(card_sales), 0) from ds)::numeric as cartao,
    (select coalesce(sum(tip_sales), 0) from ds)::numeric as gorjetas_dia,
    (select coalesce(sum(unpaid_units), 0) from ds)::int as calote_unid,
    ((select coalesce(sum(cost), 0) from ds) + (select coalesce(sum(amount), 0) from ex where cat = 'mercadoria'))::numeric as mercadoria,
    ((select coalesce(sum(transport_cost), 0) from ds) + (select coalesce(sum(amount), 0) from ex where cat = 'transporte'))::numeric as transporte,
    ((select coalesce(sum(food_cost), 0) from ds) + (select coalesce(sum(amount), 0) from ex where cat = 'alimentacao'))::numeric as alimentacao,
    (select coalesce(sum(amount), 0) from ex where cat = 'outros')::numeric as outros,
    (select coalesce(sum(amount), 0) from lp)::numeric as recuperado,
    (select count(*) from lp)::int as recuperado_n,
    (select coalesce(sum(ab), 0) from blk)::int as abordagens,
    (select coalesce(sum(ab), 0) from dia_conv where date in (select date from conv_ok))::int as abordagens_conv,
    (select coalesce(sum(n), 0) from dia_conv where date in (select date from conv_ok))::int as vendas_conv,
    (select count(*) from vd)::int as vendas,
    (select coalesce(sum(amount), 0) from vd)::numeric as vendas_valor,
    (select count(*) from gj)::int as gorjeta_n,
    (select coalesce(sum(amount), 0) from gj)::numeric as gorjeta_total,
    (select coalesce(max(amount), 0) from gj)::numeric as gorjeta_max,
    (select coalesce(sum(street), 0) from sess_f)::numeric as worked_min,
    (select coalesce(sum(pmin), 0) from sess_f)::numeric as pausa_min,
    (select coalesce(sum(parado), 0) from sess_f)::numeric as parado_min
)
select jsonb_build_object(
  'de', p_de, 'ate', p_ate,
  'dias_na_rua', t.dias_na_rua,
  'dias_com_registro', t.dias_com_registro,
  'dinheiro', jsonb_build_object(
    'caiu', t.caiu, 'faltou', t.faltou, 'vendeu', t.caiu + t.faltou,
    'dinheiro', t.dinheiro, 'pix', t.pix, 'cartao', t.cartao, 'gorjetas_dia', t.gorjetas_dia,
    'mercadoria', t.mercadoria, 'transporte', t.transporte, 'alimentacao', t.alimentacao, 'outros', t.outros,
    'gastos', t.mercadoria + t.transporte + t.alimentacao + t.outros,
    'sobrou', t.caiu - (t.mercadoria + t.transporte + t.alimentacao + t.outros)
  ),
  'vendas', jsonb_build_object(
    'abordagens', t.abordagens, 'vendas', t.vendas, 'valor', t.vendas_valor,
    'abordagens_conv', t.abordagens_conv, 'vendas_conv', t.vendas_conv,
    'conversao', case when t.abordagens_conv > 0 then round(t.vendas_conv::numeric / t.abordagens_conv * 100, 1) else null end,
    'abordagens_por_venda', case when t.vendas_conv > 0 then round(t.abordagens_conv::numeric / t.vendas_conv, 2) else null end,
    'ticket', case when t.vendas > 0 then round(t.vendas_valor / t.vendas, 2) else null end,
    'metodos', (select coalesce(jsonb_object_agg(method, jsonb_build_object('n', n, 'valor', valor)), '{}'::jsonb)
                from (select method, count(*)::int as n, sum(amount)::numeric as valor from vd group by method) m),
    'gorjeta', jsonb_build_object('n', t.gorjeta_n, 'total', t.gorjeta_total, 'maior', t.gorjeta_max)
  ),
  'tempo', jsonb_build_object(
    'worked_min', round(t.worked_min), 'pausa_min', round(t.pausa_min), 'parado_min', round(t.parado_min),
    'ativo_min', round(greatest(0, t.worked_min - t.pausa_min - t.parado_min)),
    'pausas', (select coalesce(jsonb_object_agg(motivo, jsonb_build_object('n', n, 'min', round(minutos))), '{}'::jsonb) from pz_motivo),
    'maior_dia', (select jsonb_build_object('dia', d, 'min', round(worked_min)) from dia_rows where worked_min > 0 order by worked_min desc, d limit 1),
    'menor_dia', (select jsonb_build_object('dia', d, 'min', round(worked_min)) from dia_rows where worked_min > 0 order by worked_min asc, d limit 1),
    'melhor_ritmo', (select jsonb_build_object('dia', d, 'min', round((worked_min - pausa_min - parado_min) / vendas, 1))
                     from dia_rows where vendas > 0 and worked_min - pausa_min - parado_min > 0
                     order by (worked_min - pausa_min - parado_min) / vendas asc, d limit 1)
  ),
  'calote', jsonb_build_object(
    'valor', t.faltou + t.recuperado, 'unidades', t.calote_unid, 'recuperado', t.recuperado, 'recuperado_n', t.recuperado_n,
    'perdido', t.faltou,
    'pct_vendeu', case when t.caiu + t.faltou > 0 then round((t.faltou + t.recuperado) / (t.caiu + t.faltou) * 100, 1) else 0 end,
    'taxa_recuperacao', case when t.faltou + t.recuperado > 0 then round(t.recuperado / (t.faltou + t.recuperado) * 100, 0) else null end
  ),
  'dias', (select coalesce(jsonb_agg(jsonb_build_object(
             'dia', d, 'abordagens', abordagens, 'vendas', vendas, 'conv_ok', conv_ok, 'caiu', caiu, 'faltou', faltou,
             'worked_min', round(worked_min), 'pausa_min', round(pausa_min), 'parado_min', round(parado_min)) order by d), '[]'::jsonb)
           from dia_rows),
  'horas', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'vendas', vendas, 'valor', valor, 'abordagens', abordagens,
                                                          'vendas_conv', vendas_conv, 'abordagens_conv', abordagens_conv) order by h), '[]'::jsonb)
            from hora_rows where vendas > 0 or abordagens > 0)
)
from tot t;
$function$;
