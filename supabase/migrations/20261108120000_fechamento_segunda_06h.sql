-- ============================================================================
-- Weekly closing, official rule (Rick, 08/11/2026 05:19):
--   • competition week = Monday 00:00 → Sunday 23:59:59, America/Sao_Paulo
--     (transition: the first official week is Sunday 01/11 → Sunday 08/11, 8 days);
--   • between Sunday 23:59:59 and Monday 06:00 the banks are reconciled (pluggy-dia 03:20);
--   • the closing runs Monday at 06:00; Monday sales already belong to the new week;
--   • late bank credits keep their real date (transaction_date already does that);
--   • cash stays out of the competitive ranking (ranking_valor_dias already subtracts it);
--   • the monthly ranking stays independent (closed on day 1 at 06:00);
--   • the result stays PROVISIONAL while something could still change the winner
--     (bank not read after the week ended, connection in error, Pix under review, spike);
--   • prize homologation is automatic when nothing is pending; otherwise it re-checks
--     every hour for 7 days and then waits for an admin (premio_homologar_manual).
--
-- This file creates/updates functions and columns only. NOTHING is scheduled here:
-- the crons live in fechamento-ATIVAR-RODAR-NO-SQL-EDITOR.sql and run only when Rick says so.
-- Nothing is deleted: premio_fechamento is empty today (the old cron never fired).
-- ============================================================================

-- 1) premio_fechamento: provisional vs homologated ---------------------------------------
alter table public.premio_fechamento
  add column if not exists status text not null default 'homologado'
    check (status in ('provisorio', 'homologado')),
  add column if not exists pendencias jsonb not null default '[]'::jsonb,
  add column if not exists homologado_em timestamptz;

-- the hourly cache only stops at HOMOLOGATED periods; a provisional week keeps refreshing
create or replace function public.ranking_congelado_ate()
returns date language sql stable security definer set search_path = public as $$
  select max(fim) from public.premio_fechamento where status = 'homologado';
$$;

-- 2) what could still change the winner --------------------------------------------------
-- Candidates = verified sellers at 80% or more of the verified leader (the only ones who can
-- still take the prize). For each: bank not read after the period ended, connection not UPDATED,
-- Pix of the period waiting in banco_entradas_revisao, or a sales spike (defcon_anomaly_suspects).
create or replace function public.premio_pendencias(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_fim_ts timestamptz := ((p_fim + 1)::timestamp) at time zone 'America/Sao_Paulo'; -- 00:00 BRT of the day after
  v_margem numeric := 0.8;
  r jsonb;
begin
  with rk as (
    select row_number() over (order by g.faturamento_semana desc, g.user_id) as pos, g.user_id, g.nome_usuario, g.faturamento_semana as valor,
           coalesce(p.verificado, false) as v
      from public.get_weekly_ranking_verified(p_inicio, p_fim, false) g
      left join public.profiles p on p.user_id = g.user_id
  ),
  lider as (select valor from rk where v and valor > 0 order by pos limit 1),
  cand as (select rk.* from rk, lider where rk.v and rk.valor >= lider.valor * v_margem),
  pend as (
    -- bank not read since the period ended
    select c.user_id, c.nome_usuario, c.pos, ('banco_nao_lido:' || bc.institution_name) as motivo
      from cand c join public.bank_connections bc on bc.user_id = c.user_id
     where coalesce(bc.status, '') <> 'deleted' and bc.pausado_em is null
       and (bc.leitura_ok_em is null or bc.leitura_ok_em < v_fim_ts)
    union all
    -- connection in error (OUTDATED, LOGIN_ERROR, WAITING_USER_INPUT...)
    select c.user_id, c.nome_usuario, c.pos, ('conexao_' || lower(coalesce(bc.status, 'sem_status')) || ':' || bc.institution_name)
      from cand c join public.bank_connections bc on bc.user_id = c.user_id
     where coalesce(bc.status, '') <> 'deleted' and bc.pausado_em is null
       and upper(coalesce(bc.status, '')) <> 'UPDATED'
    union all
    -- Pix of the period waiting for a decision
    select c.user_id, c.nome_usuario, c.pos, ('pix_em_revisao:' || count(*) || 'x R$' || round(sum(rv.amount)))
      from cand c
      join public.banco_entradas_revisao rv on rv.user_id = c.user_id and rv.status = 'pendente'
      join public.auto_detected_sales a on a.transaction_id = rv.transaction_id and a.user_id = c.user_id
     where a.transaction_date between p_inicio and p_fim
     group by c.user_id, c.nome_usuario, c.pos
    union all
    -- sales spike against the seller's own history
    select c.user_id, c.nome_usuario, c.pos, ('pico_de_vendas:' || round(s.ratio, 1) || 'x')
      from cand c join public.defcon_anomaly_suspects(21, 1.8) s on s.user_id = c.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'nome', nome_usuario, 'posicao', pos, 'motivo', motivo) order by pos, motivo), '[]'::jsonb)
    into r from pend;
  return r;
end $$;

-- 3) freeze one period: provisional or homologated -----------------------------------------
-- A homologated period is never rewritten. A provisional one is recomputed from scratch
-- (ranking + pendencias) every time, until nothing is pending.
create or replace function public.premio_congelar(p_tipo text, p_inicio date, p_fim date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
  v_pend jsonb;
  v_status text;
  v_desde timestamptz;  -- first freeze of this period: the 7-day re-check window counts from it
begin
  if p_tipo not in ('semana', 'mes') or p_fim < p_inicio then raise exception 'periodo invalido'; end if;
  select coalesce(min(congelado_em), now()) into v_desde from public.premio_fechamento where tipo = p_tipo and inicio = p_inicio;
  if exists (select 1 from public.premio_fechamento where tipo = p_tipo and inicio = p_inicio and status = 'homologado') then
    return 0;  -- homologated: never rewritten
  end if;
  perform public.ranking_cache_atualizar(45);
  perform public.selo_revisar();
  v_pend := public.premio_pendencias(p_inicio, p_fim);
  v_status := case when jsonb_array_length(v_pend) = 0 then 'homologado' else 'provisorio' end;

  delete from public.premio_fechamento where tipo = p_tipo and inicio = p_inicio;  -- only provisional rows reach here
  insert into public.premio_fechamento (tipo, inicio, fim, user_id, posicao, valor, dias, verificado, status, pendencias, homologado_em, congelado_em)
  select p_tipo, p_inicio, p_fim, r.user_id,
         row_number() over (order by r.faturamento_semana desc, r.user_id)::int,
         round(r.faturamento_semana, 2), coalesce(r.dias_semana, 0), coalesce(pr.verificado, false),
         v_status, v_pend, case when v_status = 'homologado' then now() end, v_desde
    from public.get_weekly_ranking_verified(p_inicio, p_fim, false) r
    left join public.profiles pr on pr.user_id = r.user_id;
  get diagnostics n = row_count;

  if v_status = 'homologado' then
    update public.premio_fechamento f set leva_premio = true
     where f.tipo = p_tipo and f.inicio = p_inicio
       and f.posicao = (select min(x.posicao) from public.premio_fechamento x
                         where x.tipo = p_tipo and x.inicio = p_inicio and x.verificado and x.valor > 0);
  end if;
  return n;
end $$;

-- 4) the clock: Monday 06:00 closes the week (Mon→Sun); day 1 at 06:00 closes the month ----
create or replace function public.premio_congelar_agora()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  agora timestamp := now() at time zone 'America/Sao_Paulo';
  hoje date := agora::date;
  r jsonb := '{}'::jsonb;
begin
  if extract(hour from agora) < 6 then
    return jsonb_build_object('cedo', true);  -- before 06:00 the banks are still being reconciled
  end if;
  if extract(isodow from hoje) = 1 then  -- Monday: last Monday → yesterday (Sunday)
    -- transition week (Rick, 08/11 09:44): the first official week is Sun 01/11 → Sun 08/11 (8 days)
    r := r || jsonb_build_object('semana', public.premio_congelar('semana',
           case when hoje - 1 = date '2026-11-08' then date '2026-11-01' else hoje - 7 end, hoje - 1));
  end if;
  if extract(day from hoje) = 1 then
    r := r || jsonb_build_object('mes', public.premio_congelar('mes', (hoje - 1) - (extract(day from hoje - 1)::int - 1), hoje - 1));
  end if;
  return r;
end $$;

-- 5) re-check provisional periods (hourly cron) until homologated, for up to 7 days ---------
create or replace function public.premio_reavaliar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; feitos jsonb := '[]'::jsonb;
begin
  for p in
    select distinct tipo, inicio, fim from public.premio_fechamento
     where status = 'provisorio' and congelado_em > now() - interval '7 days'
  loop
    perform public.premio_congelar(p.tipo, p.inicio, p.fim);
    feitos := feitos || jsonb_build_object('tipo', p.tipo, 'inicio', p.inicio,
      'status', (select max(status) from public.premio_fechamento where tipo = p.tipo and inicio = p.inicio));
  end loop;
  return feitos;
end $$;

-- 6) admin decision when something stays pending ---------------------------------------------
create or replace function public.premio_homologar_manual(p_tipo text, p_inicio date, p_vencedor uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  update public.premio_fechamento f
     set status = 'homologado', homologado_em = now(),
         leva_premio = case when p_vencedor is not null then f.user_id = p_vencedor
                            else f.posicao = (select min(x.posicao) from public.premio_fechamento x
                                              where x.tipo = p_tipo and x.inicio = p_inicio and x.verificado and x.valor > 0) end
   where f.tipo = p_tipo and f.inicio = p_inicio;
  get diagnostics n = row_count;
  return n;
end $$;

-- 7) what the app shows: status of a closed period, winner, how many pendencias (no names) ---
create or replace function public.premio_resultado(p_tipo text, p_inicio date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from public.premio_fechamento f where f.tipo = p_tipo and f.inicio = p_inicio) then null
         else jsonb_build_object(
           'status', (select max(status) from public.premio_fechamento f where f.tipo = p_tipo and f.inicio = p_inicio),
           'fim', (select max(fim) from public.premio_fechamento f where f.tipo = p_tipo and f.inicio = p_inicio),
           'homologado_em', (select max(homologado_em) from public.premio_fechamento f where f.tipo = p_tipo and f.inicio = p_inicio),
           'pendencias', (select coalesce(jsonb_array_length(max(pendencias)), 0) from public.premio_fechamento f where f.tipo = p_tipo and f.inicio = p_inicio),
           'vencedor', (select jsonb_build_object('user_id', f.user_id, 'nome', pp.nickname, 'valor', f.valor, 'posicao', f.posicao)
                          from public.premio_fechamento f left join public.public_profiles pp on pp.user_id = f.user_id
                         where f.tipo = p_tipo and f.inicio = p_inicio
                         order by (case when f.leva_premio then 0 else 1 end), (case when f.verificado and f.valor > 0 then 0 else 1 end), f.posicao
                         limit 1))
    end;
$$;

revoke all on function public.premio_pendencias(date, date) from public, anon, authenticated;
revoke all on function public.premio_congelar(text, date, date) from public, anon, authenticated;
revoke all on function public.premio_congelar_agora() from public, anon, authenticated;
revoke all on function public.premio_reavaliar() from public, anon, authenticated;
revoke all on function public.premio_homologar_manual(text, date, uuid) from public, anon;
grant execute on function public.premio_homologar_manual(text, date, uuid) to authenticated;  -- checks is_orbis_admin inside
revoke all on function public.premio_resultado(text, date) from public, anon;
grant execute on function public.premio_resultado(text, date) to authenticated;
