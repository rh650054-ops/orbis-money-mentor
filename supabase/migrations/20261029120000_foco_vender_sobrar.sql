-- ============================================================================
-- FOCO: VENDER × SOBRAR — 29/10/2026
-- Rick: "a meta do mês continua faturamento, mas o objetivo é ter o lucro no bolso".
-- 1) vant_sobrar_mes(): what the month left in the pocket so far, using the same
--    cost/calote reading the profit mission uses (objetivo_lucro_base), plus the
--    active mission's progress. The Foco shows it under the month goal.
-- 2) meta_replanejar: 'dias' (only the extra days) and 'blocos' (only more hours)
--    as separate choices; 'maximo' keeps doing both.
-- ============================================================================

create or replace function public.vant_sobrar_mes()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ini date := date_trunc('month', hoje)::date;
  b jsonb; m jsonb;
  v_preco numeric; v_unid numeric; v_vendas numeric; v_dias int;
  v_transp numeric; v_comida numeric; v_lucro_unid numeric; v_lucro_mes numeric;
begin
  if u is null then return null; end if;
  b := public.objetivo_lucro_base(u, null);
  v_lucro_unid := greatest(0, coalesce((b->>'ticket')::numeric, 0) - coalesce((b->>'custo_unid')::numeric, 0));
  v_preco := coalesce(nullif((b->>'preco_tabela')::numeric, 0), (b->>'ticket')::numeric);

  select coalesce(sum(public.vant_unid_inferida(amount, qty, product_id is not null, v_preco)), 0),
         coalesce(sum(amount), 0),
         count(distinct (created_at at time zone 'America/Sao_Paulo')::date)
    into v_unid, v_vendas, v_dias
  from defcon_sales
  where user_id = u and method <> 'gorjeta' and not coalesce(late, false)
    and (created_at at time zone 'America/Sao_Paulo')::date between ini and hoje;

  select coalesce(sum(transport_cost), 0), coalesce(sum(food_cost), 0) into v_transp, v_comida
  from daily_sales where user_id = u and date between ini and hoje;

  v_lucro_mes := v_unid * v_lucro_unid - v_transp - v_comida;
  m := public.objetivo_lucro_atual();

  return jsonb_build_object(
    'hoje', hoje,
    'vendas_mes', round(v_vendas, 2), 'unidades_mes', round(v_unid), 'dias_mes', v_dias,
    'lucro_unid', round(v_lucro_unid, 2), 'lucro_mes', round(v_lucro_mes, 2),
    'ticket', round(coalesce((b->>'ticket')::numeric, 0), 2),
    'fonte_custo', b->>'fonte_custo', 'produto_nome', b->>'produto_nome',
    'custo_corre_dia', case when v_dias > 0 then round((v_transp + v_comida) / v_dias, 2) else 0 end,
    'calote_pct', coalesce((b->'calote'->>'pct')::numeric, 0),
    'calote_unid', coalesce((b->>'calote_unid')::numeric, 0),
    'missao', case when m is null or jsonb_typeof(m) = 'null' then null else jsonb_build_object(
      'alvo', (m->>'alvo')::numeric, 'lucro', (m->>'lucro')::numeric,
      'dia', (m->>'dia_atual')::int, 'dias', (m->>'dias_periodo')::int) end);
end;
$function$;
revoke all on function public.vant_sobrar_mes() from public, anon;
grant execute on function public.vant_sobrar_mes() to authenticated;

create or replace function public.meta_replanejar(p_tipo text)
returns public.metas_dia language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.metas_dia; extras text[]; blocos int; v_dias text[];
begin
  if u is null then return null; end if;
  select * into r from public.metas_dia where user_id = u and dia = d;
  if r.user_id is null then r := public.vant_meta_calcular(u, d); end if;

  if p_tipo in ('maximo', 'dias') then
    select coalesce(array_agg(x), '{}') into extras from jsonb_array_elements_text(coalesce(r.plano_maximo -> 'dias_extra', '[]'::jsonb)) x;
    select coalesce(working_days, '{}') into v_dias from public.profiles where user_id = u;
    update public.profiles
       set working_days = (select array_agg(distinct y) from unnest(v_dias || extras) y),
           weekly_work_days = (select count(distinct y) from unnest(v_dias || extras) y)
     where user_id = u;
  end if;
  if p_tipo in ('maximo', 'blocos') then
    blocos := coalesce((r.plano_maximo ->> 'blocos')::int, 8);
    update public.profiles set goal_hours = blocos where user_id = u;
  end if;
  if p_tipo = 'realista' then
    update public.profiles set monthly_goal = r.mes_viavel where user_id = u;
  end if;
  -- 'manter' (subir o ritmo): nada muda no perfil

  r := public.vant_meta_calcular(u, d);

  if not exists (select 1 from public.challenge_sessions cs where cs.user_id = u and cs.date = d and cs.started_at is not null) then
    update public.daily_goal_plans p set daily_goal = r.meta, hourly_goal = r.meta / greatest(1, p.work_hours)
     where p.user_id = u and p.date = d;
    update public.hourly_goal_blocks b set target_amount = r.meta / greatest(1, p.work_hours)
      from public.daily_goal_plans p where p.id = b.plan_id and p.user_id = u and p.date = d;
    update public.profiles set base_daily_goal = r.meta where user_id = u;
  end if;
  return r;
end $$;
revoke all on function public.meta_replanejar(text) from public, anon;
grant execute on function public.meta_replanejar(text) to authenticated;
