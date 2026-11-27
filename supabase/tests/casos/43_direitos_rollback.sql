-- 27/11/2026: ROLLBACK. Migration applied, an Apple test subscription stored, then
-- supabase/direitos-apple/rollback.sql: the functions are production's again (the photograph of
-- casos/40 gives the same answers), the Apple objects are gone and Hotmart data was never touched.
\ir direitos/preparo.sql
\ir ../../migrations/20261127120000_direitos_multi_provedor_apple.sql

select pg_temp.conta('rb_hotmart');
select pg_temp.conta('rb_teste_apple');
select public.hotmart_acesso_aplicar(pg_temp.id('rb_hotmart'), 'ativar', 'SUB-RB', 'HP-RB', now() + interval '10 days', false) \gset x_
select public.banco_extra_registrar(pg_temp.id('rb_hotmart'), 'SUB-BANCO-RB', true, now() + interval '30 days');
insert into public.apple_contas_de_teste (user_id, motivo) values (pg_temp.id('rb_teste_apple'), 'conta de teste do rollback');
select public.apple_assinatura_gravar(pg_temp.id('rb_teste_apple'), '2000000000000901', 'app.vant.vendas.pro.mensal', 'Sandbox', now() + interval '5 minutes', now()) \gset x_
select public.apple_assinatura_gravar(pg_temp.id('rb_teste_apple'), '2000000000000902', 'app.vant.vendas.banco.mensal', 'Sandbox', now() + interval '5 minutes', now()) \gset x_
select t.verdade('RB0 before the rollback the Sandbox test account has its Apple plan and bank slot',
  pg_temp.plano('rb_teste_apple') = 'active' and public.vant_pro_pleno(pg_temp.id('rb_teste_apple'))
  and exists (select 1 from public.bancos_extra_compras where chave = 'apple:2000000000000902' and ativo));

-- a Production subscription stops the whole rollback (one transaction: nothing is changed)
select public.apple_assinatura_gravar(pg_temp.id('rb_hotmart'), '1000000000000903', 'app.vant.vendas.essencial.mensal', 'Production', now() + interval '30 days', now()) \gset x_
\set ON_ERROR_STOP off
\o /dev/null
\ir ../../direitos-apple/rollback.sql
\o
\set ON_ERROR_STOP on
select t.verdade('RB1 with a Production subscription stored the rollback is refused and changes NOTHING: Apple objects and the guarded functions are still there',
  to_regclass('public.apple_assinaturas') is not null
  and exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000000903')
  and (select prosrc like '%vant_plano_pago_por_outro%' from pg_proc where proname = 'hotmart_acesso_aplicar' and pronamespace = 'public'::regnamespace)
  and (select prosrc like '%apple_pro_valido%' from pg_proc where proname = 'vant_pro_pleno' and pronamespace = 'public'::regnamespace)
  and exists (select 1 from public.bancos_extra_compras where chave = 'apple:2000000000000902' and ativo));
-- (test only) the fictional Production subscription is removed so the rollback can be exercised
delete from public.apple_assinaturas where original_transaction_id = '1000000000000903';
delete from public.apple_acesso where user_id = pg_temp.id('rb_hotmart');

\ir ../../direitos-apple/rollback.sql

select t.verdade('RB2 the Apple tables and functions are gone',
  to_regclass('public.apple_assinaturas') is null and to_regclass('public.apple_eventos') is null
  and to_regclass('public.apple_contas_de_teste') is null and to_regclass('public.apple_acesso') is null
  and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and (p.proname like 'apple\_%' or p.proname in ('vant_direitos', 'vant_plano_pago_por_outro', 'hotmart_plano_valido'))));
select t.verdade('RB3 the Hotmart subscription and the Hotmart bank slot were not touched',
  (select status = 'active' and hotmart_subscription_id = 'SUB-RB' from public.subscriptions where user_id = pg_temp.id('rb_hotmart'))
  and pg_temp.plano('rb_hotmart') = 'active'
  and (select ativo and ate > now() + interval '29 days' from public.bancos_extra_compras where chave = 'SUB-BANCO-RB'));
select t.verdade('RB4 the bank slot written by Apple is closed; no function reads the Apple mirror any more',
  (select not ativo from public.bancos_extra_compras where chave = 'apple:2000000000000902')
  and not public.vant_pro_pleno(pg_temp.id('rb_teste_apple')));
select t.verdade('RB5 the six functions are byte-for-byte production''s again',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname, left(md5(lower(regexp_replace(p.prosrc, '\s+', '', 'g'))), 10)) in
          (('hotmart_acesso_aplicar', '29d8a279c8'), ('expire_overdue_subscriptions', '47843e903e'), ('vant_pro_pleno', 'ebb3e5b5e9'),
           ('pro_anual', '23c31b060e'), ('open_finance_limite', '0c9fbcebc2'), ('orbis_pro_status', '42fd3773ab'))) = 6);

\ir direitos/caracterizacao.sql
