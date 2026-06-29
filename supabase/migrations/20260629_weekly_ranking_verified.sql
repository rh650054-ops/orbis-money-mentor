-- ============================================================================
-- Ranking SEMANAL VERIFICADO (o que o desafio R$100 promete).
-- Regra por dia, por vendedor:
--   - se tem EXTRATO daquele dia -> usa o total VERIFICADO (so card+pix que entrou)
--   - se NAO tem extrato -> usa o card+pix do daily_sales (DEFCON ao vivo)
-- Dinheiro vivo NUNCA entra (nem no extrato, nem no ao vivo).
-- O extrato SUBSTITUI o ao vivo do dia (a IA ja auditou e tirou suspeita/duplicata).
--
-- Mesma saida do get_weekly_ranking (faturamento_semana, dias_semana) pra reaproveitar
-- o hook/UI. Respeita profiles.ranking_hidden. SECURITY DEFINER.
--
-- Como usar: cole TUDO no Supabase -> SQL Editor -> Run.
-- ============================================================================
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date)
returns table (
  user_id            uuid,
  nome_usuario       text,
  avatar_url         text,
  faturamento_semana numeric,
  dias_semana        integer
)
language sql
security definer
set search_path = public
as $$
  with ext as (
    -- total verificado por usuario+dia (soma os slots pix e cartao)
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  live as (
    -- card+pix do DEFCON por usuario+dia (dinheiro fora)
    select ds.user_id, ds.date::date as d,
           sum(coalesce(ds.card_sales, 0) + coalesce(ds.pix_sales, 0))::numeric as val
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  merged as (
    -- por dia: extrato manda; se nao tem extrato, vale o ao vivo
    select
      coalesce(e.user_id, l.user_id) as user_id,
      case when e.user_id is not null then e.val else coalesce(l.val, 0) end as val
    from ext e
    full outer join live l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id,
           sum(m.val)::numeric as faturamento,
           count(*) filter (where m.val > 0)::integer as dias
    from merged m
    group by m.user_id
  )
  select
    a.user_id,
    coalesce(pp.nickname, '')   as nome_usuario,
    coalesce(pp.avatar_url, '') as avatar_url,
    a.faturamento              as faturamento_semana,
    a.dias                     as dias_semana
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;

grant execute on function public.get_weekly_ranking_verified(date, date) to anon, authenticated;
