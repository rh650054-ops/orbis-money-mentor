-- 06/11/2026 (Rick, 22:59): "a constância começa no dia 1 desse mês". The flame counts from 01/11/2026 for
-- everyone; work sessions before it no longer add to the streak (he saw 75 days). Everything else is the same
-- as 20261105100000: before 05/11 a miss only freezes; lose/rescue count from 05/11. Old months still show
-- on the calendar, they just don't count.

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
  -- the lose/rescue rules count from the day the flame went live; history before it only freezes
  v_regra date := date '2026-11-05';
  -- 06/11 (Rick): the flame starts counting on 01/11/2026; sessions before it don't count
  v_inicio date := date '2026-11-01';
begin
  if p_user is null then return null; end if;
  select min(cs.date) into v_primeiro from public.challenge_sessions cs where cs.user_id = p_user and cs.started_at is not null and cs.date >= v_inicio;
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

    if d < v_inicio then
      -- before the flame's start: the calendar still shows it, the count ignores it
      status_dia := case when trabalhou then 'trabalhou' when dia_trab then 'faltou' else 'folga' end;
    elsif d > hoje then
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
      if d < v_regra then
        -- before the flame existed (05/11/2026) a miss only freezes: nobody loses what he built
        faltas := faltas + 1;
        if dias > 0 then estado := 'congelada'; end if;
      elsif em_resgate then
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

