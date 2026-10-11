-- ============================================================
-- CÉREBRO: META VIÁVEL + PLANO MÁXIMO — 11/10/2026
--
-- Rick (11/10 02:40): o sonho do mês fica; a meta de cada dia nasce do ritmo
-- real dele. Quando o mês sai do ritmo, em vez de pedir pra baixar a meta, o
-- app monta o PLANO MÁXIMO (dias que ele pode esticar + blocos a mais, em
-- vendas por dia pelo ticket dele) e deixa o REALISTA como segunda opção.
-- Conta nova: dia 1 vale a meta manual; do 2º dia em diante a Vant aprende.
-- Tudo roda no cérebro (orbis_cerebro_noturno) e fica em metas_dia; o app só lê.
--
-- A conta de cada dia:
--   ritmo      = mediana do mesmo dia da semana (8 semanas, até 6 amostras)
--                misturada com a mediana geral dos últimos 14 dias trabalhados
--                (0,6/0,4 com 3+ amostras do dia; 0,3/0,7 com 1–2; só geral com 0)
--   precisa    = (sonho − vendido no mês antes de hoje) ÷ dias de trabalho que faltam
--   meta       = precisa, travada entre o ritmo (folga) e 1,3× o ritmo (inviável)
--   faixas     = Mínimo 80% · Meta 100% · Turbo 120%
--   máximo     = dias extras (melhores dias de folga primeiro, até 6 dias/semana) + até
--                2 blocos a mais por dia, até alcançar o sonho; senão, o mais perto possível
--   realista   = ritmo turbo (1,2×) nos dias que já trabalha
-- Idempotente, sem comandos de apagar.
-- ============================================================

create table if not exists public.metas_dia (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  ritmo numeric not null,
  amostra_dia integer not null default 0,
  precisa_dia numeric not null,
  dias_restantes integer not null,
  vendido_mes numeric not null,
  meta_mensal numeric not null,
  falta_mes numeric not null,
  meta numeric not null,
  minimo numeric not null,
  turbo numeric not null,
  status text not null,
  mes_viavel numeric not null,
  ticket numeric,
  plano_maximo jsonb,
  curva jsonb,
  calculada_em timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.metas_dia enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'metas_dia' and policyname = 'metas_dia_ver_a_propria') then
    create policy metas_dia_ver_a_propria on public.metas_dia for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
revoke insert, update, delete on public.metas_dia from anon, authenticated;

-- dias de trabalho de p_de (inclusive) até o fim do mês
create or replace function public.meta_dias_de_trabalho(p_de date, p_dias text[], p_incluir_hoje boolean default true)
returns integer language sql immutable set search_path to 'public' as $$
  select count(*)::int
    from generate_series(case when p_incluir_hoje then p_de else p_de + 1 end,
                         (date_trunc('month', p_de) + interval '1 month - 1 day')::date, '1 day') d
   where lower(trim(to_char(d, 'day'))) = any (select lower(x) from unnest(coalesce(p_dias, '{}')) x);
$$;

create or replace function public.vant_meta_calcular(p_user uuid, p_dia date)
returns public.metas_dia
language plpgsql security definer set search_path to 'public' as $$
declare
  v_meta_mensal numeric; v_horas int; v_dias text[]; v_base numeric;
  v_vendido_mes numeric; v_ritmo numeric; v_amostra int := 0; v_aprendendo boolean := false;
  v_geral numeric; v_do_dia numeric; n_trab int;
  v_hoje_trabalha boolean; v_dias_rest int; v_falta numeric; v_precisa numeric;
  v_status text; v_meta numeric; v_ticket numeric; v_curva jsonb;
  v_cap numeric; v_proj numeric; v_n int; k int; v_extras text[] := '{}'; v_cands text[];
  v_blocos_extra int; v_valor_bloco numeric; v_maximo jsonb; v_chega boolean := false;
  v_dow_nome text := lower(trim(to_char(p_dia, 'day')));
  r public.metas_dia;
begin
  select coalesce(monthly_goal, 0), least(16, greatest(1, coalesce(goal_hours, 8))),
         coalesce(working_days, '{}'), coalesce(base_daily_goal, 200)
    into v_meta_mensal, v_horas, v_dias, v_base
    from public.profiles where user_id = p_user;
  if v_meta_mensal is null then return null; end if;
  if coalesce(array_length(v_dias, 1), 0) = 0 then v_dias := '{monday,tuesday,wednesday,thursday,friday,saturday}'; end if;

  select coalesce(sum(coalesce(total_profit, 0) + coalesce(total_debt, 0)), 0) into v_vendido_mes
    from public.daily_sales where user_id = p_user and date >= date_trunc('month', p_dia)::date and date < p_dia;

  -- ritmo
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

  -- ticket: ficha do cérebro, senão mediana das vendas de 30 dias
  select f.ticket into v_ticket from public.orbis_ficha f where f.user_id = p_user;
  if v_ticket is null or v_ticket <= 0 then
    select round((percentile_cont(0.5) within group (order by x.amount))::numeric, 2) into v_ticket
      from public.defcon_sales x join public.challenge_sessions s on s.id = x.session_id
     where x.user_id = p_user and x.amount > 0 and x.amount <= 5000 and s.date > p_dia - 30;
  end if;

  -- curva de hora: média por bloco (45 dias)
  select coalesce(jsonb_agg(round(media, 2) order by hour_index), '[]'::jsonb) into v_curva
    from (select b.hour_index, avg(coalesce(b.valor_dinheiro, 0) + coalesce(b.valor_cartao, 0) + coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0)) as media
            from public.hourly_goal_blocks b join public.daily_goal_plans p on p.id = b.plan_id
           where p.user_id = p_user and p.date >= p_dia - 45 and p.date < p_dia
           group by b.hour_index having count(*) >= 3) c;

  -- plano máximo: dias de folga (melhores primeiro) + até 2 blocos a mais
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
  -- esticar no máximo até 6 dias por semana: um dia de folga fica
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
                                     meta, minimo, turbo, status, mes_viavel, ticket, plano_maximo, curva, calculada_em)
  values (p_user, p_dia, v_ritmo, v_amostra, v_precisa, v_dias_rest, v_vendido_mes, v_meta_mensal, v_falta,
          v_meta, round(v_meta * 0.8 / 10) * 10, round(v_meta * 1.2 / 10) * 10, v_status,
          round((v_vendido_mes + v_ritmo * 1.2 * v_dias_rest) / 100) * 100, v_ticket, v_maximo, v_curva, now())
  on conflict (user_id, dia) do update
     set ritmo = excluded.ritmo, amostra_dia = excluded.amostra_dia, precisa_dia = excluded.precisa_dia,
         dias_restantes = excluded.dias_restantes, vendido_mes = excluded.vendido_mes, meta_mensal = excluded.meta_mensal,
         falta_mes = excluded.falta_mes, meta = excluded.meta, minimo = excluded.minimo, turbo = excluded.turbo,
         status = excluded.status, mes_viavel = excluded.mes_viavel, ticket = excluded.ticket,
         plano_maximo = excluded.plano_maximo, curva = excluded.curva, calculada_em = now()
  returning * into r;
  return r;
end $$;
revoke all on function public.vant_meta_calcular(uuid, date) from public, anon, authenticated;

-- o app: a meta de hoje (calcula na hora se o cérebro ainda não passou)
create or replace function public.meta_do_dia(p_dia date default null)
returns public.metas_dia language plpgsql security definer set search_path to 'public' as $$
declare d date := coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date); r public.metas_dia;
begin
  if auth.uid() is null then return null; end if;
  select * into r from public.metas_dia where user_id = auth.uid() and dia = d;
  if r.user_id is null or r.calculada_em < now() - interval '12 hours' then
    r := public.vant_meta_calcular(auth.uid(), d);
  end if;
  return r;
end $$;
revoke all on function public.meta_do_dia(date) from public, anon;
grant execute on function public.meta_do_dia(date) to authenticated;

-- o app: escolheu um caminho no replanejamento
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

  if p_tipo = 'maximo' then
    select coalesce(array_agg(x), '{}') into extras from jsonb_array_elements_text(coalesce(r.plano_maximo -> 'dias_extra', '[]'::jsonb)) x;
    blocos := coalesce((r.plano_maximo ->> 'blocos')::int, 8);
    select coalesce(working_days, '{}') into v_dias from public.profiles where user_id = u;
    update public.profiles
       set working_days = (select array_agg(distinct y) from unnest(v_dias || extras) y),
           weekly_work_days = (select count(distinct y) from unnest(v_dias || extras) y),
           goal_hours = blocos
     where user_id = u;
  elsif p_tipo = 'realista' then
    update public.profiles set monthly_goal = r.mes_viavel where user_id = u;
  end if;
  -- 'manter': nada muda no perfil

  r := public.vant_meta_calcular(u, d);

  -- o plano de hoje acompanha, se o DEFCON ainda não começou
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

-- cérebro: todo mundo que vendeu nos últimos 45 dias ganha a meta de hoje
create or replace function public.orbis_metas_recalcular()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; u uuid; n int := 0;
begin
  for u in
    select distinct ds.user_id from public.daily_sales ds
     where ds.date >= hoje - 45 and coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) > 0
  loop
    begin
      perform public.vant_meta_calcular(u, hoje);
      -- plano de hoje (criado ontem à noite ou pelo app) segue a meta nova se o DEFCON não começou
      update public.daily_goal_plans p
         set daily_goal = m.meta, hourly_goal = m.meta / greatest(1, p.work_hours)
        from public.metas_dia m
       where m.user_id = u and m.dia = hoje and p.user_id = u and p.date = hoje and m.status <> 'aprendendo'
         and not exists (select 1 from public.challenge_sessions cs where cs.user_id = u and cs.date = hoje and cs.started_at is not null);
      n := n + 1;
    exception when others then
      raise notice 'metas: % %', u, sqlerrm;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.orbis_metas_recalcular() from public, anon, authenticated;

create or replace function public.orbis_cerebro_noturno()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_catalog' as $$
declare f int; p jsonb; m jsonb; g int;
begin
  f := public.orbis_ficha_recalcular();
  p := public.orbis_padroes_recalcular();
  m := public.orbis_minerar_dados();
  g := public.orbis_metas_recalcular();
  return jsonb_build_object('fichas', f, 'padroes', p, 'numeros', m, 'metas', g, 'em', now());
end;
$$;
