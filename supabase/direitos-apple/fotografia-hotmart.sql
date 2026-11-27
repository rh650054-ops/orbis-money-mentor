-- READ ONLY snapshot of the Hotmart side, to run BEFORE and AFTER each deploy step of the Apple
-- subscriptions (migrations, functions, cron, first Sandbox purchase). Save both outputs; every
-- number below must be equal before and after, except the "ultimos_*" ones, which only have to keep
-- moving (proof the Hotmart webhook is still being received and processed).
-- One select inside a READ ONLY transaction: PostgreSQL refuses any write. No name, e-mail or CPF.
-- It complements comparar-antes-depois.sql (account by account); this one is the 30-second check.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
  'quando', now() at time zone 'America/Sao_Paulo',
  'contas', (select count(*) from public.profiles),
  'hotmart_por_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                           from (select status, count(*) n from public.subscriptions group by status) s),
  'hotmart_ativas_com_periodo_valendo', (select count(*) from public.subscriptions
                           where status in ('active', 'past_due') and coalesce(grace_until, current_period_end) > now()),
  'plan_status_por_valor', (select coalesce(jsonb_object_agg(coalesce(plan_status, '(nulo)'), n), '{}'::jsonb)
                           from (select plan_status, count(*) n from public.profiles group by plan_status) p),
  'assinantes_hotmart_sem_plano_ativo', (select count(*) from public.subscriptions s
                           join public.profiles p on p.user_id = s.user_id
                           where s.status in ('active', 'past_due') and coalesce(s.grace_until, s.current_period_end) > now()
                             and coalesce(p.plan_status, '') <> 'active'),
  'cortesias', (select count(*) from public.profiles where coalesce(billing_exempt, false)),
  'demos', (select count(*) from public.profiles where coalesce(is_demo, false)),
  'em_teste_gratuito', (select count(*) from public.profiles
                           where coalesce(is_trial_active, false) and trial_end >= (now() at time zone 'America/Sao_Paulo')::date),
  'pro_ativos', (select count(*) from public.orbis_pro where ativo),
  'ultimo_evento_hotmart', (select max(recebido_em) at time zone 'America/Sao_Paulo' from public.hotmart_eventos),
  'eventos_hotmart_24h', (select count(*) from public.hotmart_eventos where recebido_em > now() - interval '24 hours'),
  -- Apple side: does not exist before the migrations (to_regclass answers null), and stays empty
  -- of Production rows until the launch
  'apple_tabelas_existem', to_regclass('public.apple_assinaturas') is not null
));
commit;
-- Note on 'assinantes_hotmart_sem_plano_ativo': 'active' is what the app treats as paid (trial and
-- expired are the other values). Today it may already be above zero (a subscriber being reconciled);
-- what matters is that the number does not GROW after a step.
