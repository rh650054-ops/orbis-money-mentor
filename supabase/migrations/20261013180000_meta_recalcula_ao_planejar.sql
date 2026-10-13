-- ============================================================
-- META DO DIA ACOMPANHA O PLANEJAR (Rick, 13/10/2026)
-- "Altero a minha meta lá no Planejar mas aqui continua uma estranha."
-- meta_do_dia() guardava o cálculo por 12 h: mudar meta do mês, horas ou dias no
-- Planejar (profiles) só aparecia no Foco no dia seguinte. Agora recalcula também
-- quando o perfil mudou depois do último cálculo (profiles.updated_at é mantido
-- pelo gatilho update_profiles_updated_at).
-- ============================================================
create or replace function public.meta_do_dia(p_dia date default null)
returns metas_dia
language plpgsql security definer set search_path to 'public' as $function$
declare
  d date := coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date);
  r public.metas_dia;
  v_perfil timestamptz;
begin
  if auth.uid() is null then return null; end if;
  select * into r from public.metas_dia where user_id = auth.uid() and dia = d;
  select p.updated_at into v_perfil from public.profiles p where p.user_id = auth.uid();
  if r.user_id is null
     or r.calculada_em < now() - interval '12 hours'
     or (v_perfil is not null and v_perfil > r.calculada_em) then
    r := public.vant_meta_calcular(auth.uid(), d);
  end if;
  return r;
end $function$;
