-- 27/11/2026: ROLLBACK of the four draft migrations. Migrations applied, used (a Sandbox test
-- subscription, a courtesy that survived a Hotmart revocation, a lifted suspension), then
-- supabase/direitos-apple/rollback.sql: the eighteen functions are production's again (the photographs
-- of casos/40 and casos/44 give today's answers), the new objects are gone, Hotmart data was never
-- touched and nobody lost a courtesy.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
\ir direitos/migracoes.sql
select pg_temp.servidor();
\ir direitos/apple.sql

select pg_temp.conta(k) from unnest(array['rb_hotmart', 'rb_teste_apple', 'rb_cortesia', 'rb_suspensa']) k;
select public.hotmart_acesso_aplicar(pg_temp.id('rb_hotmart'), 'ativar', 'SUB-RB', 'HP-RB', now() + interval '10 days', false) \gset x_
select public.banco_extra_registrar(pg_temp.id('rb_hotmart'), 'SUB-BANCO-RB', true, now() + interval '30 days');
select pg_temp.admin(true);
select public.apple_conta_de_teste_registrar(pg_temp.id('rb_teste_apple'), 'conta de teste do rollback') \gset x_
select pg_temp.admin(false);
select pg_temp.apple('rb_teste_apple', '2000000000000901', 'app.vant.vendas.pro.mensal', now() + interval '5 minutes', now(), 'Sandbox') \gset x_
select pg_temp.apple('rb_teste_apple', '2000000000000902', 'app.vant.vendas.banco.mensal', now() + interval '5 minutes', now(), 'Sandbox') \gset x_
select public.apple_transacao_registrar('2000000000000911', '2000000000000901', pg_temp.id('rb_teste_apple'), 'app.vant.vendas.pro.mensal', 'Sandbox', now(), null, 49900, 'BRL', 'PURCHASE') \gset x_
-- a courtesy Pro, a Hotmart Pro on top of it, and the Hotmart Pro revoked: held only by the courtesy mark
select public.pro_conceder(pg_temp.id('rb_cortesia'), 'cortesia', null, null, null) \gset x_
select public.pro_conceder(pg_temp.id('rb_cortesia'), 'hotmart', 'SUB-RBC', '5y86n311', now() + interval '33 days') \gset x_
select public.pro_revogar(pg_temp.id('rb_cortesia')) \gset x_
select t.verdade('RB0 before the rollback: the Sandbox test account has its Apple plan and bank slot, and the courtesy survived the Hotmart revocation',
  pg_temp.plano('rb_teste_apple') = 'active' and public.vant_pro_pleno(pg_temp.id('rb_teste_apple'))
  and exists (select 1 from public.bancos_extra_compras where chave = 'apple:2000000000000902' and ativo)
  and public.vant_pro_pleno(pg_temp.id('rb_cortesia')) and (select not ativo and cortesia from public.orbis_pro where user_id = pg_temp.id('rb_cortesia')));

-- each thing only Rick can decide about stops the whole rollback (one transaction: nothing is changed)
create or replace function pg_temp.intacto() returns boolean language sql as $$
  select to_regclass('public.apple_assinaturas') is not null and to_regclass('public.apple_transacoes') is not null
     and to_regclass('public.acesso_suspenso') is not null
     and (select prosrc like '%vant_plano_pago_por_outro%' from pg_proc where proname = 'hotmart_acesso_aplicar' and pronamespace = 'public'::regnamespace)
     and (select prosrc like '%apple_pro_valido%' from pg_proc where proname = 'vant_pro_pleno' and pronamespace = 'public'::regnamespace)
     and (select prosrc like '%apple_conta_de_teste%' from pg_proc where proname = 'total_assinantes_app' and pronamespace = 'public'::regnamespace)
     and exists (select 1 from public.bancos_extra_compras where chave = 'apple:2000000000000902' and ativo)
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orbis_pro' and column_name = 'cortesia')
$$;
-- (a) a Production subscription
select pg_temp.apple('rb_hotmart', '1000000000000903', 'app.vant.vendas.essencial.mensal', now() + interval '30 days', now()) \gset x_
\set ON_ERROR_STOP off
\o /dev/null
\ir ../../direitos-apple/rollback.sql
\o
\set ON_ERROR_STOP on
select t.verdade('RB1 with a Production Apple subscription stored the rollback is refused and changes NOTHING', pg_temp.intacto()
  and exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000000903'));
delete from public.apple_assinaturas where original_transaction_id = '1000000000000903';   -- (test only)
delete from public.apple_acesso where user_id = pg_temp.id('rb_hotmart');
-- (b) a Production sale in the ledger
select public.apple_transacao_registrar('2000000000000912', '1000000000000903', null, 'app.vant.vendas.essencial.mensal', 'Production', now(), null, 29900, 'BRL', 'PURCHASE') \gset x_
\set ON_ERROR_STOP off
\o /dev/null
\ir ../../direitos-apple/rollback.sql
\o
\set ON_ERROR_STOP on
select t.verdade('RB2 with a Production sale in the Apple ledger the rollback is refused and changes NOTHING (financial records are never dropped by a script)', pg_temp.intacto()
  and exists (select 1 from public.apple_transacoes where transaction_id = '2000000000000912'));
delete from public.apple_transacoes where transaction_id = '2000000000000912';   -- (test only)
-- (c) a suspension in force
select pg_temp.admin(true);
select public.admin_suspender_acesso(pg_temp.id('rb_suspensa'), 'suspensao ficticia do rollback') \gset x_
select pg_temp.admin(false);
\set ON_ERROR_STOP off
\o /dev/null
\ir ../../direitos-apple/rollback.sql
\o
\set ON_ERROR_STOP on
select t.verdade('RB3 with a suspension in force the rollback is refused and changes NOTHING', pg_temp.intacto() and public.conta_suspensa(pg_temp.id('rb_suspensa')));
select pg_temp.admin(true);
select public.admin_liberar_acesso(pg_temp.id('rb_suspensa'), 'liberada antes do rollback') \gset x_
select pg_temp.admin(false);

\ir ../../direitos-apple/rollback.sql

select t.verdade('RB4 the new tables, functions and the trigger are gone; only the history of lifted suspensions is kept',
  to_regclass('public.apple_assinaturas') is null and to_regclass('public.apple_eventos') is null
  and to_regclass('public.apple_contas_de_teste') is null and to_regclass('public.apple_acesso') is null
  and to_regclass('public.apple_transacoes') is null and to_regclass('public.apple_repasses') is null and to_regclass('public.apple_taxas') is null
  and not exists (select 1 from pg_trigger where tgname = 'zz_profiles_respeita_suspensao')
  and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orbis_pro' and column_name like 'cortesia%')
  and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and (p.proname like 'apple\_%' or p.proname in
                     ('receita_apple', 'receita_por_origem', 'vant_direitos', 'vant_plano_pago_por_outro', 'hotmart_plano_valido', 'conta_suspensa', 'profiles_respeita_suspensao',
                      'vant_plano_principal_valido', 'vant_acesso_recalcular', 'admin_suspender_acesso', 'admin_liberar_acesso', 'pro_cortesia_revogar', 'orbis_pro_vale', 'assinatura_apple_oferta')))
  and (select count(*) = 1 from public.acesso_suspenso where liberado_em is not null));
select t.verdade('RB5 the Hotmart subscription and the Hotmart bank slot were not touched',
  (select status = 'active' and hotmart_subscription_id = 'SUB-RB' from public.subscriptions where user_id = pg_temp.id('rb_hotmart'))
  and pg_temp.plano('rb_hotmart') = 'active'
  and (select ativo and ate > now() + interval '29 days' from public.bancos_extra_compras where chave = 'SUB-BANCO-RB'));
select t.verdade('RB6 the bank slot written by Apple is closed; no function reads the Apple mirror any more',
  (select not ativo from public.bancos_extra_compras where chave = 'apple:2000000000000902')
  and not public.vant_pro_pleno(pg_temp.id('rb_teste_apple')));
select t.verdade('RB7 nobody lost a courtesy: the one that was held only by the courtesy mark is a plain courtesy row again, and gives the Pro with production''s own reader',
  public.vant_pro_pleno(pg_temp.id('rb_cortesia'))
  and (select ativo and origem = 'cortesia' and cancelado_em is null and expira_em is null from public.orbis_pro where user_id = pg_temp.id('rb_cortesia')));
select t.verdade('RB8 the eighteen functions are production''s again, by fingerprint (pro_revogar was never changed)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname, left(md5(lower(regexp_replace(p.prosrc, '\s+', '', 'g'))), 10)) in
          (('hotmart_acesso_aplicar', '29d8a279c8'), ('expire_overdue_subscriptions', '47843e903e'), ('vant_pro_pleno', 'ebb3e5b5e9'),
           ('pro_anual', '23c31b060e'), ('open_finance_limite', '0c9fbcebc2'), ('orbis_pro_status', '42fd3773ab'),
           ('orbis_pro_ativo', '0bca1afef2'), ('vant_plano', 'b5096ae261'), ('pro_conceder', '06d0bacb4a'), ('pro_revogar', '57cdf97bdb'),
           ('admin_assinatura_manual', '52e799d460'), ('total_assinantes_app', 'a9354b933f'), ('lista_assinantes', '8f6367dbb2'),
           ('leads_assinantes_no_app', '8700c8fcef'), ('beta_vagas_preenchidas', '6db9db3070'), ('_crm_trial_sem_assinar', 'd574837fcb'),
           ('_crm_assinante_sem_pro', 'b36b636e3c'), ('parceiros_painel', '21280dfd4b'), ('parceiros_resumo', '32a930da42'))) = 19);

-- (test only) the rows the scenarios above left behind would change the counters of the photographs
delete from public.assinatura_manual;
\ir direitos/caracterizacao.sql
\ir direitos/riscos.sql
