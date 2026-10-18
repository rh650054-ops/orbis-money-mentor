-- ============================================================
-- RELATÓRIO (redesign 18/10/2026): one server-side aggregation per period.
--
-- Until now the Relatório screen downloaded ~10 tables and summed everything on
-- the phone (Insights.tsx, useMemo of ~150 lines). This moves the math to the
-- database:
--   relatorio_periodo(p_de, p_ate) -> jsonb  { atual, anterior, normal }
--     atual    = the period asked for
--     anterior = the previous period of the same length
--     normal   = the last 30 days ending at p_ate ("seu normal", the baseline)
-- Each block comes from relatorio_bloco(p_user, p_de, p_ate).
--
-- Rules kept from the old screen (same numbers as before):
--   caiu      = Σ daily_sales.total_profit (dinheiro + pix + cartão typed)
--   faltou    = Σ daily_sales.total_debt   (sold but not received = calote)
--   vendeu    = caiu + faltou
--   gastos    = daily_sales.cost/transport_cost/food_cost + personal_expenses by
--               category substring (mercadoria / transporte|combust / aliment|almoc|lanche)
--   recuperado = Σ late_pix_entries.amount (Pix that fell after the day)
--   worked_min = challenge_sessions.worked_minutes (fallback: wall clock capped
--               at blocks × 60), pauses = defcon_pausas merged per session,
--               capped at wall − worked (same as tempo-ocioso.ts)
-- Rules that change on purpose (decided with Rick 18/10):
--   vendas     = defcon_sales rows, EXCLUDING method='gorjeta' and late=true
--                (tips and late Pix were being counted as sales in ritmo/hours)
--   calote R$  = total_debt (the typed value), one number for the whole screen
--   parado     = inside a Foco session, the time beyond 20 min between sales
--                (gap − 20, so a normal 8–10 min cadence never counts), minus the
--                declared pauses. Tested on Rick's last 30 days: whole gaps ≥ 10 min
--                flagged 75% of the day; excess over 20 min gives 14% (pauses 16%),
--                which matches what he sees on the street. ("ocioso" used to be the
--                declared pauses only, while the label said "sem abordar".)
-- Bank adjustment (Pro + Open Finance) stays on the client via banco_conferencia,
-- exactly as before, so the money block does not change for anyone.
--
-- Security: relatorio_bloco takes a user id and is NOT callable by app roles.
-- relatorio_periodo is SECURITY DEFINER, uses auth.uid() only, and is the only
-- entry point for authenticated users. Nothing is writable.
-- ============================================================

create or replace function public.relatorio_bloco(p_user uuid, p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = public
as $$
with
sess as (
  select s.id, s.date, s.started_at, s.ended_at, s.worked_minutes, s.paused_seconds, s.current_block_index
  from public.challenge_sessions s
  where s.user_id = p_user and s.date between p_de and p_ate
),
sess_w as (
  select s.*,
    coalesce(s.ended_at, now()) as fim_calc,
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
sess_t as (
  select s.*,
    least(
      coalesce(ps.pmin, coalesce(s.paused_seconds, 0) / 60.0),
      case when s.started_at is not null and s.fim_calc > s.started_at
           then greatest(0, extract(epoch from (s.fim_calc - s.started_at)) / 60 - s.wmin)
           else coalesce(ps.pmin, coalesce(s.paused_seconds, 0) / 60.0) end
    )::numeric as pmin
  from sess_w s left join pz_sess ps on ps.session_id = s.id
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
pts as (
  select id as session_id, started_at as t from sess where started_at is not null
  union all select session_id, created_at from vd
  union all select id, ended_at from sess where ended_at is not null
),
gaps as (
  select session_id, extract(epoch from (lead(t) over (partition by session_id order by t) - t)) / 60 as g from pts
),
idle_sess as (
  -- "parado": time BEYOND 20 min between one sale and the next (or session start/end),
  -- so a normal 8-10 min cadence never counts. Declared pauses are subtracted below.
  select session_id, sum(g - 20) as gmin from gaps where g >= 20 group by session_id
),
sess_f as (
  select s.*, least(s.wmin, greatest(0, coalesce(i.gmin, 0) - s.pmin))::numeric as parado
  from sess_t s left join idle_sess i on i.session_id = s.id
),
blk as (
  select b.session_id, s.date, b.started_at, coalesce(b.approaches_count, 0) as ab
  from public.challenge_blocks b join sess s on s.id = b.session_id
  where b.user_id = p_user
),
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
    coalesce((select sum(total_profit) from ds where ds.date = da.d), 0)::numeric as caiu,
    coalesce((select sum(total_debt) from ds where ds.date = da.d), 0)::numeric as faltou,
    coalesce((select sum(wmin) from sess_f where sess_f.date = da.d), 0)::numeric as worked_min,
    coalesce((select sum(pmin) from sess_f where sess_f.date = da.d), 0)::numeric as pausa_min,
    coalesce((select sum(parado) from sess_f where sess_f.date = da.d), 0)::numeric as parado_min
  from dias_all da
),
hora_rows as (
  select h,
    coalesce((select count(*) from vd where extract(hour from vd.created_at at time zone 'America/Sao_Paulo') = h), 0)::int as vendas,
    coalesce((select sum(amount) from vd where extract(hour from vd.created_at at time zone 'America/Sao_Paulo') = h), 0)::numeric as valor,
    coalesce((select sum(ab) from blk where blk.started_at is not null and extract(hour from blk.started_at at time zone 'America/Sao_Paulo') = h), 0)::int as abordagens
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
    (select count(*) from vd)::int as vendas,
    (select coalesce(sum(amount), 0) from vd)::numeric as vendas_valor,
    (select count(*) from gj)::int as gorjeta_n,
    (select coalesce(sum(amount), 0) from gj)::numeric as gorjeta_total,
    (select coalesce(max(amount), 0) from gj)::numeric as gorjeta_max,
    (select coalesce(sum(wmin), 0) from sess_f)::numeric as worked_min,
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
    'conversao', case when t.abordagens > 0 then round(t.vendas::numeric / t.abordagens * 100, 1) else null end,
    'abordagens_por_venda', case when t.vendas > 0 then round(t.abordagens::numeric / t.vendas, 2) else null end,
    'ticket', case when t.vendas > 0 then round(t.caiu / t.vendas, 2) else null end,
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
    'valor', t.faltou, 'unidades', t.calote_unid, 'recuperado', t.recuperado, 'recuperado_n', t.recuperado_n,
    'perdido', greatest(0, t.faltou - t.recuperado),
    'pct_vendeu', case when t.caiu + t.faltou > 0 then round(t.faltou / (t.caiu + t.faltou) * 100, 1) else 0 end,
    'taxa_recuperacao', case when t.faltou > 0 then round(least(100, t.recuperado / t.faltou * 100), 0) else null end
  ),
  'dias', (select coalesce(jsonb_agg(jsonb_build_object(
             'dia', d, 'abordagens', abordagens, 'vendas', vendas, 'caiu', caiu, 'faltou', faltou,
             'worked_min', round(worked_min), 'pausa_min', round(pausa_min), 'parado_min', round(parado_min)) order by d), '[]'::jsonb)
           from dia_rows),
  'horas', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'vendas', vendas, 'valor', valor, 'abordagens', abordagens) order by h), '[]'::jsonb)
            from hora_rows where vendas > 0 or abordagens > 0)
)
from tot t;
$$;

revoke all on function public.relatorio_bloco(uuid, date, date) from public, anon, authenticated;

create or replace function public.relatorio_periodo(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  n int;
begin
  if u is null or p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then
    return null;
  end if;
  n := p_ate - p_de + 1;
  return jsonb_build_object(
    'atual',    public.relatorio_bloco(u, p_de, p_ate),
    'anterior', public.relatorio_bloco(u, p_de - n, p_de - 1),
    'normal',   public.relatorio_bloco(u, p_ate - 29, p_ate)
  );
end;
$$;

revoke all on function public.relatorio_periodo(date, date) from public, anon;
grant execute on function public.relatorio_periodo(date, date) to authenticated;
