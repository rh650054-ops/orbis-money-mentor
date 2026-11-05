-- 04/11/2026 — audit findings (security + admin panel).
-- 1) orbis_cofre(p_user) was SECURITY DEFINER and callable by any logged-in user with ANY
--    p_user, returning that vendor's sales summary (orbis_ficha). Nothing in the app or the
--    edge functions calls it. Now: a non-admin always gets his OWN data, and only
--    service_role (server) can execute it at all.
create or replace function public.orbis_cofre(p_user uuid default null::uuid)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_user uuid := case when auth.uid() is null or public.is_orbis_admin() then coalesce(p_user, auth.uid()) else auth.uid() end;
  v_doutrina text;
  v_ficha text;
begin
  select coalesce(left(string_agg('### ' || titulo || E'\n' || conteudo, E'\n\n' order by ordem, id), 22000), '')
    into v_doutrina
  from public.ai_conhecimento where ativo = true;

  if v_user is not null then
    select f.resumo into v_ficha from public.orbis_ficha f where f.user_id = v_user;
  end if;

  return v_doutrina
    || case when v_ficha is not null and v_ficha <> ''
         then E'\n\n### ESTE VENDEDOR, ESPECIFICAMENTE\n' || v_ficha
              || E'\n\nUse estes numeros. Fale COM ELE sobre O NUMERO DELE. '
              || 'Nunca compare com outros vendedores nem com a media da base — '
              || 'compare ele com ele mesmo. Os dados da base servem pra voce saber '
              || 'o que costuma funcionar, nao pra jogar na cara dele.'
         else '' end;
end;
$function$;
revoke all on function public.orbis_cofre(uuid) from public, anon, authenticated;
grant execute on function public.orbis_cofre(uuid) to service_role;

-- 2) defcon_anomaly_suspects compared daily_sales.date (date) with text → "operator does not
--    exist: date >= text" → the admin "suspeitos" panel has been empty. Same output, types fixed.
create or replace function public.defcon_anomaly_suspects(p_lookback integer default 21, p_min_ratio numeric default 1.8)
 returns table(user_id uuid, nome text, dia text, valor_hoje numeric, base_media numeric, ratio numeric, worked_min numeric, ritmo numeric)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_orbis_admin() then
    return; -- lista global = só admin
  end if;

  return query
  with base as (
    select ds.user_id,
           ds.date::text as dia,
           (coalesce(ds.card_sales, 0) + coalesce(ds.pix_sales, 0))::numeric as valor
    from daily_sales ds
    where ds.date >= current_date - p_lookback
  ),
  latest as (
    select distinct on (b.user_id) b.user_id, b.dia, b.valor as valor_hoje
    from base b
    order by b.user_id, b.dia desc
  ),
  media as (
    select b.user_id, avg(b.valor) as base_media
    from base b
    join latest l on l.user_id = b.user_id and b.dia <> l.dia
    group by b.user_id
  )
  select l.user_id,
         coalesce(pp.nickname, '') as nome,
         l.dia,
         l.valor_hoje,
         round(coalesce(m.base_media, 0), 2) as base_media,
         case when coalesce(m.base_media, 0) > 0 then round(l.valor_hoje / m.base_media, 2) else null end as ratio,
         round(coalesce(w.wmin, 0), 1) as worked_min,
         case when coalesce(v.qtd, 0) > 0 then round(coalesce(w.wmin, 0) / v.qtd, 1) else null end as ritmo
  from latest l
  join media m on m.user_id = l.user_id
  left join public_profiles pp on pp.user_id = l.user_id
  left join lateral (
    select sum(greatest(0, extract(epoch from (coalesce(cs.ended_at, cs.updated_at) - cs.started_at)) / 60.0)) as wmin
    from challenge_sessions cs where cs.user_id = l.user_id and cs.date::text = l.dia
  ) w on true
  left join lateral (
    select count(*) as qtd from defcon_sales s
    where s.user_id = l.user_id
      and ((s.created_at at time zone 'America/Sao_Paulo')::date)::text = l.dia
  ) v on true
  where coalesce(m.base_media, 0) > 0
    and l.valor_hoje >= m.base_media * p_min_ratio
  order by ratio desc nulls last;
end;
$function$;
