-- ============================================================
-- SEQUÊNCIA DE "GUARDAR" RESPEITA A FOLGA — 05/10/2026
-- Rick: "eu não trabalho segunda e terça… quando for dia de folga eu não perco a
-- constância. Só perco se for dia de trabalho e eu não guardar."
-- A tela de Finanças já pulava a folga, mas a caixinha do fim do DEFCON
-- (caixinha_sugestao) contava dias de CALENDÁRIO colados: segunda e terça sem guardar
-- zeravam a sequência. Agora as duas contam igual:
--   • dia de trabalho (profiles.working_days) sem guardar → quebra;
--   • folga sem guardar → não conta e não quebra;
--   • guardou na folga → conta (bônus).
-- Sem working_days cadastrado, todo dia é dia de trabalho (como antes).
-- ============================================================

create or replace function public.caixinha_sugestao()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  g as (
    select f.*,
      coalesce(f.deadline,
        (f.created_at at time zone 'America/Sao_Paulo')::date
          + case f.prazo when 'curto' then 30 when 'longo' then 365 else 90 end) as alvo_data
    from public.financial_goals f
    where f.user_id = auth.uid() and coalesce(f.status, 'active') = 'active'
      and coalesce(f.current_amount, 0) < coalesce(f.target_amount, 0)
  ),
  escolhida as (select * from g order by (deadline is null), alvo_data, created_at limit 1),
  dias as (
    select d.data from public.financas_dias d
    where d.user_id = auth.uid() and coalesce(d.guardado, 0) > 0 and d.data <= (select d from hoje)
  ),
  wd as (
    select coalesce((select to_jsonb(p.working_days) from public.profiles p where p.user_id = auth.uid()), '[]'::jsonb) j
  ),
  -- a sequência termina hoje (se já guardou hoje) ou ontem
  ancora as (select case when exists (select 1 from dias where data = (select d from hoje))
                         then (select d from hoje) else (select d from hoje) - 1 end a),
  cal as (
    select s::date dia,
           exists (select 1 from dias where data = s::date) guardou,
           (jsonb_array_length((select j from wd)) = 0
            or (select j from wd) ? (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from s)::int + 1]) trabalho
      from generate_series((select a from ancora), (select a from ancora) - 180, interval '-1 day') s
  ),
  conta as (select * from cal where trabalho or guardou),
  furo as (select max(dia) d from conta where not guardou),
  seq as (select count(*)::int n from conta where guardou and dia > coalesce((select d from furo), '1900-01-01'::date))
  select case when auth.uid() is null or not exists (select 1 from escolhida) then null else (
    select jsonb_build_object(
      'goal_id', e.id, 'nome', e.name, 'icon', e.icon,
      'alvo', e.target_amount, 'tem', coalesce(e.current_amount, 0),
      'falta', greatest(0, e.target_amount - coalesce(e.current_amount, 0)),
      'data', e.alvo_data,
      'dias', greatest(1, e.alvo_data - (select d from hoje)),
      'por_dia', ceil(greatest(0, e.target_amount - coalesce(e.current_amount, 0))
                      / greatest(1, e.alvo_data - (select d from hoje))),
      'sequencia', (select n from seq),
      'guardado_hoje', coalesce((select guardado from public.financas_dias
                                  where user_id = auth.uid() and data = (select d from hoje)), 0)
    ) from escolhida e) end;
$$;
