-- 27/11/2026 (Rick, option B): a subscription stays with its ORIGINAL owner whatever VANT account
-- was open on the iPhone when the plan was changed. Apple then signs the next transactions with the
-- other account's token; apple-webhook applies them with no account (p_user null), which the database
-- resolves to the owner already stored. These cases check that second pass in the real functions.
-- Fictional data only.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
\ir direitos/migracoes.sql
select pg_temp.servidor();
\ir direitos/apple.sql
\set ANUAL 'app.vant.vendas.pro.anual'
\set PRO 'app.vant.vendas.pro.mensal'

select pg_temp.conta(k) from unnest(array['r_dono', 'r_outra']) k;
-- the owner bought Pro anual on this iPhone
select pg_temp.apple('r_dono', '1000000000005201', :'ANUAL', now() + interval '1 hour', :'t0'::timestamptz, 'Production', null, null, true, '2000000000005201') \gset x_
-- another VANT account was open when the plan was changed: the renewal comes with ITS token
select public.apple_assinatura_gravar(pg_temp.id('r_outra'), '1000000000005201', :'PRO', 'Production', now() + interval '31 days', :'t1'::timestamptz,
  'ativa', null, true, null, '2000000000005202') as r \gset b1_
select t.verdade('B1 first pass, with the other account''s token: refused for that account, nothing changed yet',
  :'b1_r' = 'pertence_a_outra_conta'
  and (select produto = :'ANUAL' and user_id = pg_temp.id('r_dono') from public.apple_assinaturas where original_transaction_id = '1000000000005201'));
-- the webhook's second pass: the same signed status, no account
select public.apple_assinatura_gravar(null, '1000000000005201', :'PRO', 'Production', now() + interval '31 days', :'t1'::timestamptz,
  'ativa', null, true, null, '2000000000005202') as r \gset b2_
select t.verdade('B2 second pass, no account: the renewal reaches the ORIGINAL owner (new product and period), the subscription is NOT moved',
  :'b2_r' = 'gravada'
  and (select user_id = pg_temp.id('r_dono') and produto = :'PRO' and transaction_id = '2000000000005202' and expira_em > now() + interval '30 days'
         from public.apple_assinaturas where original_transaction_id = '1000000000005201')
  and (select count(*) = 1 from public.apple_assinaturas where original_transaction_id = '1000000000005201'));
select t.verdade('B3 the owner keeps the plan after the old period; the other account gets nothing',
  pg_temp.plano('r_dono') = 'active' and public.vant_plano(pg_temp.id('r_dono')) = 'pro'
  and pg_temp.plano('r_outra') = 'expired' and public.vant_plano(pg_temp.id('r_outra')) = 'sem_plano'
  and not exists (select 1 from public.apple_assinaturas where user_id = pg_temp.id('r_outra')));
-- the money side of that renewal: recorded once, under the owner, whatever token it carried
select public.apple_transacao_registrar(p_transacao => '2000000000005202', p_original => '1000000000005201', p_user => null,
  p_produto => :'PRO', p_ambiente => 'Production', p_comprado => :'t1'::timestamptz) as r \gset b4_
select public.apple_transacao_registrar(p_transacao => '2000000000005202', p_original => '1000000000005201', p_user => null,
  p_produto => :'PRO', p_ambiente => 'Production', p_comprado => :'t1'::timestamptz) as r \gset b4b_
select t.verdade('B4 the renewal''s sale is in the ledger once, under the original owner',
  (select count(*) = 1 and bool_and(user_id = pg_temp.id('r_dono')) from public.apple_transacoes where transaction_id = '2000000000005202'));
