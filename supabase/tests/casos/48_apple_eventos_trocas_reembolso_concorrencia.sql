-- 27/11/2026: what the three Apple functions rely on in the database: plan changes, refunds,
-- purchases restored on another account, repeated and out-of-order statuses, and two writers at the
-- same instant (real concurrent sessions, through dblink). Fictional data only.
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

-- ============================================================ plan changes inside the plan group
select pg_temp.conta('p_troca');
select pg_temp.apple('p_troca', '1000000000004801', :'ESS', :'fim'::timestamptz, :'t0'::timestamptz, 'Production', null, null, true, '2000000000004801') \gset x_
select t.verdade('P0 Essencial through Apple: plan on, no Pro, no bank', public.vant_plano(pg_temp.id('p_troca')) = 'essencial');
-- upgrade: Apple starts a new transaction of the SAME subscription, valid at once
select pg_temp.apple('p_troca', '1000000000004801', :'PRO', :'fim30'::timestamptz, :'t1'::timestamptz, 'Production', null, null, true, '2000000000004802') as r \gset p1_
select t.verdade('P1 UPGRADE Essencial -> Pro: the same subscription changes level at once; one row, Pro on, one bank included',
  :'p1_r' = 'gravada' and public.vant_plano(pg_temp.id('p_troca')) = 'pro'
  and (select count(*) = 1 and bool_and(nivel = 'pro' and produto = :'PRO' and transaction_id = '2000000000004802') from public.apple_assinaturas where user_id = pg_temp.id('p_troca'))
  and (public.open_finance_limite(pg_temp.id('p_troca')) ->> 'incluidos')::int = 1);
-- downgrade asked: it only takes effect at the next renewal, so Apple keeps signing the current (Pro) period
select pg_temp.apple('p_troca', '1000000000004801', :'PRO', :'fim30'::timestamptz, :'t2'::timestamptz, 'Production', null, null, true, '2000000000004802') \gset x_
select t.verdade('P2 DOWNGRADE asked (Pro -> Essencial): nothing changes until the period already paid ends', public.vant_plano(pg_temp.id('p_troca')) = 'pro');
select pg_temp.apple('p_troca', '1000000000004801', :'ESS', now() + interval '60 days', :'t3'::timestamptz, 'Production', null, null, true, '2000000000004803') \gset x_
select t.verdade('P3 the renewal arrives with the lower plan: Essencial from then on, plan still on, the included bank is gone',
  public.vant_plano(pg_temp.id('p_troca')) = 'essencial' and pg_temp.plano('p_troca') = 'active'
  and (public.open_finance_limite(pg_temp.id('p_troca')) ->> 'incluidos')::int = 0);
select pg_temp.apple('p_troca', '1000000000004801', :'ANUAL', :'fim365'::timestamptz, :'t4'::timestamptz, 'Production', null, null, true, '2000000000004804') \gset x_
select t.verdade('P4 change to the annual Pro: annual Pro, two banks included, still ONE subscription row',
  public.vant_plano(pg_temp.id('p_troca')) = 'pro_anual' and (public.open_finance_limite(pg_temp.id('p_troca')) ->> 'incluidos')::int = 2
  and (select count(*) = 1 from public.apple_assinaturas where user_id = pg_temp.id('p_troca')));
select pg_temp.apple('p_troca', '1000000000004801', :'BANCO', :'fim365'::timestamptz, now() + interval '1 minute') as r \gset p5_
select t.verdade('P5 a subscription never moves between the plan group and the bank group', :'p5_r' = 'grupo_diferente' and public.vant_plano(pg_temp.id('p_troca')) = 'pro_anual');

-- ============================================================ refunds
select pg_temp.conta(k) from unnest(array['q_antigo', 'q_atual', 'q_carencia']) k;
-- two periods paid; Apple refunds the FIRST one, weeks later
select pg_temp.apple('q_antigo', '1000000000004811', :'PRO', now() - interval '1 day', :'t0'::timestamptz, 'Production', null, null, true, '2000000000004811') \gset x_
select pg_temp.apple('q_antigo', '1000000000004811', :'PRO', :'fim30'::timestamptz, :'t1'::timestamptz, 'Production', null, null, true, '2000000000004812') \gset x_
select pg_temp.apple('q_antigo', '1000000000004811', :'PRO', now() - interval '1 day', :'t2'::timestamptz, 'Production', now(), null, true, '2000000000004811') as r \gset q1_
select t.verdade('Q1 refund of an OLDER period of a subscription that has a newer one: the current period and the access stay',
  :'q1_r' = 'periodo_antigo' and pg_temp.plano('q_antigo') = 'active' and public.vant_pro_pleno(pg_temp.id('q_antigo'))
  and (select revogada_em is null and transaction_id = '2000000000004812' from public.apple_assinaturas where original_transaction_id = '1000000000004811'));
select pg_temp.apple('q_atual', '1000000000004812', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz, 'Production', null, null, true, '2000000000004813') \gset x_
select pg_temp.apple('q_atual', '1000000000004812', :'PRO', :'fim30'::timestamptz, :'t1'::timestamptz, 'Production', now(), null, true, '2000000000004813') \gset x_
select t.verdade('Q2 refund of the CURRENT period: the plan and the Pro end at once, with 30 days still on the calendar',
  pg_temp.plano('q_atual') = 'expired' and not public.vant_pro_pleno(pg_temp.id('q_atual')));
select pg_temp.apple('q_atual', '1000000000004812', :'PRO', :'fim30'::timestamptz, :'t2'::timestamptz, 'Production', null, null, true, '2000000000004813') \gset x_
select t.verdade('Q3 Apple reverses the refund: the same period is valid again', pg_temp.plano('q_atual') = 'active' and public.vant_pro_pleno(pg_temp.id('q_atual')));
-- billing problem with Apple's grace period
select pg_temp.apple('q_carencia', '1000000000004813', :'PRO', now() - interval '1 hour', :'t1'::timestamptz, 'Production', null, now() + interval '3 days') \gset x_
select t.verdade('Q4 the renewal failed and Apple is in its billing grace period: the access continues during the grace',
  pg_temp.plano('q_carencia') = 'active' and public.vant_pro_pleno(pg_temp.id('q_carencia')));
select pg_temp.apple('q_carencia', '1000000000004813', :'PRO', now() - interval '1 hour', :'t2'::timestamptz, 'Production', null, null, false) \gset x_
select t.verdade('Q5 the grace ends without payment: the access ends', pg_temp.plano('q_carencia') = 'expired' and not public.vant_pro_pleno(pg_temp.id('q_carencia')));

-- a refund notified BEFORE any account claimed the purchase, then an old signed copy is presented
select pg_temp.conta('q_replay');
select public.apple_evento_registrar('uuid-ficticio-refund-1', 'REFUND', null, 'Production', '1000000000004814', null, :'t2'::timestamptz, '{"ficticio":true}'::jsonb, '2000000000004815') as r \gset q6a_
select public.apple_assinatura_gravar(null, '1000000000004814', :'PRO', 'Production', :'fim30'::timestamptz, :'t2'::timestamptz, 'reembolsada', null, false, now(), '2000000000004815') as r \gset q6b_
select public.apple_evento_concluir('uuid-ficticio-refund-1', :'q6b_r');
select pg_temp.apple('q_replay', '1000000000004814', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz, 'Production', null, null, true, '2000000000004815') as r \gset q6_
select t.verdade('Q6 REUSE BLOCKED: the refund arrived when no account had claimed the purchase (logged, "sem_dono"); presenting the old signed copy of that same transaction afterwards gives NOTHING',
  :'q6a_r' = 'novo' and :'q6b_r' = 'sem_dono' and :'q6_r' = 'reembolsada'
  and pg_temp.plano('q_replay') = 'expired' and not exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000004814'));
select pg_temp.apple('q_replay', '1000000000004814', :'PRO', :'fim30'::timestamptz, :'t3'::timestamptz, 'Production', null, null, true, '2000000000004816') as r \gset q7_
select t.verdade('Q7 a NEW paid period of that subscription (another transaction) is accepted normally',
  :'q7_r' = 'gravada' and pg_temp.plano('q_replay') = 'active');

-- ============================================================ restoring purchases, ownership
select pg_temp.conta(k) from unnest(array['d_dono', 'd_outro', 'd_novo']) k;
select pg_temp.apple('d_dono', '1000000000004821', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz, 'Production', null, null, true, '2000000000004821') \gset x_
select pg_temp.apple('d_dono', '1000000000004821', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz, 'Production', null, null, true, '2000000000004821') as r \gset d1_
select t.verdade('D1 RESTORE on the account that owns the purchase: accepted, and it is the same row with the same rights (nothing doubled)',
  :'d1_r' = 'gravada' and (select count(*) = 1 from public.apple_assinaturas where user_id = pg_temp.id('d_dono'))
  and (public.open_finance_limite(pg_temp.id('d_dono')) ->> 'incluidos')::int = 1);
select pg_temp.apple('d_outro', '1000000000004821', :'PRO', :'fim30'::timestamptz, :'t1'::timestamptz, 'Production', null, null, true, '2000000000004821') as r \gset d2_
select t.verdade('D2 REUSE BLOCKED: the same Apple purchase restored on ANOTHER VANT account is refused; the owner keeps it and the other account gets nothing',
  :'d2_r' = 'pertence_a_outra_conta' and pg_temp.plano('d_outro') = 'expired' and pg_temp.plano('d_dono') = 'active'
  and (select user_id = pg_temp.id('d_dono') and assinado_em = :'t0'::timestamptz from public.apple_assinaturas where original_transaction_id = '1000000000004821'));
select public.apple_assinatura_gravar(gen_random_uuid(), '1000000000004822', :'PRO', 'Production', :'fim30'::timestamptz, :'t0'::timestamptz) as r \gset d3_
select t.verdade('D3 a purchase whose account token is not an account of ours is kept out ("sem_dono"), never attached to someone', :'d3_r' = 'sem_dono'
  and not exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000004822'));
delete from auth.users where id = pg_temp.id('d_dono');
select pg_temp.apple('d_novo', '1000000000004821', :'PRO', :'fim30'::timestamptz, :'t2'::timestamptz, 'Production', null, null, true, '2000000000004821') as r \gset d4_
select t.verdade('D4 the owner deleted the VANT account: the same Apple subscription can then be restored on the person''s new account',
  :'d4_r' = 'gravada' and pg_temp.plano('d_novo') = 'active');

-- ============================================================ two writers at the same instant (real sessions)
create extension if not exists dblink;
select format('dbname=%s port=%s host=%s user=%s', current_database(), current_setting('port'),
              split_part(current_setting('unix_socket_directories'), ',', 1), current_user) as conn \gset
select dblink_connect('a', :'conn'), dblink_connect('b', :'conn');
select 1 from dblink('a', $$select set_config('request.jwt.claims', '{"role":"service_role"}', false)$$) as x(r text);
select 1 from dblink('b', $$select set_config('request.jwt.claims', '{"role":"service_role"}', false)$$) as x(r text);
select pg_temp.conta(k) from unnest(array['z_ordem', 'z_cancela', 'z_compra', 'z_evento']) k;

-- Z1: the device and the notification write the same NEW subscription at once; the one that arrives
-- second carries the OLDER status
select dblink_exec('a', 'begin');
select r from dblink('a', format($$select public.apple_assinatura_gravar(%L, '1000000000004831', %L, 'Production', %L, %L, 'ativa', null, true, null, '2000000000004832')$$,
  pg_temp.id('z_ordem'), :'PRO', :'fim30', :'t2')) as x(r text) \gset z1a_
select dblink_send_query('b', format($$select public.apple_assinatura_gravar(%L, '1000000000004831', %L, 'Production', %L, %L, 'ativa', null, true, null, '2000000000004831')$$,
  pg_temp.id('z_ordem'), :'PRO', :'fim', :'t1'));
select pg_sleep(0.4);
select dblink_is_busy('b') as esperando \gset z1_
select dblink_exec('a', 'commit');
select r from dblink_get_result('b') as x(r text) \gset z1b_
select * from dblink_get_result('b') as x(r text);
select t.verdade('Z1 two sessions store the same new subscription at the same instant: the second WAITS for the first, and the result is one row with the newest status (the older one, arriving last, is ignored)',
  :'z1_esperando' = '1' and :'z1a_r' = 'gravada' and :'z1b_r' = 'antigo_ignorado'
  and (select count(*) = 1 and bool_and(transaction_id = '2000000000004832' and expira_em > now() + interval '29 days') from public.apple_assinaturas where original_transaction_id = '1000000000004831'));

-- Z2: an Apple purchase is being stored while a Hotmart cancellation of the same account arrives
select public.hotmart_acesso_aplicar(pg_temp.id('z_cancela'), 'ativar', 'SUB-z2', 'HP-z2', :'fim'::timestamptz, false) \gset x_
select dblink_exec('a', 'begin');
select r from dblink('a', format($$select public.apple_assinatura_gravar(%L, '1000000000004832', %L, 'Production', %L, %L)$$,
  pg_temp.id('z_cancela'), :'PRO', :'fim30', :'t2')) as x(r text) \gset z2a_
select dblink_send_query('b', format($$select public.hotmart_acesso_aplicar(%L, 'cancelar', 'SUB-z2', 'HP-z2c')$$, pg_temp.id('z_cancela')));
select pg_sleep(0.4);
select dblink_is_busy('b') as esperando \gset z2_
select dblink_exec('a', 'commit');
select r from dblink_get_result('b') as x(r text) \gset z2b_
select * from dblink_get_result('b') as x(r text);
select t.verdade('Z2 an Apple purchase and a Hotmart cancellation of the same account at the same instant: the cancellation WAITS, then sees the Apple plan: the Hotmart row is closed and the account stays on',
  :'z2_esperando' = '1' and :'z2a_r' = 'gravada' and :'z2b_r' = 'cancelada' and pg_temp.plano('z_cancela') = 'active'
  and (select status = 'canceled' from public.subscriptions where user_id = pg_temp.id('z_cancela')));

-- Z3: the other order: the Hotmart cancellation is in progress when the Apple purchase arrives
select public.hotmart_acesso_aplicar(pg_temp.id('z_compra'), 'ativar', 'SUB-z3', 'HP-z3', :'fim'::timestamptz, false) \gset x_
select dblink_exec('a', 'begin');
select r from dblink('a', format($$select public.hotmart_acesso_aplicar(%L, 'cancelar', 'SUB-z3', 'HP-z3c')$$, pg_temp.id('z_compra'))) as x(r text) \gset z3a_
select dblink_send_query('b', format($$select public.apple_assinatura_gravar(%L, '1000000000004833', %L, 'Production', %L, %L)$$,
  pg_temp.id('z_compra'), :'ESS', :'fim30', :'t2'));
select pg_sleep(0.4);
select dblink_is_busy('b') as esperando \gset z3_
select dblink_exec('a', 'commit');
select r from dblink_get_result('b') as x(r text) \gset z3b_
select * from dblink_get_result('b') as x(r text);
select t.verdade('Z3 the other order (cancellation first, purchase waiting): the account ends ON, held by Apple',
  :'z3_esperando' = '1' and :'z3a_r' = 'cancelada' and :'z3b_r' = 'gravada' and pg_temp.plano('z_compra') = 'active'
  and (select segura_plano from public.apple_acesso where user_id = pg_temp.id('z_compra')));

-- Z4: Apple delivers the same notification twice at once
select dblink_exec('a', 'begin');
select r from dblink('a', $$select public.apple_evento_registrar('uuid-ficticio-z4', 'DID_RENEW', null, 'Production', '1000000000004834', null, now(), '{"ficticio":true}'::jsonb, '2000000000004834')$$) as x(r text) \gset z4a_
select dblink_send_query('b', $$select public.apple_evento_registrar('uuid-ficticio-z4', 'DID_RENEW', null, 'Production', '1000000000004834', null, now(), '{"ficticio":true}'::jsonb, '2000000000004834')$$);
select pg_sleep(0.4);
select dblink_is_busy('b') as esperando \gset z4_
select 1 from dblink('a', $$select public.apple_evento_concluir('uuid-ficticio-z4', 'gravada')$$) as x(r text);
select dblink_exec('a', 'commit');
select r from dblink_get_result('b') as x(r text) \gset z4b_
select * from dblink_get_result('b') as x(r text);
select t.verdade('Z4 the same notification delivered twice at the same instant: the second waits and finds it already processed ("repetido"); one row',
  :'z4_esperando' = '1' and :'z4a_r' = 'novo' and :'z4b_r' = 'repetido'
  and (select count(*) = 1 from public.apple_eventos where notification_uuid = 'uuid-ficticio-z4'));

-- Z5: the same transaction reaches the ledger from two sessions
select dblink_exec('a', 'begin');
select r from dblink('a', format($$select public.apple_transacao_registrar('2000000000004835', '1000000000004831', null, %L, 'Production', now(), null, 49900, 'BRL', 'PURCHASE')$$, :'PRO')) as x(r text) \gset z5a_
select dblink_send_query('b', format($$select public.apple_transacao_registrar('2000000000004835', '1000000000004831', null, %L, 'Production', now(), null, 49900, 'BRL', 'PURCHASE')$$, :'PRO'));
select pg_sleep(0.4);
select dblink_exec('a', 'commit');
select r from dblink_get_result('b') as x(r text) \gset z5b_
select * from dblink_get_result('b') as x(r text);
select t.verdade('Z5 the same sale reaching the ledger twice at the same instant is ONE sale (the revenue is not doubled)',
  :'z5a_r' = 'registrada' and :'z5b_r' = 'atualizada'
  and (select count(*) = 1 and sum(valor_bruto) = 49.90 from public.apple_transacoes where transaction_id = '2000000000004835'));
select dblink_disconnect('a'), dblink_disconnect('b');

-- ============================================================ the hourly repair
select pg_temp.conta('h_reparo');
select pg_temp.apple('h_reparo', '1000000000004841', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
update public.profiles set plan_status = 'expired' where user_id = pg_temp.id('h_reparo');  -- something blocked it without asking
select public.apple_expirar_vencidas() \gset x_
select t.verdade('H1 an account Apple is paying for that something blocked without asking is turned on again by the hourly routine',
  pg_temp.plano('h_reparo') = 'active');
select t.verdade('H2 the reconciliation list asks Apple first about what was never confirmed; a subscription confirmed minutes ago is left alone',
  exists (select 1 from public.apple_conciliar_lista(500) l where l.original_transaction_id = '1000000000004841')
  and (select public.apple_assinatura_gravar(pg_temp.id('h_reparo'), '1000000000004841', :'PRO', 'Production', :'fim30'::timestamptz, :'t1'::timestamptz, 'ativa', null, true, null, null, true) = 'gravada'));
select t.verdade('H3 after Apple confirmed it, it leaves the list until the next round',
  not exists (select 1 from public.apple_conciliar_lista(500) l where l.original_transaction_id = '1000000000004841')
  and (select conferida_em is not null from public.apple_assinaturas where original_transaction_id = '1000000000004841'));
