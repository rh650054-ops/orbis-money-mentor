-- ============================================================
-- CONTA DE TESTE QUE COMEÇA DO ZERO (Rick, 12/10/2026)
-- "Sempre que eu logar nessa conta, entro do zero no onboarding. Depois do dia 0
--  eu escolho pra que dia vou (1, 2, 3) e vejo como está funcionando na prática."
--
-- public.contas_teste (já existe, 1 conta) marca quais contas são de teste.
--   conta_teste_zerar()  → só pra quem está em contas_teste: apaga o que a conta
--                          fez no app e volta o perfil pro dia 0 do teste grátis.
--                          Pra qualquer outra conta não faz nada (devolve false).
--   sou_conta_teste()    → o app pergunta se mostra o seletor de dias.
-- A conta de teste fica fora do ranking (ranking_hidden).
-- Só toca nas linhas DA PRÓPRIA conta logada (auth.uid()), nunca em outra.
-- ============================================================

comment on table public.contas_teste is
  'Contas de teste da equipe. Ao logar, o app chama conta_teste_zerar() e a conta volta pro dia 0 (onboarding do zero).';

create or replace function public.sou_conta_teste()
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.contas_teste where user_id = auth.uid());
$$;
revoke all on function public.sou_conta_teste() from public, anon;
grant execute on function public.sou_conta_teste() to authenticated;

create or replace function public.conta_teste_zerar()
returns boolean
language plpgsql security definer set search_path to 'public' as $$
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
end $$;
revoke all on function public.conta_teste_zerar() from public, anon;
grant execute on function public.conta_teste_zerar() to authenticated;
