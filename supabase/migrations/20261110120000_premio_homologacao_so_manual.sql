-- HOTFIX F-07 (audit 10/11/2026) — prizes are never homologated without a human.
--
-- Before: premio_congelar turned a closed period 'homologado' (and marked who takes the prize) by
-- itself as soon as no candidate had a pending item. The hourly cron premio-reavaliar re-runs it,
-- so a result could become final at any hour, on numbers the audit proved wrong (F-01, F-02).
-- On 10/11 the week 01-08/11 had ONE pending item left (conexao_outdated:Cora).
--
-- After: a switch, premio_homologacao_automatica(), decides. It is OFF. With it off the period is
-- still frozen, ranked and re-evaluated every hour (pending items keep being refreshed), but it
-- stays 'provisorio' until an admin calls premio_homologar_manual(tipo, inicio[, vencedor]).
--
-- Changes exactly two things: a new 3-line function and ONE line of premio_congelar.
-- Does not touch: the live ranking, ranking_dia_cache, bank reading, the crons, any stored row.
--
-- Rollback (one statement, restores the old behaviour): run the first function below again with
-- `select true` in place of `select false`.

create or replace function public.premio_homologacao_automatica()
returns boolean language sql immutable set search_path = public as $$ select false $$;
revoke all on function public.premio_homologacao_automatica() from public, anon, authenticated;

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
  v_status := case when jsonb_array_length(v_pend) = 0 and public.premio_homologacao_automatica() then 'homologado' else 'provisorio' end;

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
