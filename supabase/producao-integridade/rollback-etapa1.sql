-- Rollback of Etapa 1: 20261122130000_receita_historico_e_conta_teste.sql, then
-- 20261122120000_producao_integridade.sql. Removes ONLY what they created and restores
-- conta_teste_zerar exactly as production ran it on 22/11/2026 (md5 of the body 189d472f…).
-- Data is never deleted:
--   * refuses if any production was already recorded by the new flow (producao_eventos);
--   * keeps receita_alteracoes (and the two functions guarding it) when it already holds recipe
--     changes: logging stops, the history stays. It is dropped only when empty.
-- Nothing else (products, recipes, ingredients, old functions, sales) is touched.
begin;
do $$
declare v_tem boolean := false;
begin
  -- dynamic: the table may already be gone (a second run of this file must be harmless)
  if to_regclass('public.producao_eventos') is not null then
    execute 'select exists (select 1 from public.producao_eventos)' into v_tem;
  end if;
  if v_tem then
    raise exception 'Rollback recusado: já existe produção registrada pelo novo fluxo. Peça autorização antes de apagar esse histórico.';
  end if;
end $$;

-- part 2: existing objects back to what they were
drop trigger if exists receita_alteracoes_registrar on public.product_recipes;
drop trigger if exists receita_alteracoes_registrar on public.products;
drop function if exists public.receita_registrar();
CREATE OR REPLACE FUNCTION public.conta_teste_zerar()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  claims text := current_setting('request.jwt.claims', true);
  t text;
  volta int;
  -- o que a pessoa FAZ no app (vendas, Foco, metas, produtos, jornada, finanças, IA…).
  -- Fora da lista de propósito: profiles, contas_teste, permissões (admin/roles/pro/
  -- testers de Open Finance), banco conectado, Hotmart e auditoria.
  tabelas text[] := array[
    'product_price_tiers','product_recipes','ingredients','production_batches','product_sales_log',
    'compras_mercadoria','defcon_sales','defcon_clients','defcon_daily_loadout','defcon_occurrences',
    'defcon_pausas','challenge_blocks','hourly_goal_blocks','hour_blocks_v2','challenge_sessions',
    'daily_goal_plans','daily_sales','products','metas_dia','onboarding_planos','jornada_teste',
    'personal_expenses','routine_activities','routines','daily_checklist','daily_reports',
    'daily_work_log','work_sessions','daily_distributions','financas_dias','financas_guardar_dia',
    'financas_tetos','financial_goals','planned_bills','leaderboard_stats','ranking_eventos',
    'late_pix_entries','cobrancas','monthly_challenges','ai_messages','ai_conversations',
    'ai_memoria','ai_usage','chat_messages','orbis_pulso','orbis_ficha','clima_dia',
    'caca_sinal_duracoes','spot_feedback','email_codigos','subscriptions'];
begin
  if u is null or not exists (select 1 from public.contas_teste where user_id = u) then
    return false;
  end if;

  -- apaga em até 3 voltas (uma tabela pode depender de outra)
  for volta in 1..3 loop
    foreach t in array tabelas loop
      if to_regclass('public.' || t) is null then continue; end if;
      begin
        execute format('delete from public.%I where user_id = $1', t) using u;
      exception when foreign_key_violation then null;   -- tenta de novo na próxima volta
      end;
    end loop;
  end loop;

  -- as travas do perfil (protect_*) só deixam o servidor mexer em teste/plano:
  -- dentro desta transação a função age como servidor, só pra ESTA linha.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles set
    onboarding_completed = false,
    onboarding_step = 0,
    trial_start = hoje,
    trial_end = hoje + 3,
    trial_started_at = now(),
    trial_days_remaining = 3,
    is_trial_active = true,
    plan_status = 'trial',
    plan_type = 'trial',
    monthly_goal = 0,
    weekly_goal = 0,
    base_daily_goal = 200,
    daily_sales_goal = 0,
    goal_hours = 0,
    weekly_work_days = 5,
    week_start_date = hoje,
    goal_timer_active = false,
    goal_timer_started_at = null,
    must_change_password = false,
    ranking_hidden = true
  where user_id = u;
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  return true;
end $function$;


-- part 1: new objects
drop function if exists public.producao_registrar(text, jsonb, jsonb, text, text);
drop function if exists public.producao_corrigir(uuid, text, jsonb, jsonb, text);
drop function if exists public.producao_desfazer(uuid, text, text);
drop function if exists public.producao_gravar(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, text, text);
drop function if exists public.producao_aplicar(uuid, uuid, uuid, jsonb);
drop function if exists public.producao_deltas(jsonb, jsonb);
drop function if exists public.producao_estado_atual(uuid);
drop function if exists public.producao_estado_alvo(uuid, jsonb, jsonb, text);
drop function if exists public.producao_reducao_maxima();
drop function if exists public.producao_repetido(uuid, text, text);
drop function if exists public.producao_validar_chave(text);
drop function if exists public.producao_num(numeric);
drop table if exists public.producao_movimentos, public.producao_consumos, public.producao_itens, public.producao_eventos, public.producao_registros;
do $$
declare v_tem boolean := false;
begin
  if to_regclass('public.receita_alteracoes') is not null then
    execute 'select exists (select 1 from public.receita_alteracoes)' into v_tem;
  end if;
  if v_tem then
    raise notice 'receita_alteracoes mantida: já guarda alterações de receita (o registro parou, o histórico fica).';
  else
    drop table if exists public.receita_alteracoes;
    drop function if exists public.producao_imutavel();
    drop function if exists public.producao_sem_truncate();
  end if;
end $$;
commit;
