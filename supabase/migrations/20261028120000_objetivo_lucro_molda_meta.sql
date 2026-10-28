-- Profit mission shapes the day (Rick, 28/10/2026): "se ele define a meta de lucro, o app se molda
-- a essa meta — modo foco e tudo". While a profit mission is active, the daily goal the Foco/DEFCON
-- uses (metas_dia.meta) becomes the revenue the mission needs today:
--   profit still needed ÷ work days left  → units (÷ profit per unit) → revenue (× price per unit).
-- Nothing else changes: monthly goal, adaptive mode and the user's own planning stay as they are,
-- and when the mission ends (done, expired or aborted) the goal goes back to the planning.

alter table public.metas_dia add column if not exists missao jsonb;

-- What the active mission asks for on p_dia. Same math as objetivo_lucro_atual() ("Alvo de hoje"),
-- so the Foco and the mission card show the same number. Null when there is no active mission
-- covering the day or nothing is left to make.
create or replace function public.objetivo_lucro_meta_dia(p_user uuid, p_dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o objetivos_lucro%rowtype;
  v_valor numeric; v_unid numeric; v_dias int;
  v_lucro_antes numeric; v_rest int; v_precisa numeric; v_unid_meta numeric; v_preco numeric;
begin
  select * into o from objetivos_lucro
   where user_id = p_user and status = 'ativo' and p_dia between inicio and fim
   order by criado_em desc limit 1;
  if not found or coalesce(o.lucro_unid, 0) <= 0 then return null; end if;

  select coalesce(sum(amount), 0),
         coalesce(sum(case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end), 0),
         count(distinct (created_at at time zone 'America/Sao_Paulo')::date)
           filter (where method <> 'gorjeta' and not coalesce(late, false))
    into v_valor, v_unid, v_dias
    from defcon_sales
   where user_id = p_user
     and (created_at at time zone 'America/Sao_Paulo')::date >= o.inicio
     and (created_at at time zone 'America/Sao_Paulo')::date < p_dia;

  v_lucro_antes := v_valor - v_unid * o.custo_unid;
  v_rest := greatest(1, o.dias_trabalho - v_dias);
  v_precisa := greatest(0, o.alvo - v_lucro_antes) / v_rest;
  if v_precisa <= 0 then return null; end if;
  v_unid_meta := ceil(v_precisa / o.lucro_unid);
  v_preco := o.custo_unid + o.lucro_unid;

  return jsonb_build_object(
    'id', o.id, 'alvo', o.alvo, 'fim', o.fim,
    'lucro_feito', round(v_lucro_antes, 2), 'precisa_lucro', round(v_precisa, 2),
    'unid_meta', v_unid_meta, 'faturar', round(v_unid_meta * v_preco, 2),
    'produto', o.analise ->> 'produto_nome'
  );
end;
$$;

revoke all on function public.objetivo_lucro_meta_dia(uuid, date) from public, anon, authenticated;

-- vant_meta_calcular: unchanged except the mission override (marked "28/10").
create or replace function public.vant_meta_calcular(p_user uuid, p_dia date)
 returns metas_dia
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_meta_mensal numeric; v_horas int; v_dias text[]; v_base numeric;
  v_vendido_mes numeric; v_ritmo numeric; v_amostra int := 0; v_aprendendo boolean := false;
  v_geral numeric; v_do_dia numeric; n_trab int;
  v_hoje_trabalha boolean; v_dias_rest int; v_falta numeric; v_precisa numeric;
  v_status text; v_meta numeric; v_ticket numeric; v_curva jsonb;
  v_cap numeric; v_proj numeric; v_n int; k int; v_extras text[] := '{}'; v_cands text[];
  v_blocos_extra int; v_valor_bloco numeric; v_maximo jsonb; v_chega boolean := false;
  v_dow_nome text := lower(trim(to_char(p_dia, 'day')));
  v_adaptativa boolean := false; v_meta_adapt numeric;
  v_missao jsonb; v_faixa numeric;
  r public.metas_dia;
begin
  select coalesce(monthly_goal, 0), least(16, greatest(1, coalesce(goal_hours, 8))),
         coalesce(working_days, '{}'), coalesce(base_daily_goal, 200), coalesce(meta_adaptativa, false)
    into v_meta_mensal, v_horas, v_dias, v_base, v_adaptativa
    from public.profiles where user_id = p_user;
  if v_meta_mensal is null then return null; end if;
  if v_adaptativa and not public.vant_recursos_pro(p_user) then v_adaptativa := false; end if;  -- 25/10: adaptativa é do Pro
  if coalesce(array_length(v_dias, 1), 0) = 0 then v_dias := '{monday,tuesday,wednesday,thursday,friday,saturday}'; end if;

  select coalesce(sum(coalesce(total_profit, 0) + coalesce(total_debt, 0)), 0) into v_vendido_mes
    from public.daily_sales where user_id = p_user and date >= date_trunc('month', p_dia)::date and date < p_dia;

  with trab as (
    select date, coalesce(total_profit, 0) + coalesce(total_debt, 0) as v
      from public.daily_sales
     where user_id = p_user and date < p_dia and date >= p_dia - 56
       and coalesce(total_profit, 0) + coalesce(total_debt, 0) > 0
     order by date desc
  ),
  geral as (select percentile_cont(0.5) within group (order by v) as m from (select v from trab limit 14) t),
  dodia as (select percentile_cont(0.5) within group (order by v) as m, count(*)::int as n
              from (select v from trab where lower(trim(to_char(date, 'day'))) = v_dow_nome limit 6) t)
  select (select count(*) from trab), (select m from geral), (select m from dodia), (select n from dodia)
    into n_trab, v_geral, v_do_dia, v_amostra;

  if coalesce(n_trab, 0) < 1 then
    v_aprendendo := true; v_ritmo := round(greatest(50, v_base) / 10) * 10; v_amostra := 0;
  else
    v_ritmo := case when v_amostra >= 3 then 0.6 * v_do_dia + 0.4 * v_geral
                    when v_amostra > 0 then 0.3 * v_do_dia + 0.7 * v_geral
                    else v_geral end;
    v_ritmo := round(greatest(50, v_ritmo) / 10) * 10;
  end if;

  v_hoje_trabalha := v_dow_nome = any (select lower(x) from unnest(v_dias) x);
  v_dias_rest := greatest(case when v_hoje_trabalha then 1 else 0 end, public.meta_dias_de_trabalho(p_dia, v_dias, v_hoje_trabalha));
  v_falta := greatest(0, v_meta_mensal - v_vendido_mes);
  v_precisa := round((v_falta / greatest(1, v_dias_rest)) / 10) * 10;

  if v_aprendendo then
    v_status := 'aprendendo';
    v_meta := case when v_precisa > 0 then least(v_precisa, round(v_ritmo * 1.3 / 10) * 10) else v_ritmo end;
  elsif v_falta <= 0 or v_precisa <= v_ritmo then v_status := 'folga'; v_meta := v_ritmo;
  elsif v_precisa <= v_ritmo * 1.1 then v_status := 'no_ritmo'; v_meta := v_precisa;
  elsif v_precisa <= v_ritmo * 1.3 then v_status := 'apertado'; v_meta := v_precisa;
  else v_status := 'inviavel'; v_meta := round(v_ritmo * 1.3 / 10) * 10;
  end if;

  -- 25/10: o status acima é a análise (dá ou não dá). A meta que ele VÊ:
  --   padrão     = o que falta do mês ÷ dias de trabalho que faltam (a meta dele, sem trava)
  --   adaptativa = a meta pelo ritmo (acima), com Mínimo · Meta · Turbo
  v_meta_adapt := v_meta;
  if not v_adaptativa then
    v_meta := case
      when v_precisa > 0 then least(v_precisa, 50000)   -- meta do mês digitada errada (ex.: 10^16) não vira número absurdo
      when v_meta_mensal > 0 then greatest(10, round(v_meta_mensal
             / greatest(1, public.meta_dias_de_trabalho(date_trunc('month', p_dia)::date, v_dias, true)) / 10) * 10)
      else v_ritmo end;
  end if;

  -- 28/10: missão de lucro ativa → a meta do dia é o faturamento que a missão pede hoje.
  -- Mínimo/Turbo (modo adaptativo) passam a girar em torno dela.
  v_missao := public.objetivo_lucro_meta_dia(p_user, p_dia);
  v_faixa := v_meta_adapt;
  if v_missao is not null then
    v_meta := least(50000, ceil((v_missao ->> 'faturar')::numeric / 10) * 10);
    v_faixa := v_meta;
  end if;

  select f.ticket into v_ticket from public.orbis_ficha f where f.user_id = p_user;
  if v_ticket is null or v_ticket <= 0 then
    select round((percentile_cont(0.5) within group (order by x.amount))::numeric, 2) into v_ticket
      from public.defcon_sales x join public.challenge_sessions s on s.id = x.session_id
     where x.user_id = p_user and x.amount > 0 and x.amount <= 5000 and s.date > p_dia - 30;
  end if;

  select coalesce(jsonb_agg(round(media, 2) order by hour_index), '[]'::jsonb) into v_curva
    from (select b.hour_index, avg(coalesce(b.valor_dinheiro, 0) + coalesce(b.valor_cartao, 0) + coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0)) as media
            from public.hourly_goal_blocks b join public.daily_goal_plans p on p.id = b.plan_id
           where p.user_id = p_user and p.date >= p_dia - 45 and p.date < p_dia
           group by b.hour_index having count(*) >= 3) c;

  select coalesce(array_agg(d order by media desc nulls last, pref), '{}') into v_cands
    from (
      select n.d, n.pref,
             (select percentile_cont(0.5) within group (order by coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0))
                from public.daily_sales ds
               where ds.user_id = p_user and ds.date < p_dia and ds.date >= p_dia - 84
                 and coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) > 0
                 and lower(trim(to_char(ds.date, 'day'))) = n.d) as media
        from (values ('saturday', 1), ('friday', 2), ('sunday', 3), ('thursday', 4), ('wednesday', 5), ('tuesday', 6), ('monday', 7)) n(d, pref)
       where not (n.d = any (select lower(x) from unnest(v_dias) x))
    ) q;
  v_blocos_extra := least(2, 14 - v_horas);
  v_valor_bloco := (v_ritmo / v_horas) * 0.6;
  v_cap := round((v_ritmo * 1.3 + v_blocos_extra * v_valor_bloco) / 10) * 10;
  v_cands := v_cands[1:greatest(0, 6 - coalesce(array_length(v_dias, 1), 0))];
  k := 0;
  loop
    v_extras := v_cands[1:k];
    v_n := public.meta_dias_de_trabalho(p_dia, v_dias || v_extras, true);
    v_proj := v_vendido_mes + v_cap * v_n;
    v_chega := v_proj >= v_meta_mensal;
    exit when v_chega or k >= coalesce(array_length(v_cands, 1), 0);
    k := k + 1;
  end loop;
  v_maximo := jsonb_build_object(
    'dias_extra', to_jsonb(v_extras),
    'blocos', v_horas + v_blocos_extra,
    'meta_dia', v_cap,
    'dias_restantes', v_n,
    'projecao', round(v_proj / 100) * 100,
    'pct', least(999, round(100 * v_proj / nullif(v_meta_mensal, 0))),
    'chega', v_chega,
    'vendas_dia', case when v_ticket > 0 then ceil(v_cap / v_ticket) else null end,
    'vendas_hora', case when v_ticket > 0 then round(v_cap / v_ticket / (v_horas + v_blocos_extra), 1) else null end,
    'vendas_dia_realista', case when v_ticket > 0 then ceil(v_ritmo * 1.2 / v_ticket) else null end
  );

  insert into public.metas_dia as m (user_id, dia, ritmo, amostra_dia, precisa_dia, dias_restantes, vendido_mes, meta_mensal, falta_mes,
                                     meta, minimo, turbo, status, mes_viavel, ticket, plano_maximo, curva, calculada_em,
                                     modo, meta_adaptativa, dias_vendidos, missao)
  values (p_user, p_dia, v_ritmo, v_amostra, v_precisa, v_dias_rest, v_vendido_mes, v_meta_mensal, v_falta,
          v_meta, round(v_faixa * 0.8 / 10) * 10, round(v_faixa * 1.2 / 10) * 10, v_status,
          round((v_vendido_mes + v_ritmo * 1.2 * v_dias_rest) / 100) * 100, v_ticket, v_maximo, v_curva, now(),
          case when v_adaptativa then 'adaptativo' else 'padrao' end, v_meta_adapt, coalesce(n_trab, 0), v_missao)
  on conflict (user_id, dia) do update
     set ritmo = excluded.ritmo, amostra_dia = excluded.amostra_dia, precisa_dia = excluded.precisa_dia,
         dias_restantes = excluded.dias_restantes, vendido_mes = excluded.vendido_mes, meta_mensal = excluded.meta_mensal,
         falta_mes = excluded.falta_mes, meta = excluded.meta, minimo = excluded.minimo, turbo = excluded.turbo,
         status = excluded.status, mes_viavel = excluded.mes_viavel, ticket = excluded.ticket,
         plano_maximo = excluded.plano_maximo, curva = excluded.curva, calculada_em = now(),
         modo = excluded.modo, meta_adaptativa = excluded.meta_adaptativa, dias_vendidos = excluded.dias_vendidos,
         missao = excluded.missao
  returning * into r;
  return r;
end $function$;

-- Recalculate today's goal and, if today's DEFCON has not started, realign today's plan
-- (same rule as meta_replanejar, without touching the user's base_daily_goal).
create or replace function public.objetivo_lucro_aplicar_meta(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.metas_dia;
begin
  r := public.vant_meta_calcular(p_user, d);
  if r.user_id is null or coalesce(r.meta, 0) <= 0 then return; end if;
  if exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = d and cs.started_at is not null) then
    return;
  end if;
  update public.daily_goal_plans p set daily_goal = r.meta, hourly_goal = r.meta / greatest(1, p.work_hours)
   where p.user_id = p_user and p.date = d;
  update public.hourly_goal_blocks b set target_amount = r.meta / greatest(1, p.work_hours)
    from public.daily_goal_plans p where p.id = b.plan_id and p.user_id = p_user and p.date = d;
end;
$$;

revoke all on function public.objetivo_lucro_aplicar_meta(uuid) from public, anon, authenticated;

-- criar / excluir: same as before + apply the goal right away.
create or replace function public.objetivo_lucro_criar(p_alvo numeric, p_dias integer, p_dias_trabalho integer, p_ia jsonb default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  b jsonb; v_id uuid;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_alvo is null or p_alvo <= 0 or p_alvo > 1000000 then raise exception 'valor inválido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'prazo inválido'; end if;
  if p_dias_trabalho is null or p_dias_trabalho < 1 or p_dias_trabalho > p_dias then raise exception 'dias de trabalho inválidos'; end if;
  b := public.objetivo_lucro_base(u);
  if p_ia is not null then b := b || jsonb_build_object('ia', p_ia); end if;
  update objetivos_lucro set status = 'encerrado' where user_id = u and status = 'ativo';
  insert into objetivos_lucro (user_id, alvo, inicio, fim, dias_trabalho, custo_unid, lucro_unid, analise)
  values (u, round(p_alvo, 2), hoje, hoje + p_dias - 1, p_dias_trabalho,
          (b->>'custo_unid')::numeric,
          greatest(0, (b->>'ticket')::numeric - (b->>'custo_unid')::numeric), b)
  returning id into v_id;
  perform public.objetivo_lucro_aplicar_meta(u);  -- 28/10: the Foco takes the mission's goal now
  return v_id;
end;
$function$;

create or replace function public.objetivo_lucro_excluir(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  delete from objetivos_lucro where id = p_id and user_id = auth.uid();
  perform public.objetivo_lucro_aplicar_meta(auth.uid());  -- 28/10: goal goes back to the planning
end;
$function$;
