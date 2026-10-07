-- Conta de teste que recomeça do zero (Rick, 07/10/2026).
-- O simulador muda só o dia; os dados continuam os do admin. Pra testar como um vendedor
-- novo de verdade, uma conta marcada aqui pode apagar os PRÓPRIOS dados de trabalho e
-- voltar pro dia 0 (com onboarding) ou cair direto no dia 1, 2, 3 ou no fim do teste.
-- Segurança: só apaga linhas do próprio usuário (auth.uid()) e só se ele estiver nesta
-- lista, que só o banco/admin preenche. Assinatura, pagamentos, CRM e carteira não são tocados.

create table if not exists public.contas_teste (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.contas_teste enable row level security;
create policy contas_teste_ler on public.contas_teste for select to authenticated using (user_id = auth.uid());
grant select on public.contas_teste to authenticated;

create or replace function public.conta_teste_recomecar(p_dia int default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date;
  t text;
  v_apagadas int := 0;
  n int;
  -- filhos antes dos pais (sessões, produtos)
  tabelas text[] := array[
    'challenge_blocks','defcon_sales','defcon_clients','defcon_occurrences','defcon_pausas','challenge_sessions',
    'product_price_tiers','product_recipes','product_sales_log','production_batches','compras_mercadoria',
    'defcon_daily_loadout','products','ingredients',
    'daily_sales','daily_reports','daily_checklist','daily_work_log','work_sessions','hour_blocks_v2','hourly_goal_blocks',
    'late_pix_entries','personal_expenses','financas_dias','financas_guardar_dia','leaderboard_stats','ranking_eventos',
    'jornada_teste','ai_messages','ai_conversations','ai_memoria','estudio_geracoes','caca_sinal_duracoes','orbis_pulso'
  ];
begin
  if v_uid is null or not exists (select 1 from contas_teste where user_id = v_uid) then
    raise exception 'conta não é de teste';
  end if;
  if p_dia < 0 or p_dia > 4 then raise exception 'dia inválido'; end if;

  if p_dia = 0 then
    tabelas := tabelas || array['daily_goal_plans','onboarding_planos'];
  end if;

  foreach t in array tabelas loop
    begin
      execute format('delete from public.%I where user_id = $1', t) using v_uid;
      get diagnostics n = row_count;
      v_apagadas := v_apagadas + n;
    exception when undefined_table or undefined_column then null;
    end;
  end loop;

  -- dia N do teste: começou há N dias. Dia 4 = o teste acabou ontem.
  v_ini := v_hoje - p_dia;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role', 'sub', v_uid)::text, true);
  update profiles set
    trial_start = v_ini,
    trial_end = v_ini + 3,
    plan_status = case when p_dia = 4 then 'expired' else 'trial' end,
    is_trial_active = p_dia < 4,
    onboarding_completed = case when p_dia = 0 then false else onboarding_completed end,
    onboarding_step = case when p_dia = 0 then 0 else onboarding_step end
  where user_id = v_uid;

  return jsonb_build_object('dia', p_dia, 'trial_start', v_ini, 'linhas_apagadas', v_apagadas);
end $$;

revoke all on function public.conta_teste_recomecar(int) from public, anon;
grant execute on function public.conta_teste_recomecar(int) to authenticated;
