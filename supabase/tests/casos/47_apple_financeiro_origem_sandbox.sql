-- 27/11/2026: the Apple ledger, the commercial origin and the isolation of the Sandbox
-- (migration 20261127122000). Fictional data only: invented accounts, codes, prices and dates.
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
select (now() at time zone 'America/Sao_Paulo')::date as hoje \gset
select now() - interval '40 days' as d40, now() - interval '10 days' as d10, now() - interval '5 days' as d5, now() - interval '2 days' as d2 \gset
-- shorthand: one signed transaction into the ledger
create or replace function pg_temp.tx(p_tx text, p_original text, p_k text, p_produto text, p_quando timestamptz, p_ate timestamptz, p_milesimos bigint,
  p_motivo text default 'PURCHASE', p_ambiente text default 'Production', p_reembolso timestamptz default null, p_assinado timestamptz default null)
returns text language sql as $$
  select public.apple_transacao_registrar(p_tx, p_original, pg_temp.id(p_k), p_produto, p_ambiente, p_quando, p_ate, p_milesimos, 'BRL', p_motivo,
                                          p_reembolso, case when p_reembolso is not null then '1' end, false, 'BRA', null, coalesce(p_assinado, p_quando))
$$;

-- ============================================================ commercial origin
select pg_temp.conta(k) from unnest(array['f_mensal', 'f_anual', 'f_reembolso', 'f_sem_origem']) k;
update public.profiles set origem_ref = 'parceiroum', origem_fixada_em = now() where user_id = pg_temp.id('f_mensal');
insert into public.orbis_atribuicao (user_id, code, prova) values (pg_temp.id('f_mensal'), 'PARCEIROUM', 'lead'), (pg_temp.id('f_anual'), 'VENDEDORDOIS', 'cupom');
select pg_temp.apple('f_mensal', '1000000000004701', :'PRO', :'fim'::timestamptz, :'d40'::timestamptz) \gset x_
select pg_temp.apple('f_anual', '1000000000004702', :'ANUAL', :'fim365'::timestamptz, :'d5'::timestamptz) \gset x_
select pg_temp.apple('f_reembolso', '1000000000004703', :'ESS', :'fim'::timestamptz, :'d5'::timestamptz) \gset x_
select pg_temp.apple('f_sem_origem', '1000000000004704', :'BANCO', :'fim'::timestamptz, :'d5'::timestamptz) \gset x_
select t.verdade('G1 the commercial origin is fixed on the Apple subscription when it is first stored, from what the account already carries (sign-up stamp and partner attribution)',
  (select origem_ref = 'PARCEIROUM' and parceiro_code = 'PARCEIROUM' and parceiro_prova = 'lead' and origem_fixada_em is not null from public.apple_assinaturas where original_transaction_id = '1000000000004701')
  and (select origem_ref is null and parceiro_code = 'VENDEDORDOIS' from public.apple_assinaturas where original_transaction_id = '1000000000004702')
  and (select origem_ref is null and parceiro_code is null and origem_fixada_em is null from public.apple_assinaturas where original_transaction_id = '1000000000004704'));
update public.orbis_atribuicao set code = 'OUTROPARCEIRO' where user_id = pg_temp.id('f_mensal');
select pg_temp.apple('f_mensal', '1000000000004701', :'PRO', :'fim'::timestamptz, :'d10'::timestamptz) \gset x_
select t.verdade('G2 the origin of a subscription does not change afterwards (a renewal, a later change of the account''s attribution)',
  (select parceiro_code = 'PARCEIROUM' from public.apple_assinaturas where original_transaction_id = '1000000000004701'));

-- ============================================================ the ledger
select pg_temp.tx('2000000000004711', '1000000000004701', 'f_mensal', :'PRO', :'d40'::timestamptz, :'d10'::timestamptz, 49900) as r \gset l1_
select t.verdade('L1 a purchase: gross = the price Apple signed, the fee is the estimate of that date, the estimated net is the difference, with purchase date, next renewal date, origin of the payment and the commercial origin',
  :'l1_r' = 'registrada'
  and (select valor_bruto = 49.90 and taxa_percentual = 0.2573 and taxa_estimada = 12.84 and liquido_estimado = 37.06 and moeda = 'BRL'
              and motivo = 'compra' and comprado_em = :'d40'::timestamptz and periodo_ate = :'d10'::timestamptz
              and origem_pagamento = 'apple' and ambiente = 'Production' and parceiro_code = 'PARCEIROUM' and origem_ref = 'PARCEIROUM'
              and reembolsado_em is null and liquido_informado is null and user_id = pg_temp.id('f_mensal')
         from public.apple_transacoes where transaction_id = '2000000000004711'));
select pg_temp.tx('2000000000004711', '1000000000004701', 'f_mensal', :'PRO', :'d40'::timestamptz, :'d10'::timestamptz, 99999) as r \gset l2_
select t.verdade('L2 the same transaction again (a repeated notification, a restore) is the same row: nothing doubled, the amounts of the first write stay',
  :'l2_r' = 'atualizada' and (select count(*) = 1 and bool_and(valor_bruto = 49.90) from public.apple_transacoes where transaction_id = '2000000000004711'));
select pg_temp.tx('2000000000004712', '1000000000004701', 'f_mensal', :'PRO', :'d10'::timestamptz, :'fim'::timestamptz, 49900, 'RENEWAL') \gset x_
select pg_temp.tx('2000000000004713', '1000000000004702', 'f_anual', :'ANUAL', :'d5'::timestamptz, :'fim365'::timestamptz, 419900) \gset x_
select pg_temp.tx('2000000000004714', '1000000000004703', 'f_reembolso', :'ESS', :'d5'::timestamptz, :'fim'::timestamptz, 29900) \gset x_
select t.verdade('L3 a renewal is its own transaction, with its own date and the date of the next renewal',
  (select motivo = 'renovacao' and comprado_em = :'d10'::timestamptz and periodo_ate = :'fim'::timestamptz from public.apple_transacoes where transaction_id = '2000000000004712')
  and (select valor_bruto = 419.90 and taxa_estimada = 108.04 and liquido_estimado = 311.86 from public.apple_transacoes where transaction_id = '2000000000004713'));
-- the refund: Apple signs the same transaction again, now with the date of the refund
select pg_temp.apple('f_reembolso', '1000000000004703', :'ESS', :'fim'::timestamptz, :'d2'::timestamptz, 'Production', :'d2'::timestamptz) \gset x_
select pg_temp.tx('2000000000004714', '1000000000004703', 'f_reembolso', :'ESS', :'d5'::timestamptz, :'fim'::timestamptz, 29900, 'PURCHASE', 'Production', :'d2'::timestamptz, :'d2'::timestamptz) as r \gset l4_
select t.verdade('L4 a refund marks the transaction (date and reason) and erases nothing: the sale and the refund are both readable',
  :'l4_r' = 'reembolso_registrado'
  and (select reembolsado_em = :'d2'::timestamptz and reembolso_motivo = '1' and valor_bruto = 29.90 and liquido_estimado = 22.21 from public.apple_transacoes where transaction_id = '2000000000004714'));
select pg_temp.tx('2000000000004714', '1000000000004703', 'f_reembolso', :'ESS', :'d5'::timestamptz, :'fim'::timestamptz, 29900, 'PURCHASE', 'Production', null, :'d5'::timestamptz) as r \gset l5_
select t.verdade('L5 an OLDER signed copy of a refunded transaction does not undo the refund in the ledger',
  :'l5_r' = 'antigo_ignorado' and (select reembolsado_em is not null from public.apple_transacoes where transaction_id = '2000000000004714'));
select pg_temp.tx('2000000000004715', '1000000000004704', 'f_sem_origem', :'BANCO', :'d5'::timestamptz, :'fim'::timestamptz, null) \gset x_
select t.verdade('L6 a transaction Apple signed without a price is stored with no amount (never an invented one)',
  (select valor_bruto is null and taxa_estimada is null and liquido_estimado is null from public.apple_transacoes where transaction_id = '2000000000004715'));

-- ============================================================ faturamento, MRR, a receber and caixa are four numbers
select pg_temp.admin(true);
select public.receita_apple(:'hoje'::date - 45, :'hoje'::date) as j \gset r1_
select public.receita_apple(:'hoje'::date - 15, :'hoje'::date) as j \gset r2_
select t.verdade('R1 FATURAMENTO of the last 45 days: 5 transactions (4 with a price), gross 549.60, estimated fee 141.41, estimated net 408.19; one refund of 29.90 reported apart',
  (:'r1_j'::jsonb #>> '{faturamento,transacoes}')::int = 5 and (:'r1_j'::jsonb #>> '{faturamento,compras}')::int = 4
  and (:'r1_j'::jsonb #>> '{faturamento,renovacoes}')::int = 1 and (:'r1_j'::jsonb #>> '{faturamento,sem_preco_assinado}')::int = 1
  and (:'r1_j'::jsonb #>> '{faturamento,bruto}')::numeric = 549.60
  and (:'r1_j'::jsonb #>> '{faturamento,taxa_apple_estimada}')::numeric = 141.41
  and (:'r1_j'::jsonb #>> '{faturamento,liquido_estimado}')::numeric = 408.19
  and (:'r1_j'::jsonb #>> '{reembolsos,transacoes}')::int = 1 and (:'r1_j'::jsonb #>> '{reembolsos,bruto}')::numeric = 29.90);
select t.verdade('R2 faturamento follows the date of each purchase or renewal: the last 15 days leave the first purchase out (gross 499.70)',
  (:'r2_j'::jsonb #>> '{faturamento,bruto}')::numeric = 499.70 and (:'r2_j'::jsonb #>> '{faturamento,transacoes}')::int = 4);
select t.verdade('R3 MRR is another number: what the subscriptions valid TODAY are worth per month (monthly 49.90 + annual 419.90/12 = 84.89; the refunded one and the one without a price add nothing)',
  (:'r1_j'::jsonb #>> '{mrr,bruto}')::numeric = 84.89 and (:'r1_j'::jsonb #>> '{mrr,liquido_estimado}')::numeric = 63.05
  and (:'r1_j'::jsonb #>> '{mrr,assinaturas}')::int = 3
  and (:'r1_j'::jsonb #>> '{mrr,bruto}')::numeric = (:'r2_j'::jsonb #>> '{mrr,bruto}')::numeric);
select t.verdade('R4 A RECEBER (estimated net Apple has not paid out yet, refunds left out) is 385.98, and CAIXA is 0: nothing arrived in the bank',
  (:'r1_j'::jsonb #>> '{a_receber,liquido_estimado}')::numeric = 385.98
  and (:'r1_j'::jsonb #>> '{caixa,recebido}')::numeric = 0 and (:'r1_j'::jsonb #>> '{caixa,repasses}')::int = 0);
select public.apple_repasse_registrar(:'hoje'::date - 45, :'hoje'::date - 20, 36.50, :'hoje'::date - 1, 'repasse ficticio') \gset x_
select public.receita_apple(:'hoje'::date - 45, :'hoje'::date) as j \gset r5_
select t.verdade('R5 a payout is typed in (36.50 received for the period that ended 20 days ago): CAIXA shows exactly what arrived, A RECEBER drops to what came after that period (348.92), faturamento and MRR do not move',
  (:'r5_j'::jsonb #>> '{caixa,recebido}')::numeric = 36.50 and (:'r5_j'::jsonb #>> '{caixa,repasses}')::int = 1
  and (:'r5_j'::jsonb #>> '{a_receber,liquido_estimado}')::numeric = 348.92
  and (:'r5_j'::jsonb #>> '{faturamento,bruto}')::numeric = 549.60 and (:'r5_j'::jsonb #>> '{mrr,bruto}')::numeric = 84.89);
select public.apple_taxa_definir(:'hoje'::date, 0.15, 'Small Business Program ficticio') \gset x_
select pg_temp.admin(false);
select pg_temp.tx('2000000000004716', '1000000000004701', 'f_mensal', :'PRO', now(), :'fim30'::timestamptz, 49900, 'RENEWAL') \gset x_
select t.verdade('R6 the fee is by date: a new rate applies to what is sold from then on (49.90 -> 7.49 fee, 42.41 net); what was already recorded keeps the fee of its day',
  (select taxa_percentual = 0.15 and taxa_estimada = 7.49 and liquido_estimado = 42.41 from public.apple_transacoes where transaction_id = '2000000000004716')
  and (select taxa_percentual = 0.2573 and liquido_estimado = 37.06 from public.apple_transacoes where transaction_id = '2000000000004711'));

-- ============================================================ Hotmart, Apple and both
insert into public._crm_compras_hotmart (purchase_id, user_id, subscription_id, recebido_em, renovacao, bruto, liquido)
values ('HP-FICT-1', pg_temp.id('adm'), 'SUB-FICT-1', now() - interval '3 days', false, 29.90, 24.45),
       ('HP-FICT-2', pg_temp.id('adm'), 'SUB-FICT-1', now() - interval '60 days', true, 29.90, 24.45);
select pg_temp.admin(true);
select public.receita_por_origem(:'hoje'::date - 15, :'hoje'::date) as j \gset c1_
select t.verdade('C1 revenue by origin, side by side: Hotmart (its own gross and net), Apple (gross and ESTIMATED net) and both added, each one readable on its own',
  (:'c1_j'::jsonb #>> '{hotmart,pagamentos}')::int = 1 and (:'c1_j'::jsonb #>> '{hotmart,bruto}')::numeric = 29.90 and (:'c1_j'::jsonb #>> '{hotmart,liquido}')::numeric = 24.45
  and (:'c1_j'::jsonb #>> '{apple,faturamento,bruto}')::numeric = 549.60
  and (:'c1_j'::jsonb #>> '{consolidado,faturamento_bruto}')::numeric = 579.50
  and (:'c1_j'::jsonb #>> '{consolidado,liquido}')::numeric = 24.45 + (:'c1_j'::jsonb #>> '{apple,faturamento,liquido_estimado}')::numeric
  and (:'c1_j'::jsonb #>> '{consolidado,liquido_apple_e_estimativa}')::boolean);
select public.apple_origem_comercial(:'hoje'::date - 45, :'hoje'::date) as j \gset c2_
select t.verdade('C2 Apple sales by commercial origin identify who brought the customer (partner, seller, or none) and compute NO commission',
  (select (o ->> 'assinaturas')::int = 1 and (o ->> 'transacoes')::int = 3 and (o ->> 'bruto')::numeric = 149.70 from jsonb_array_elements(:'c2_j'::jsonb -> 'origens') o where o ->> 'origem' = 'PARCEIROUM')
  and (select (o ->> 'bruto')::numeric = 419.90 from jsonb_array_elements(:'c2_j'::jsonb -> 'origens') o where o ->> 'origem' = 'VENDEDORDOIS')
  and (select (o ->> 'reembolsadas')::int = 1 from jsonb_array_elements(:'c2_j'::jsonb -> 'origens') o where o ->> 'origem' = '(sem origem)')
  and :'c2_j'::jsonb ->> 'comissao' like 'nao calculada%');
select pg_temp.admin(false);

-- ============================================================ Sandbox never reaches a commercial number
select pg_temp.conta(k) from unnest(array['t_teste', 't_teste_ess', 't_real', 't_com_hotmart', 't_com_origem', 't_com_atribuicao', 't_com_cartao']) k;
update public.profiles set email = nickname || '@exemplo.test' where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real'));
insert into public.leads (nome, email) values ('Lead de Teste', 't_teste@exemplo.test');
select public.hotmart_acesso_aplicar(pg_temp.id('t_com_hotmart'), 'ativar', 'SUB-t', 'HP-t', :'fim'::timestamptz, false) \gset x_
update public.profiles set origem_ref = 'PARCEIROUM' where user_id = pg_temp.id('t_com_origem');
insert into public.orbis_atribuicao (user_id, code) values (pg_temp.id('t_com_atribuicao'), 'PARCEIROUM');
insert into public.crm_cartoes (pipeline, etapa, user_id) values ('resgate_trial', 'dia1', pg_temp.id('t_com_cartao'));
select t.verdade('T0 before: the account whose test is over is a CRM rescue candidate, like any other',
  public._crm_trial_sem_assinar(pg_temp.id('t_teste')));
select pg_temp.admin(true);
select public.receita_apple(:'hoje'::date - 45, :'hoje'::date) as j \gset antes_
select public.total_assinantes_app() as n \gset antes_
select public.beta_vagas_preenchidas() as n \gset antesb_
select public.apple_conta_de_teste_registrar(pg_temp.id('t_teste'), 'conta de teste ficticia da revisao') \gset x_
select t.verdade('T1 an account with any commercial life is refused as a test account (Hotmart purchase, partner origin, partner attribution, open CRM card), each with its reason',
  t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('t_com_hotmart'))) like '%tem assinatura Hotmart.'
  and t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('t_com_origem'))) like '%tem origem de parceiro.'
  and t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('t_com_atribuicao'))) like '%tem atribuicao de parceiro.'
  and t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('t_com_cartao'))) like '%tem cartao aberto no CRM.'
  and t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('f_mensal'))) like '%tem assinatura Apple de producao.'
  and (select count(*) = 1 from public.apple_contas_de_teste where user_id = pg_temp.id('t_teste')));
select public.apple_conta_de_teste_registrar(pg_temp.id('t_teste_ess'), 'segunda conta de teste ficticia') \gset x_
select pg_temp.admin(false);
select t.verdade('T1b from the moment it is registered, a test account whose free test is over is no longer a CRM rescue candidate (no card is ever opened for it)',
  not public._crm_trial_sem_assinar(pg_temp.id('t_teste')) and not public._crm_trial_sem_assinar(pg_temp.id('t_teste_ess')));
-- Sandbox purchases: on the registered test account and on a real account
select pg_temp.apple('t_teste', '2000000000004721', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz, 'Sandbox') \gset x_
select pg_temp.apple('t_teste', '2000000000004722', :'BANCO', :'fim'::timestamptz, :'t0'::timestamptz, 'Sandbox') \gset x_
select pg_temp.tx('2000000000004731', '2000000000004721', 't_teste', :'PRO', now() - interval '1 hour', :'fim'::timestamptz, 49900, 'PURCHASE', 'Sandbox') \gset x_
select pg_temp.tx('2000000000004732', '2000000000004722', 't_teste', :'BANCO', now() - interval '1 hour', :'fim'::timestamptz, 12900, 'PURCHASE', 'Sandbox') \gset x_
select pg_temp.apple('t_real', '2000000000004723', :'PRO', :'fim'::timestamptz, :'t0'::timestamptz, 'Sandbox') \gset x_
select pg_temp.tx('2000000000004733', '2000000000004723', 't_real', :'PRO', now() - interval '1 hour', :'fim'::timestamptz, 49900, 'PURCHASE', 'Sandbox') \gset x_
select t.verdade('T2 the Sandbox purchase gives its rights to the authorised test account ONLY: plan on, Pro, extra bank; the same purchase on any other account gives nothing',
  pg_temp.plano('t_teste') = 'active' and public.vant_pro_pleno(pg_temp.id('t_teste')) and (public.open_finance_limite(pg_temp.id('t_teste')) ->> 'extras')::int = 1
  and pg_temp.plano('t_real') = 'expired' and not public.vant_pro_pleno(pg_temp.id('t_real')) and public.vant_plano(pg_temp.id('t_real')) = 'sem_plano');
select pg_temp.admin(true);
select public.receita_apple(:'hoje'::date - 45, :'hoje'::date) as j \gset depois_
select public.total_assinantes_app() as n \gset depois_
select public.beta_vagas_preenchidas() as n \gset depoisb_
select t.verdade('T3 REVENUE, FATURAMENTO, MRR, A RECEBER and CAIXA: the whole Apple report is identical before and after the Sandbox purchases (the Sandbox rows are stored, labelled, and never read)',
  :'antes_j'::jsonb = :'depois_j'::jsonb
  and (select count(*) = 3 and bool_and(ambiente = 'Sandbox') from public.apple_transacoes where transaction_id in ('2000000000004731', '2000000000004732', '2000000000004733')));
select t.verdade('T4 TOTAL OF PAYING SUBSCRIBERS and the subscriber lists do not count the test account, although its plan is on',
  :'antes_n'::int = :'depois_n'::int and :'antesb_n'::int = :'depoisb_n'::int
  and not exists (select 1 from public.lista_assinantes() l where l.email = 't_teste@exemplo.test')
  and not exists (select 1 from public.leads_assinantes_no_app() e where e = 't_teste@exemplo.test'));
select pg_temp.servidor();
select pg_temp.apple('t_teste_ess', '2000000000004724', :'ESS', :'fim'::timestamptz, :'t0'::timestamptz, 'Sandbox') \gset x_
select t.verdade('T5 CONVERSION: a test account with a Sandbox Essencial (plan on, no Pro) is NOT an upgrade candidate, and none of them is a rescue candidate: the CRM never opens a card for a test account, so it never counts as a lead won',
  pg_temp.plano('t_teste_ess') = 'active' and not public.vant_pro_pleno(pg_temp.id('t_teste_ess'))
  and not public._crm_assinante_sem_pro(pg_temp.id('t_teste_ess')) and not public._crm_assinante_sem_pro(pg_temp.id('t_teste'))
  and not public._crm_trial_sem_assinar(pg_temp.id('t_teste')));
select pg_temp.admin(true);
select public.apple_origem_comercial(:'hoje'::date - 45, :'hoje'::date) as j \gset t6_
select public.receita_por_origem(:'hoje'::date - 15, :'hoje'::date) as j \gset t6b_
select t.verdade('T6 COMMISSIONS and the consolidated revenue: no Sandbox sale under any origin, and the consolidated figure did not move',
  (:'t6_j'::jsonb -> 'origens') = (:'c2_j'::jsonb -> 'origens')
  and :'t6b_j'::jsonb = :'c1_j'::jsonb);
select pg_temp.admin(false);
select t.verdade('T7 a Sandbox purchase reaches no Hotmart table: no subscription, no Pro row, no Hotmart bank slot, no event, no payment',
  not exists (select 1 from public.subscriptions where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real')))
  and not exists (select 1 from public.orbis_pro where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real')))
  and not exists (select 1 from public.bancos_extra_compras where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real')) and chave not like 'apple:%')
  and not exists (select 1 from public.hotmart_eventos where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real')))
  and not exists (select 1 from public._crm_compras_hotmart where user_id in (pg_temp.id('t_teste'), pg_temp.id('t_real'))));
select pg_temp.admin(true);
select public.apple_conta_de_teste_remover(pg_temp.id('t_teste')) \gset x_
select pg_temp.admin(false);
select t.verdade('T8 the account leaves the list of test accounts: every right the Sandbox was giving ends at once',
  pg_temp.plano('t_teste') = 'expired' and not public.vant_pro_pleno(pg_temp.id('t_teste'))
  and not exists (select 1 from public.bancos_extra_compras where user_id = pg_temp.id('t_teste') and ativo));

-- ============================================================ who can read and write
select pg_temp.app(pg_temp.id('t_real'));
select t.verdade('P1 a logged-in person who is not an admin gets nothing from the revenue readers and cannot register test accounts, payouts or fees',
  public.receita_apple(:'hoje'::date - 45, :'hoje'::date) is null and public.receita_por_origem(:'hoje'::date - 45, :'hoje'::date) is null
  and public.apple_origem_comercial(:'hoje'::date - 45, :'hoje'::date) is null
  and t.erro(format('select public.apple_conta_de_teste_registrar(%L, ''motivo ficticio'')', pg_temp.id('t_real'))) like '%apenas admin'
  and t.erro('select public.apple_repasse_registrar(current_date, current_date, 1, current_date)') like '%apenas admin'
  and t.erro('select public.apple_taxa_definir(current_date, 0.1, ''motivo ficticio'')') like '%apenas admin');
select t.verdade('P2 the ledger, the payouts and the fee table are closed to the app; only the server writes a transaction',
  t.erro('select 1 from public.apple_transacoes', 'authenticated', pg_temp.id('t_real')) like '42501|%'
  and t.erro('select 1 from public.apple_repasses', 'authenticated', pg_temp.id('t_real')) like '42501|%'
  and t.erro('select 1 from public.apple_taxas', 'anon', pg_temp.id('t_real')) like '42501|%'
  and t.erro('select public.apple_transacao_registrar(''9'', ''9'', null, ''app.vant.vendas.pro.mensal'', ''Production'', now())', 'authenticated', pg_temp.id('t_real')) like '42501|%'
  and (select count(*) = 3 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('apple_transacoes', 'apple_repasses', 'apple_taxas') and c.relrowsecurity));
select pg_temp.servidor();
-- the money record outlives the account
delete from auth.users where id = pg_temp.id('f_reembolso');
select t.verdade('P3 the account is deleted: its Apple mirror goes with it, the financial record stays (without the account)',
  not exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000004703')
  and (select user_id is null and valor_bruto = 29.90 from public.apple_transacoes where transaction_id = '2000000000004714'));
