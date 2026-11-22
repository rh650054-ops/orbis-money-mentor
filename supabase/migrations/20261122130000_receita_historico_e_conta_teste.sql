-- Etapa 1, part 2 (22/11/2026). The ONLY file of Etapa 1 that touches existing objects:
--   1) two AFTER triggers that write every recipe change to receita_alteracoes
--      (product_recipes: insert/update/delete; products: update of batch_yield or recipe_mode).
--      They only INSERT into the log: they change no row of products/product_recipes, no cost, no
--      price, no stock. A log failure cannot block a recipe edit: rows whose user is not in
--      auth.users (4 orphan products exist today) are simply not logged.
--   2) conta_teste_zerar also wipes the production history and the recipe log of the test account
--      (same list + 2 tables). Everything else in it is byte-for-byte what production runs (22/11).
-- Requires 20261122120000_producao_integridade.sql.

create or replace function public.receita_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ctx text; v_user uuid; v_reduz boolean; v_op text;
begin
  -- wiping a whole account is not a recipe change
  get diagnostics v_ctx = pg_context;
  if v_ctx ~ '(apagar_dados_do_usuario|conta_teste_zerar)' then return null; end if;

  if tg_table_name = 'product_recipes' then
    v_user := coalesce(new.user_id, old.user_id);
    if not exists (select 1 from auth.users a where a.id = v_user) then return null; end if;
    if tg_op = 'INSERT' then
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, new.product_id, new.variant_id, new.ingredient_id, 'ingrediente', 'incluiu', null, new.quantity::text, false, auth.uid());
    elsif tg_op = 'DELETE' then
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, old.product_id, old.variant_id, old.ingredient_id, 'ingrediente', 'removeu', old.quantity::text, null, old.quantity > 0, auth.uid());
    elsif row(new.product_id, new.variant_id, new.ingredient_id, new.quantity) is distinct from row(old.product_id, old.variant_id, old.ingredient_id, old.quantity) then
      -- moving the row to another ingredient/flavour/product = removing it from where it was
      v_reduz := new.quantity < old.quantity or new.ingredient_id <> old.ingredient_id
              or new.product_id <> old.product_id or new.variant_id is distinct from old.variant_id;
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, old.product_id, old.variant_id, old.ingredient_id, 'ingrediente', 'alterou', old.quantity::text,
              case when new.ingredient_id = old.ingredient_id and new.product_id = old.product_id and new.variant_id is not distinct from old.variant_id
                   then new.quantity::text else format('%s em %s/%s/%s', new.quantity, new.product_id, coalesce(new.variant_id::text, '-'), new.ingredient_id) end,
              v_reduz, auth.uid());
    end if;
    return null;
  end if;

  -- products: only yield and mode (the trigger's WHEN already filtered other columns)
  if not exists (select 1 from auth.users a where a.id = new.user_id) then return null; end if;
  if new.batch_yield is distinct from old.batch_yield then
    -- more units from the same batch = less of each ingredient per unit (also a first yield set
    -- on a recipe that had none: production was blocked before, and now consumes per this yield)
    v_reduz := coalesce(new.batch_yield, 0) > 0 and (coalesce(old.batch_yield, 0) <= 0 or new.batch_yield > old.batch_yield);
    insert into public.receita_alteracoes (user_id, product_id, campo, operacao, antes, depois, reduz, por)
    values (new.user_id, new.id, 'rendimento', 'alterou', old.batch_yield::text, new.batch_yield::text, v_reduz, auth.uid());
  end if;
  if new.recipe_mode is distinct from old.recipe_mode then
    -- leaving 'batch' = production stops taking ingredients
    v_reduz := old.recipe_mode = 'batch';
    insert into public.receita_alteracoes (user_id, product_id, campo, operacao, antes, depois, reduz, por)
    values (new.user_id, new.id, 'modo', 'alterou', old.recipe_mode, new.recipe_mode, v_reduz, auth.uid());
  end if;
  return null;
end $$;
revoke all on function public.receita_registrar() from public, anon, authenticated;

create trigger receita_alteracoes_registrar
  after insert or update or delete on public.product_recipes
  for each row execute function public.receita_registrar();
create trigger receita_alteracoes_registrar
  after update of batch_yield, recipe_mode on public.products
  for each row when (old.batch_yield is distinct from new.batch_yield or old.recipe_mode is distinct from new.recipe_mode)
  execute function public.receita_registrar();

-- conta_teste_zerar: production body of 22/11/2026, plus 'producao_registros' (its event, items,
-- consumption and ledger rows go with it by FK cascade) and 'receita_alteracoes' at the end of the list.
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
    'caca_sinal_duracoes','spot_feedback','email_codigos','subscriptions',
    -- 22/11/2026: production history (Etapa 1) and recipe log
    'producao_registros','receita_alteracoes'];
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
