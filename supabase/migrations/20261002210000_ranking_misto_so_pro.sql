-- ============================================================
-- RANKING MISTO SÓ PARA PRO — 02/10/2026
--   Pedido do Rick: o Pix do banco só substitui o lançado para quem tem o
--   Vant Pro ativo. Quem ligou banco sem ser Pro continua na regra antiga
--   (o que lançou no DEFCON). Mesma assinatura; só muda o CTE `bancos`.
-- ============================================================
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table (user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql security definer set search_path to 'public' as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  -- quem tem banco: desde quando o Pix do banco manda (nunca antes de 02/10/2026)
  bancos as (
    select bc.user_id,
           greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), date '2026-10-02') as desde,
           bool_or(upper(coalesce(bc.status, '')) in ('UPDATED', 'UPDATING', 'LOGIN_IN_PROGRESS', 'CONNECTED')) as saudavel
    from bank_connections bc
    where coalesce(bc.status, '') <> 'deleted'
      and public.orbis_pro_ativo(bc.user_id)   -- só Pro ativo (Rick, 02/10): o resto segue a regra antiga
    group by bc.user_id
  ),
  pixb as (
    select b.user_id, x.dia as d, x.total as val
    from bancos b
    cross join lateral public.banco_pix_por_dia(b.user_id, greatest(p_week_start, b.desde), p_week_end) x
    where greatest(p_week_start, b.desde) <= p_week_end
  ),
  declarado as (
    select ds.user_id, ds.date::date as d,
           sum(coalesce(ds.total_profit, 0))::numeric as val   -- valor CHEIO: cartão+pix+dinheiro
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  -- dia "pelo banco": tem banco, já valia nesse dia, e (leu Pix nesse dia OU o banco está saudável)
  live as (
    select p.user_id, p.d, p.val from pixb p
    union all
    select dc.user_id, dc.d, dc.val
    from declarado dc
    left join bancos b on b.user_id = dc.user_id
    where b.user_id is null
       or dc.d < b.desde
       or (not b.saudavel and not exists (select 1 from pixb p where p.user_id = dc.user_id and p.d = dc.d))
  ),
  live_dia as (
    select l.user_id, l.d, sum(l.val)::numeric as val from live l group by l.user_id, l.d
  ),
  merged as (
    select
      coalesce(e.user_id, l.user_id) as user_id,
      case when p_usar_extrato then coalesce(e.val, 0) else coalesce(l.val, 0) end as val
    from ext e
    full outer join live_dia l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id, sum(m.val)::numeric as faturamento, count(*) filter (where m.val > 0)::integer as dias
    from merged m
    group by m.user_id
  )
  select a.user_id,
         coalesce(pp.nickname, '')   as nome_usuario,
         coalesce(pp.avatar_url, '') as avatar_url,
         a.faturamento               as faturamento_semana,
         a.dias                      as dias_semana
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and coalesce(pr.ranking_oculto, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;
