-- 27/11/2026: the six risks of PR #373 with an Apple subscription in the picture (Rick's list).
-- Fictional data only. Migrations: the three drafts of Etapa 2.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
\ir direitos/migracoes.sql
select pg_temp.servidor();
\ir direitos/apple.sql
\set ESS 'app.vant.vendas.essencial.mensal'
\set PRO 'app.vant.vendas.pro.mensal'
\set ANUAL 'app.vant.vendas.pro.anual'
\set BANCO 'app.vant.vendas.banco.mensal'

-- ============================================================ 1. a suspension is not undone by an Apple renewal
select pg_temp.conta('s_apple');
select pg_temp.apple('s_apple', '1000000000004601', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.admin(true);
select public.admin_assinatura_manual(pg_temp.id('s_apple'), false, 'suspensao ficticia de teste') as r \gset s1_
select pg_temp.admin(false);
select t.verdade('S1 the admin deactivates an account that Apple is paying for: it is blocked and recorded as SUSPENDED',
  pg_temp.plano('s_apple') = 'expired' and public.conta_suspensa(pg_temp.id('s_apple')) and (:'s1_r'::jsonb ->> 'suspensa')::boolean);
-- Apple renews (a newer status with a later end), then the hourly routine and the reconciliation run
select pg_temp.apple('s_apple', '1000000000004601', :'PRO', :'fim30'::timestamptz, :'t2'::timestamptz) as r \gset s2_
select public.apple_expirar_vencidas() \gset x_
select public.apple_acesso_recalcular(pg_temp.id('s_apple')) \gset x_
select t.verdade('S2 THE RISK: the Apple renewal is stored (the mirror has the new end) and does NOT turn the suspended account back on; no plan, no Pro, no bank',
  :'s2_r' = 'gravada' and pg_temp.plano('s_apple') = 'expired'
  and (select expira_em > now() + interval '29 days' from public.apple_assinaturas where original_transaction_id = '1000000000004601')
  and public.vant_plano(pg_temp.id('s_apple')) = 'sem_plano' and not public.vant_pro_pleno(pg_temp.id('s_apple'))
  and not public.orbis_pro_ativo(pg_temp.id('s_apple')) and (public.open_finance_limite(pg_temp.id('s_apple')) ->> 'limite')::int = 0);
select t.verdade('S3 the right Apple holds is still listed, next to the suspension, for support',
  exists (select 1 from public.vant_direitos(pg_temp.id('s_apple')) d where d.direito = 'suspensao')
  and exists (select 1 from public.vant_direitos(pg_temp.id('s_apple')) d where d.direito = 'plano' and d.origem = 'apple'));
-- nothing else turns it on either: a Hotmart charge, a direct write by the backend
select public.hotmart_acesso_aplicar(pg_temp.id('s_apple'), 'ativar', 'SUB-s_apple', 'HP-s', :'fim'::timestamptz, false) \gset x_
update public.profiles set plan_status = 'active' where user_id = pg_temp.id('s_apple');
update public.profiles set plan_status = 'trial', is_trial_active = true where user_id = pg_temp.id('s_apple');
select t.verdade('S4 while suspended NOTHING turns the plan on: not a Hotmart charge, not a direct write by the backend, not a free test',
  pg_temp.plano('s_apple') = 'expired' and not (select is_trial_active from public.profiles where user_id = pg_temp.id('s_apple')));
select pg_temp.admin(true);
select public.admin_liberar_acesso(pg_temp.id('s_apple'), 'liberando a conta ficticia') as r \gset s5_
select pg_temp.admin(false);
select t.verdade('S5 the admin lifts the suspension: the access comes back from the rights that are valid now, and the suspension stays as history',
  :'s5_r'::jsonb ->> 'acesso' = 'active' and pg_temp.plano('s_apple') = 'active' and public.vant_pro_pleno(pg_temp.id('s_apple'))
  and (select count(*) = 1 and bool_and(liberado_em is not null and liberado_motivo = 'liberando a conta ficticia') from public.acesso_suspenso where user_id = pg_temp.id('s_apple')));

select pg_temp.conta('s_teste', 'teste');
select pg_temp.conta('s_equipe', 'equipe');
select pg_temp.conta('s_vencida');
select pg_temp.admin(true);
select public.admin_suspender_acesso(pg_temp.id('s_teste'), 'suspensao ficticia no teste') \gset x_
select public.admin_suspender_acesso(pg_temp.id('s_teste'), 'suspensao repetida') as r \gset s6_
select t.verdade('S6 the explicit suspension: blocks a free test too, twice is the same as once, a courtesy account is refused',
  pg_temp.plano('s_teste') = 'expired' and (:'s6_r'::jsonb ->> 'ja_estava')::boolean
  and (select count(*) = 1 from public.acesso_suspenso where user_id = pg_temp.id('s_teste'))
  and t.erro(format('select public.admin_suspender_acesso(%L, ''motivo ficticio'')', pg_temp.id('s_equipe'))) like '%retire a cortesia em vez de suspender.');
select public.admin_liberar_acesso(pg_temp.id('s_teste'), 'liberando o teste ficticio') as r \gset s7_
select public.admin_suspender_acesso(pg_temp.id('s_vencida'), 'suspensao de conta sem direito') \gset x_
select public.admin_liberar_acesso(pg_temp.id('s_vencida'), 'liberando conta sem direito') as r \gset s8_
select pg_temp.admin(false);
select t.verdade('S7 lifting it gives back only what is still valid: the test that was running continues; an account with no right stays blocked',
  :'s7_r'::jsonb ->> 'acesso' = 'trial' and pg_temp.plano('s_teste') = 'trial' and public.vant_plano(pg_temp.id('s_teste')) = 'teste'
  and :'s8_r'::jsonb ->> 'acesso' = 'sem_direito' and pg_temp.plano('s_vencida') = 'expired');
select pg_temp.app(pg_temp.id('s_teste'));
select t.verdade('S8 only an admin suspends or lifts; the table is closed to the app',
  t.erro(format('select public.admin_suspender_acesso(%L, ''motivo ficticio'')', pg_temp.id('s_vencida'))) like '%apenas admin'
  and t.erro(format('select public.admin_liberar_acesso(%L, ''motivo ficticio'')', pg_temp.id('s_vencida'))) like '%apenas admin'
  and t.erro('select 1 from public.acesso_suspenso', 'authenticated', pg_temp.id('s_teste')) like '42501|%');
select pg_temp.servidor();

-- ============================================================ 2. a Hotmart Pro revocation and the other rights
select pg_temp.conta(k) from unnest(array['c_cortesia_apple', 'c_hotmart_apple']) k;
select public.pro_conceder(pg_temp.id('c_cortesia_apple'), 'cortesia', null, null, null) \gset x_
select public.pro_conceder(pg_temp.id('c_cortesia_apple'), 'hotmart', 'SUB-c1', '5y86n311', now() + interval '33 days') \gset x_
select public.pro_conceder(pg_temp.id('c_hotmart_apple'), 'hotmart', 'SUB-c2', '5y86n311', now() + interval '33 days') \gset x_
select pg_temp.apple('c_hotmart_apple', '1000000000004602', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select public.pro_revogar(pg_temp.id('c_cortesia_apple')) \gset x_
select public.pro_revogar(pg_temp.id('c_hotmart_apple')) \gset x_
select t.verdade('C1 THE RISK: a Pro revocation that comes from Hotmart removes neither an independent courtesy nor a Pro bought through Apple',
  public.vant_pro_pleno(pg_temp.id('c_cortesia_apple')) and public.vant_pro_pleno(pg_temp.id('c_hotmart_apple'))
  and (select count(*) = 2 from public.orbis_pro where not ativo and user_id in (pg_temp.id('c_cortesia_apple'), pg_temp.id('c_hotmart_apple'))));
update public.orbis_pro set ativo = true, cancelado_em = null, expira_em = now() - interval '1 minute' where user_id = pg_temp.id('c_cortesia_apple');
select t.verdade('C2 a Hotmart Pro that just runs out (no revocation event) on top of a courtesy: the courtesy still gives the Pro, and it is not "annual"',
  public.vant_pro_pleno(pg_temp.id('c_cortesia_apple')) and not public.pro_anual(pg_temp.id('c_cortesia_apple'))
  and (public.open_finance_limite(pg_temp.id('c_cortesia_apple')) ->> 'incluidos')::int = 1);

-- ============================================================ 3. the extra bank never gives the main plan
select pg_temp.conta(k) from unnest(array['k_so_banco', 'k_plano_e_banco']) k;
select pg_temp.apple('k_so_banco', '1000000000004603', :'BANCO', :'fim'::timestamptz, :'t0'::timestamptz) as r \gset k1_
select t.verdade('K1 THE RISK: the bank add-on bought through Apple on an account without a plan is stored and gives NOTHING: plan blocked, no plan name, no bank features, no slot counted',
  :'k1_r' = 'gravada' and pg_temp.plano('k_so_banco') = 'expired' and public.vant_plano(pg_temp.id('k_so_banco')) = 'sem_plano'
  and not public.orbis_pro_ativo(pg_temp.id('k_so_banco')) and not public.vant_recursos_pro(pg_temp.id('k_so_banco'))
  and (public.open_finance_limite(pg_temp.id('k_so_banco')) ->> 'limite')::int = 0
  and exists (select 1 from public.bancos_extra_compras where chave = 'apple:1000000000004603' and ativo)
  and not (select segura_plano from public.apple_acesso where user_id = pg_temp.id('k_so_banco')));
select pg_temp.apple('k_so_banco', '1000000000004604', :'ESS', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('K2 once the main plan is bought the kept slot starts to count: Essencial + one extra bank, still not Pro',
  public.vant_plano(pg_temp.id('k_so_banco')) = 'essencial_banco' and not public.vant_pro_pleno(pg_temp.id('k_so_banco'))
  and (public.open_finance_limite(pg_temp.id('k_so_banco')) ->> 'extras')::int = 1 and (public.open_finance_limite(pg_temp.id('k_so_banco')) ->> 'incluidos')::int = 0);
select pg_temp.apple('k_so_banco', '1000000000004604', :'ESS', :'fim'::timestamptz, :'t1'::timestamptz, 'Production', now()) \gset x_
select t.verdade('K3 the main plan is refunded: the account is blocked again and the bank add-on, alone, does not hold it',
  pg_temp.plano('k_so_banco') = 'expired' and public.vant_plano(pg_temp.id('k_so_banco')) = 'sem_plano'
  and not public.orbis_pro_ativo(pg_temp.id('k_so_banco')));

-- ============================================================ 4. more than one valid subscription: no doubled limits, no summed periods
select pg_temp.conta(k) from unnest(array['m_hot_mensal_apple_anual', 'm_hot_anual_apple_anual', 'm_duas_apple', 'm_ess_e_pro', 'm_bancos']) k;
select public.hotmart_acesso_aplicar(pg_temp.id('m_hot_mensal_apple_anual'), 'ativar', 'SUB-m1', 'HP-m1', :'fim'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('m_hot_mensal_apple_anual'), 'hotmart', 'SUB-m1', '5y86n311', now() + interval '33 days') \gset x_
select pg_temp.apple('m_hot_mensal_apple_anual', '1000000000004605', :'ANUAL', :'fim365'::timestamptz, :'t0'::timestamptz) \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('m_hot_anual_apple_anual'), 'ativar', 'SUB-m2', 'HP-m2', :'fim365'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('m_hot_anual_apple_anual'), 'hotmart', 'SUB-m2', 'ew11enu0', now() + interval '368 days') \gset x_
select pg_temp.apple('m_hot_anual_apple_anual', '1000000000004606', :'ANUAL', :'fim365'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('M1 Hotmart monthly Pro + Apple annual Pro: annual Pro, 2 banks included (the higher one), never 3',
  public.vant_plano(pg_temp.id('m_hot_mensal_apple_anual')) = 'pro_anual'
  and (public.open_finance_limite(pg_temp.id('m_hot_mensal_apple_anual')) ->> 'incluidos')::int = 2
  and (public.open_finance_limite(pg_temp.id('m_hot_mensal_apple_anual')) ->> 'limite')::int = 2);
select t.verdade('M2 annual Pro on BOTH sides: still 2 banks included, never 4',
  (public.open_finance_limite(pg_temp.id('m_hot_anual_apple_anual')) ->> 'incluidos')::int = 2
  and (public.open_finance_limite(pg_temp.id('m_hot_anual_apple_anual')) ->> 'limite')::int = 2);
-- two Apple plan subscriptions on the same VANT account (bought with two different Apple accounts)
select pg_temp.apple('m_duas_apple', '1000000000004607', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('m_duas_apple', '1000000000004608', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('M3 two Apple Pro subscriptions on one account: one Pro, 1 bank included (not 2), and each keeps its own end date (nothing is added up)',
  public.vant_plano(pg_temp.id('m_duas_apple')) = 'pro' and (public.open_finance_limite(pg_temp.id('m_duas_apple')) ->> 'incluidos')::int = 1
  and (select count(*) = 2 and max(valido_ate) < now() + interval '31 days' from public.vant_direitos(pg_temp.id('m_duas_apple')) d where d.direito = 'plano' and d.origem = 'apple'));
select pg_temp.apple('m_duas_apple', '1000000000004607', :'PRO', :'fim'::timestamptz, :'t1'::timestamptz, 'Production', now()) \gset x_
select t.verdade('M4 one of the two is refunded: the account keeps the plan and the Pro through the other one',
  pg_temp.plano('m_duas_apple') = 'active' and public.vant_pro_pleno(pg_temp.id('m_duas_apple')));
select public.hotmart_acesso_aplicar(pg_temp.id('m_ess_e_pro'), 'ativar', 'SUB-m4', 'HP-m4', :'fim30'::timestamptz, false) \gset x_
select pg_temp.apple('m_ess_e_pro', '1000000000004609', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('M5 Hotmart Essencial + Apple Pro: the account is Pro while the Apple Pro is valid',
  public.vant_plano(pg_temp.id('m_ess_e_pro')) = 'pro' and (public.open_finance_limite(pg_temp.id('m_ess_e_pro')) ->> 'incluidos')::int = 1);
select pg_temp.apple('m_ess_e_pro', '1000000000004609', :'PRO', now() - interval '1 minute', :'t1'::timestamptz) \gset x_
select t.verdade('M6 the Apple Pro ends: the account goes back to what Hotmart still pays for (Essencial, plan on), nothing more and nothing less',
  pg_temp.plano('m_ess_e_pro') = 'active' and public.vant_plano(pg_temp.id('m_ess_e_pro')) = 'essencial' and not public.vant_pro_pleno(pg_temp.id('m_ess_e_pro')));
-- extra banks: one paid on Hotmart and one on Apple are two paid slots; the same Apple add-on repeated is still one
select public.hotmart_acesso_aplicar(pg_temp.id('m_bancos'), 'ativar', 'SUB-m5', 'HP-m5', :'fim30'::timestamptz, false) \gset x_
select public.banco_extra_registrar(pg_temp.id('m_bancos'), 'SUB-BANCO-m5', true, now() + interval '30 days');
select pg_temp.apple('m_bancos', '1000000000004610', :'BANCO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('m_bancos', '1000000000004610', :'BANCO', :'fim'::timestamptz, :'t1'::timestamptz) \gset x_
select pg_temp.apple('m_bancos', '1000000000004610', :'BANCO', :'fim30'::timestamptz, :'t2'::timestamptz) \gset x_
select t.verdade('M7 one extra bank paid on Hotmart + one on Apple = 2 extra slots; the Apple add-on renewed three times is still ONE slot',
  (public.open_finance_limite(pg_temp.id('m_bancos')) ->> 'extras')::int = 2
  and (select count(*) = 1 from public.bancos_extra_compras where chave like 'apple:%' and user_id = pg_temp.id('m_bancos')));

-- ============================================================ 5. turning auto-renew off keeps the paid period
select pg_temp.conta('r_cancela');
select pg_temp.apple('r_cancela', '1000000000004611', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('r_cancela', '1000000000004611', :'PRO', :'fim'::timestamptz, :'t1'::timestamptz, 'Production', null, null, false) \gset x_
select t.verdade('R1 THE RISK: the customer turns auto-renew off: the plan and the Pro stay on until the end of the period already paid',
  pg_temp.plano('r_cancela') = 'active' and public.vant_pro_pleno(pg_temp.id('r_cancela'))
  and (select not renova and expira_em > now() + interval '9 days' and revogada_em is null from public.apple_assinaturas where original_transaction_id = '1000000000004611'));
select pg_temp.apple('r_cancela', '1000000000004611', :'PRO', :'fim'::timestamptz, :'t2'::timestamptz, 'Production', null, null, true) \gset x_
select t.verdade('R2 auto-renew turned back on: same period, same access', (select renova from public.apple_assinaturas where original_transaction_id = '1000000000004611') and pg_temp.plano('r_cancela') = 'active');
select pg_temp.apple('r_cancela', '1000000000004611', :'PRO', :'fim'::timestamptz, :'t3'::timestamptz, 'Production', null, null, false) \gset x_
-- (test only) time passes: the paid period is over and no notification arrived
update public.apple_assinaturas set expira_em = now() - interval '1 minute' where original_transaction_id = '1000000000004611';
select public.apple_expirar_vencidas() as n \gset r3_
select t.verdade('R3 only when the paid period is over does the access end (hourly routine, no notification needed)',
  :'r3_n'::int >= 1 and pg_temp.plano('r_cancela') = 'expired' and not public.vant_pro_pleno(pg_temp.id('r_cancela')));

-- ============================================================ 6. one origin ending never harms the other
select pg_temp.conta(k) from unnest(array['e_hot_vence', 'e_apple_vence']) k;
-- Hotmart ends (overdue past the tolerance), Apple still valid
select public.hotmart_acesso_aplicar(pg_temp.id('e_hot_vence'), 'ativar', 'SUB-e1', 'HP-e1', :'fim'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('e_hot_vence'), 'hotmart', 'SUB-e1', '5y86n311', now() + interval '33 days') \gset x_
select public.banco_extra_registrar(pg_temp.id('e_hot_vence'), 'SUB-BANCO-e1', true, now() + interval '30 days');
select pg_temp.apple('e_hot_vence', '1000000000004612', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('e_hot_vence', '1000000000004613', :'BANCO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
update public.subscriptions set current_period_end = now() - interval '5 days', grace_until = now() - interval '2 days' where user_id = pg_temp.id('e_hot_vence');
select public.expire_overdue_subscriptions() \gset x_
select public.pro_revogar(pg_temp.id('e_hot_vence')) \gset x_
select public.banco_extra_registrar(pg_temp.id('e_hot_vence'), 'SUB-BANCO-e1', false, null);
select t.verdade('E1 THE RISK: everything Hotmart held ends (plan overdue, Pro revoked, bank slot closed): the Hotmart records are closed and every Apple right is intact (plan on, Pro, 1 included + 1 extra bank)',
  (select status = 'expired' from public.subscriptions where user_id = pg_temp.id('e_hot_vence'))
  and pg_temp.plano('e_hot_vence') = 'active' and public.vant_plano(pg_temp.id('e_hot_vence')) = 'pro'
  and (public.open_finance_limite(pg_temp.id('e_hot_vence')) ->> 'incluidos')::int = 1
  and (public.open_finance_limite(pg_temp.id('e_hot_vence')) ->> 'extras')::int = 1
  and (select ativo from public.bancos_extra_compras where chave = 'apple:1000000000004613'));
-- Apple ends, Hotmart still valid
select public.hotmart_acesso_aplicar(pg_temp.id('e_apple_vence'), 'ativar', 'SUB-e2', 'HP-e2', :'fim30'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('e_apple_vence'), 'hotmart', 'SUB-e2', 'ew11enu0', now() + interval '368 days') \gset x_
select public.banco_extra_registrar(pg_temp.id('e_apple_vence'), 'SUB-BANCO-e2', true, now() + interval '30 days');
select pg_temp.apple('e_apple_vence', '1000000000004614', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('e_apple_vence', '1000000000004615', :'BANCO', :'fim'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('e_apple_vence', '1000000000004614', :'PRO', now() - interval '1 minute', :'t1'::timestamptz) \gset x_
select pg_temp.apple('e_apple_vence', '1000000000004615', :'BANCO', :'fim'::timestamptz, :'t1'::timestamptz, 'Production', now()) \gset x_
select t.verdade('E2 THE RISK, the other way: the Apple plan expires and the Apple bank add-on is refunded: every Hotmart right is intact (plan on, annual Pro, 2 included + 1 extra bank) and no Hotmart row was touched',
  pg_temp.plano('e_apple_vence') = 'active' and public.vant_plano(pg_temp.id('e_apple_vence')) = 'pro_anual'
  and (public.open_finance_limite(pg_temp.id('e_apple_vence')) ->> 'incluidos')::int = 2
  and (public.open_finance_limite(pg_temp.id('e_apple_vence')) ->> 'extras')::int = 1
  and (select status = 'active' and hotmart_subscription_id = 'SUB-e2' from public.subscriptions where user_id = pg_temp.id('e_apple_vence'))
  and (select ativo from public.bancos_extra_compras where chave = 'SUB-BANCO-e2')
  and (select not ativo from public.bancos_extra_compras where chave = 'apple:1000000000004615'));
