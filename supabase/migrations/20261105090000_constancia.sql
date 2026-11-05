-- 05/11/2026 (Rick) — CHAMA DA CONSTÂNCIA, estilo Duolingo. One rule, on the server.
--   day worked      = he opened the Foco that day (challenge_sessions.started_at)
--   work day        = the mission's plan when active, else profiles.working_days, else every day
--   folga           = nothing changes
--   worked          = +1 (acesa)
--   missed 1–2 work days  = CONGELADA: the number is kept; working again unfreezes and continues
--   missed 3 work days    = PERDEU: shows 0 with the ice flame, but the number is kept for the rescue
--   rescue          = 7 work days in a row working → gets everything back + 7; one miss → lost for good
-- Today never counts as a miss (he can still go out); misses are days before today.
-- Nothing is stored: the state is derived from the sessions, so it can't drift or be edited by hand.

create or replace function public.constancia_dia_trabalho(p_user uuid, p_dia date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    -- 1) the day-by-day plan of the active mission covering that day
    (select (x ->> 't')::boolean
       from public.objetivos_lucro o, jsonb_array_elements(coalesce(o.plano, '[]'::jsonb)) x
      where o.user_id = p_user and o.status = 'ativo' and p_dia between o.inicio and o.fim and x ->> 'd' = p_dia::text
      limit 1),
    -- 2) the weekly planning; nothing set = every day counts
    (select case when coalesce(array_length(p.working_days, 1), 0) = 0 then true
                 else lower(trim(to_char(p_dia, 'day'))) = any (select lower(y) from unnest(p.working_days) y) end
       from public.profiles p where p.user_id = p_user),
    true);
$$;

create or replace function public.constancia_calcular(p_user uuid, p_mes date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_primeiro date;
  d date;
  trabalhou boolean; dia_trab boolean;
  dias int := 0; recorde int := 0; guardados int := 0; faltas int := 0; resgate int := 0;
  em_resgate boolean := false; estado text := 'acesa';
  ultimo_trabalho date := null; recorde_fim date := null;
  mes jsonb := '[]'::jsonb; m_ini date; m_fim date; status_dia text;
  hoje_trabalhou boolean;
  -- snapshot right before today's session counts: the end-of-day animation goes from it to the current state
  dias_antes int := 0; estado_antes text := 'acesa'; resgate_antes int := 0; guardados_antes int := 0;
begin
  if p_user is null then return null; end if;
  select min(cs.date) into v_primeiro from public.challenge_sessions cs where cs.user_id = p_user and cs.started_at is not null;
  if p_mes is not null then m_ini := date_trunc('month', p_mes)::date; m_fim := (m_ini + interval '1 month - 1 day')::date; end if;
  if v_primeiro is null then
    return jsonb_build_object('dias', 0, 'recorde', 0, 'estado', 'nunca', 'faltas', 0, 'guardados', 0, 'resgate', 0,
                              'antes', jsonb_build_object('dias', 0, 'estado', 'nunca', 'resgate', 0, 'guardados', 0),
                              'hoje_trabalhou', false, 'hoje_trabalha', public.constancia_dia_trabalho(p_user, hoje), 'mes', mes);
  end if;

  d := least(v_primeiro, coalesce(m_ini, v_primeiro));
  while d <= coalesce(m_fim, hoje) loop
    if d = hoje then dias_antes := dias; estado_antes := case when em_resgate and resgate = 0 then 'perdeu' else estado end; resgate_antes := resgate; guardados_antes := guardados; end if;
    trabalhou := d <= hoje and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = d and cs.started_at is not null);
    dia_trab := public.constancia_dia_trabalho(p_user, d);

    if d > hoje then
      status_dia := case when dia_trab then 'futuro' else 'folga' end;
    elsif trabalhou then
      status_dia := 'trabalhou';
      ultimo_trabalho := d;
      if em_resgate then
        resgate := resgate + 1;
        if resgate >= 7 then dias := guardados + 7; guardados := 0; resgate := 0; em_resgate := false; estado := 'acesa';
        else estado := 'resgate'; end if;
      else
        dias := dias + 1; estado := 'acesa';
      end if;
      faltas := 0;
      if dias > recorde then recorde := dias; recorde_fim := d; end if;
    elsif dia_trab and d < hoje then
      status_dia := 'faltou';
      if em_resgate then
        -- one miss during the rescue: everything is gone for good
        em_resgate := false; guardados := 0; resgate := 0; dias := 0; faltas := 0; estado := 'acesa';
      else
        faltas := faltas + 1;
        if dias > 0 then
          if faltas >= 3 then guardados := dias; dias := 0; em_resgate := true; estado := 'perdeu';
          else estado := 'congelada'; end if;
        end if;
      end if;
    elsif dia_trab then
      status_dia := 'hoje';
    else
      status_dia := 'folga';
    end if;

    if m_ini is not null and d between m_ini and m_fim then
      mes := mes || jsonb_build_object('d', d, 's', status_dia);
    end if;
    d := d + 1;
  end loop;

  hoje_trabalhou := exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = hoje and cs.started_at is not null);
  -- after the loop, "resgate" with 0 days done still means "lost, rescue offered"
  if em_resgate and resgate = 0 then estado := 'perdeu'; end if;

  return jsonb_build_object(
    'dias', dias, 'recorde', recorde, 'recorde_fim', recorde_fim,
    'estado', estado,                  -- acesa | congelada | perdeu | resgate | nunca
    'faltas', faltas,                  -- work days missed in a row (before today)
    'guardados', guardados,            -- days kept for the rescue
    'resgate', resgate,                -- rescue days done (of 7)
    'ultimo_trabalho', ultimo_trabalho,
    'antes', jsonb_build_object('dias', dias_antes, 'estado', estado_antes, 'resgate', resgate_antes, 'guardados', guardados_antes),
    'hoje_trabalhou', hoje_trabalhou, 'hoje_trabalha', public.constancia_dia_trabalho(p_user, hoje),
    'mes', mes
  );
end $$;
revoke all on function public.constancia_calcular(uuid, date) from public, anon, authenticated;
grant execute on function public.constancia_calcular(uuid, date) to service_role;

-- what the app calls: my own flame (+ one month of the calendar)
create or replace function public.constancia_minha(p_mes date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.constancia_calcular(auth.uid(), p_mes);
$$;
revoke all on function public.constancia_minha(date) from public, anon;
grant execute on function public.constancia_minha(date) to authenticated;
