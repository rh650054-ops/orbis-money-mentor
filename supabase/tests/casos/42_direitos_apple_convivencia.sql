-- 27/11/2026: Apple and Hotmart on the same account (migration 20261127120000). Fictional data only.
-- THE RULE: the access is the sum of what each origin guarantees; an event of one provider never
-- takes away a right the other one still holds, in either direction.
\ir direitos/preparo.sql
\ir ../../migrations/20261127120000_direitos_multi_provedor_apple.sql
select pg_temp.servidor();
select now() + interval '10 days' as fim \gset
select now() + interval '30 days' as fim30 \gset
select now() - interval '2 hours' as t0 \gset
select now() - interval '1 hour' as t1 \gset
select now() - interval '30 minutes' as t2 \gset
select now() as t3 \gset
-- shorthand: one Apple status (Production unless told otherwise), signed at p_assinado
create or replace function pg_temp.apple(p_k text, p_original text, p_produto text, p_expira timestamptz, p_assinado timestamptz,
  p_ambiente text default 'Production', p_revogada timestamptz default null, p_tolerancia timestamptz default null)
returns text language sql as $$
  select public.apple_assinatura_gravar(pg_temp.id(p_k), p_original, p_produto, p_ambiente, p_expira, p_assinado, 'ativa', p_tolerancia, true, p_revogada, null)
$$;

-- ============================================================ the catalogue decides the right
select t.verdade('A1 the four products and the right each one gives; anything else gives nothing',
  (select direito = 'plano' and nivel = 'essencial' and not anual from public.apple_produto('app.vant.vendas.essencial.mensal'))
  and (select direito = 'plano' and nivel = 'pro' and not anual from public.apple_produto('app.vant.vendas.pro.mensal'))
  and (select direito = 'plano' and nivel = 'pro' and anual from public.apple_produto('app.vant.vendas.pro.anual'))
  and (select direito = 'banco' and nivel is null from public.apple_produto('app.vant.vendas.banco.mensal'))
  and not exists (select 1 from public.apple_produto('app.vant.vendas.pro.vitalicio')));
select pg_temp.conta('a_desconhecido');
select t.verdade('A2 a product that is not in the catalogue is refused and stores nothing',
  t.erro(format('select public.apple_assinatura_gravar(%L, ''1000000000000001'', ''app.vant.vendas.pro.vitalicio'', ''Production'', now() + interval ''1 day'', now())', pg_temp.id('a_desconhecido')))
    like '%produto desconhecido%'
  and not exists (select 1 from public.apple_assinaturas where user_id = pg_temp.id('a_desconhecido')) and pg_temp.plano('a_desconhecido') = 'expired');

-- ============================================================ buying through Apple
select pg_temp.conta('a_essencial', 'teste');
select pg_temp.apple('a_essencial', '1000000000000010', 'app.vant.vendas.essencial.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) as r \gset a3_
select t.verdade('A3 Essencial bought during the free test: stored, plan active, test flag off, plan "essencial", no Pro, no Hotmart row created',
  :'a3_r' = 'gravada' and (select plan_status = 'active' and not is_trial_active from public.profiles where user_id = pg_temp.id('a_essencial'))
  and public.vant_plano(pg_temp.id('a_essencial')) = 'essencial' and not public.vant_pro_pleno(pg_temp.id('a_essencial'))
  and not exists (select 1 from public.subscriptions where user_id = pg_temp.id('a_essencial'))
  and not exists (select 1 from public.orbis_pro where user_id = pg_temp.id('a_essencial')));

select pg_temp.conta('a_pro');
select pg_temp.apple('a_pro', '1000000000000020', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select t.verdade('A4 monthly Pro through Apple: plan active, Pro on, plan "pro", not annual, one bank included, nothing written to orbis_pro',
  pg_temp.plano('a_pro') = 'active' and public.vant_pro_pleno(pg_temp.id('a_pro')) and public.orbis_pro_ativo(pg_temp.id('a_pro'))
  and public.vant_plano(pg_temp.id('a_pro')) = 'pro' and not public.pro_anual(pg_temp.id('a_pro'))
  and (public.open_finance_limite(pg_temp.id('a_pro')) ->> 'incluidos')::int = 1
  and not exists (select 1 from public.orbis_pro where user_id = pg_temp.id('a_pro')));

select pg_temp.conta('a_anual');
select pg_temp.apple('a_anual', '1000000000000030', 'app.vant.vendas.pro.anual', now() + interval '365 days', :'t1'::timestamptz) \gset x_
select t.verdade('A5 annual Pro through Apple: plan "pro_anual", two banks included',
  public.pro_anual(pg_temp.id('a_anual')) and public.vant_plano(pg_temp.id('a_anual')) = 'pro_anual'
  and (public.open_finance_limite(pg_temp.id('a_anual')) ->> 'incluidos')::int = 2);
select pg_temp.app(pg_temp.id('a_pro'));
select t.verdade('A6 "Minha Conta" of an Apple Pro: pro, origin "apple", with start and end', (select pro and origem = 'apple' and desde is not null and ate > now() + interval '29 days' from public.orbis_pro_status()));
select pg_temp.servidor();

-- upgrade inside the group keeps the original transaction: the same row changes level
select pg_temp.apple('a_essencial', '1000000000000010', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t2'::timestamptz) as r \gset a7_
select t.verdade('A7 upgrade Essencial → Pro on the same subscription: one row, now Pro',
  :'a7_r' = 'gravada' and (select count(*) = 1 and bool_and(nivel = 'pro') from public.apple_assinaturas where user_id = pg_temp.id('a_essencial'))
  and public.vant_plano(pg_temp.id('a_essencial')) = 'pro');
select pg_temp.apple('a_essencial', '1000000000000010', 'app.vant.vendas.essencial.mensal', :'fim30'::timestamptz, :'t3'::timestamptz) \gset x_
select t.verdade('A8 downgrade Pro → Essencial at renewal: Pro off, plan still active',
  public.vant_plano(pg_temp.id('a_essencial')) = 'essencial' and pg_temp.plano('a_essencial') = 'active');

-- ============================================================ the end of an Apple right
select pg_temp.conta('a_expira');
select pg_temp.apple('a_expira', '1000000000000040', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('a_expira', '1000000000000040', 'app.vant.vendas.pro.mensal', now() - interval '1 minute', :'t1'::timestamptz) \gset x_
select t.verdade('F1 the period ended and Apple says so: account blocked, Pro off',
  pg_temp.plano('a_expira') = 'expired' and not public.vant_pro_pleno(pg_temp.id('a_expira')) and public.vant_plano(pg_temp.id('a_expira')) = 'sem_plano');
select pg_temp.apple('a_expira', '1000000000000040', 'app.vant.vendas.pro.mensal', now() - interval '1 minute', :'t2'::timestamptz, 'Production', null, now() + interval '3 days') \gset x_
select t.verdade('F2 charge failed but Apple''s billing grace is running: access back until the grace ends',
  pg_temp.plano('a_expira') = 'active' and public.vant_pro_pleno(pg_temp.id('a_expira')));
select pg_temp.apple('a_expira', '1000000000000040', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t3'::timestamptz, 'Production', now()) \gset x_
select t.verdade('F3 refund (revocation): the right ends at once, even with the period still running',
  pg_temp.plano('a_expira') = 'expired' and not public.vant_pro_pleno(pg_temp.id('a_expira')));

select pg_temp.conta('a_silencio');
select pg_temp.apple('a_silencio', '1000000000000050', 'app.vant.vendas.essencial.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
update public.apple_assinaturas set expira_em = now() - interval '1 minute' where original_transaction_id = '1000000000000050';
select t.verdade('F4 the period ended with NO notification: the plan flag is still on until the hourly sweep', pg_temp.plano('a_silencio') = 'active');
select public.apple_expirar_vencidas() as n \gset f5_
select t.verdade('F5 the hourly sweep blocks exactly that account', :'f5_n'::int = 1 and pg_temp.plano('a_silencio') = 'expired');
select public.apple_expirar_vencidas() as n \gset f6_
select t.igual('F6 the sweep is idempotent', :'f6_n'::numeric, 0);

-- ============================================================ Hotmart never takes away what Apple holds
select pg_temp.conta('c_cancela');
select public.hotmart_acesso_aplicar(pg_temp.id('c_cancela'), 'ativar', 'SUB-C1', 'HP-C1', :'fim'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('c_cancela'), 'hotmart', 'SUB-C1', '5y86n311', :'fim'::timestamptz) \gset x_
select pg_temp.apple('c_cancela', '1000000000000060', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('c_cancela'), 'cancelar', 'SUB-C1', 'HP-C2') as r \gset c1_
select t.verdade('C1 Hotmart cancellation while Apple holds a valid plan: the Hotmart row is canceled, the account stays active',
  :'c1_r' = 'cancelada' and (select status = 'canceled' from public.subscriptions where user_id = pg_temp.id('c_cancela')) and pg_temp.plano('c_cancela') = 'active');
select public.pro_revogar(pg_temp.id('c_cancela')) \gset x_
select t.verdade('C2 Hotmart revokes ITS Pro: orbis_pro is off, and the Pro bought through Apple is intact',
  (select not ativo from public.orbis_pro where user_id = pg_temp.id('c_cancela')) and public.vant_pro_pleno(pg_temp.id('c_cancela'))
  and public.vant_plano(pg_temp.id('c_cancela')) = 'pro'
  and (select revogada_em is null and expira_em = :'fim30'::timestamptz from public.apple_assinaturas where original_transaction_id = '1000000000000060'));
select pg_temp.apple('c_cancela', '1000000000000060', 'app.vant.vendas.pro.mensal', now() - interval '1 minute', :'t2'::timestamptz) \gset x_
select t.verdade('C3 later the Apple period ends too: now nobody holds the account and it is blocked', pg_temp.plano('c_cancela') = 'expired' and not public.vant_pro_pleno(pg_temp.id('c_cancela')));

select pg_temp.conta('c_vence');
select public.hotmart_acesso_aplicar(pg_temp.id('c_vence'), 'ativar', 'SUB-C2', 'HP-C3', now() + interval '1 day', false) \gset x_
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '4 days', grace_until = now() - interval '1 day' where user_id = pg_temp.id('c_vence');
select pg_temp.apple('c_vence', '1000000000000070', 'app.vant.vendas.essencial.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select pg_temp.conta('c_vence_so_hotmart');
select public.hotmart_acesso_aplicar(pg_temp.id('c_vence_so_hotmart'), 'ativar', 'SUB-C3', 'HP-C4', now() + interval '1 day', false) \gset x_
update public.subscriptions set status = 'past_due', grace_until = now() - interval '1 day' where user_id = pg_temp.id('c_vence_so_hotmart');
select public.expire_overdue_subscriptions() as n \gset c4_
select t.verdade('C4 the hourly Hotmart expiry with an overdue Hotmart row and a valid Apple plan: the row is closed, the account stays active; the Hotmart-only account next to it is blocked as always',
  :'c4_n'::int = 1
  and (select status = 'expired' from public.subscriptions where user_id = pg_temp.id('c_vence')) and pg_temp.plano('c_vence') = 'active'
  and pg_temp.plano('c_vence_so_hotmart') = 'expired');

-- ============================================================ Apple never takes away what Hotmart holds
select pg_temp.conta('d_reembolso');
select public.hotmart_acesso_aplicar(pg_temp.id('d_reembolso'), 'ativar', 'SUB-D1', 'HP-D1', :'fim'::timestamptz, false) \gset x_
select public.pro_conceder(pg_temp.id('d_reembolso'), 'hotmart', 'SUB-D1', '5y86n311', :'fim'::timestamptz) \gset x_
select pg_temp.apple('d_reembolso', '1000000000000080', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select pg_temp.apple('d_reembolso', '1000000000000080', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t2'::timestamptz, 'Production', now()) \gset x_
select t.verdade('D1 Apple refund while Hotmart is paid: the account stays active, the Hotmart row and the Hotmart Pro are untouched',
  pg_temp.plano('d_reembolso') = 'active'
  and (select status = 'active' and hotmart_subscription_id = 'SUB-D1' and current_period_end = :'fim'::timestamptz from public.subscriptions where user_id = pg_temp.id('d_reembolso'))
  and (select ativo and origem = 'hotmart' and cancelado_em is null from public.orbis_pro where user_id = pg_temp.id('d_reembolso'))
  and public.vant_pro_pleno(pg_temp.id('d_reembolso')));
select public.hotmart_acesso_aplicar(pg_temp.id('d_reembolso'), 'cancelar', 'SUB-D1', 'HP-D2') \gset x_
select t.verdade('D2 then Hotmart is cancelled as well: blocked, because no provider holds a valid plan', pg_temp.plano('d_reembolso') = 'expired');

select pg_temp.conta('d_manual');
update public.profiles set plan_status = 'active' where user_id = pg_temp.id('d_manual');
select pg_temp.apple('d_manual', '1000000000000090', 'app.vant.vendas.essencial.mensal', now() - interval '3 days', :'t1'::timestamptz) \gset x_
select public.apple_expirar_vencidas() \gset x_
select t.verdade('D3 Apple only undoes what Apple did: an old, already expired Apple subscription never blocks an account activated another way',
  pg_temp.plano('d_manual') = 'active' and (select not segura_plano from public.apple_acesso where user_id = pg_temp.id('d_manual')));

select pg_temp.conta('d_equipe', 'equipe');
select pg_temp.apple('d_equipe', '1000000000000095', 'app.vant.vendas.essencial.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select t.verdade('D4 courtesy stays courtesy: the account reads "equipe" with or without an Apple purchase', public.vant_plano(pg_temp.id('d_equipe')) = 'equipe');

-- ============================================================ the extra bank never releases the main plan
select pg_temp.conta('b_so_banco');
select pg_temp.apple('b_so_banco', '1000000000000100', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) as r \gset b1_
select t.verdade('B1 extra bank through Apple on an account WITHOUT a plan: one slot under its own key; the account stays blocked, no Pro, no plan row, Apple holds no plan',
  :'b1_r' = 'gravada'
  and (select ativo and ate = :'fim30'::timestamptz and user_id = pg_temp.id('b_so_banco') from public.bancos_extra_compras where chave = 'apple:1000000000000100')
  and pg_temp.plano('b_so_banco') = 'expired' and not public.vant_pro_pleno(pg_temp.id('b_so_banco')) and not public.apple_plano_valido(pg_temp.id('b_so_banco'))
  and (select not segura_plano from public.apple_acesso where user_id = pg_temp.id('b_so_banco'))
  and not exists (select 1 from public.subscriptions where user_id = pg_temp.id('b_so_banco')));

select pg_temp.conta('b_dois');
select public.hotmart_acesso_aplicar(pg_temp.id('b_dois'), 'ativar', 'SUB-B', 'HP-B', :'fim'::timestamptz, false) \gset x_
select public.banco_extra_registrar(pg_temp.id('b_dois'), 'SUB-BANCO-HOTMART', true, :'fim'::timestamptz);
select pg_temp.apple('b_dois', '1000000000000110', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select t.verdade('B2 a Hotmart slot and an Apple slot add up: two extra banks, the Hotmart slot untouched',
  (public.open_finance_limite(pg_temp.id('b_dois')) ->> 'extras')::int = 2
  and (select ativo and ate = :'fim'::timestamptz from public.bancos_extra_compras where chave = 'SUB-BANCO-HOTMART'));
select pg_temp.apple('b_dois', '1000000000000110', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t2'::timestamptz, 'Production', now()) \gset x_
select t.verdade('B3 the Apple slot is refunded: one extra bank left, the Hotmart slot and the Hotmart plan untouched',
  (public.open_finance_limite(pg_temp.id('b_dois')) ->> 'extras')::int = 1
  and (select not ativo from public.bancos_extra_compras where chave = 'apple:1000000000000110')
  and (select ativo and ate = :'fim'::timestamptz from public.bancos_extra_compras where chave = 'SUB-BANCO-HOTMART')
  and pg_temp.plano('b_dois') = 'active');
select pg_temp.apple('b_dois', '1000000000000111', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select public.banco_extra_registrar(pg_temp.id('b_dois'), 'SUB-BANCO-HOTMART', false, null);
select t.verdade('B4 the Hotmart slot is cancelled: the slot bought through Apple is untouched',
  (select ativo and ate = :'fim30'::timestamptz from public.bancos_extra_compras where chave = 'apple:1000000000000111')
  and (public.open_finance_limite(pg_temp.id('b_dois')) ->> 'extras')::int = 1);
select pg_temp.apple('b_dois', '1000000000000111', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t3'::timestamptz) as r \gset b5a_
select pg_temp.apple('a_pro', '1000000000000020', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t3'::timestamptz) as r \gset b5b_
select t.verdade('B5 a bank subscription can never become a plan subscription (and the reverse)',
  :'b5a_r' = 'grupo_diferente' and :'b5b_r' = 'grupo_diferente'
  and (select direito = 'banco' and produto = 'app.vant.vendas.banco.mensal' from public.apple_assinaturas where original_transaction_id = '1000000000000111')
  and (select direito = 'plano' and produto = 'app.vant.vendas.pro.mensal' from public.apple_assinaturas where original_transaction_id = '1000000000000020')
  and not public.vant_pro_pleno(pg_temp.id('b_dois')) and public.vant_plano(pg_temp.id('a_pro')) = 'pro');

-- ============================================================ Sandbox is isolated from real accounts
select pg_temp.conta('s_real');
select pg_temp.apple('s_real', '2000000000000200', 'app.vant.vendas.pro.anual', :'fim30'::timestamptz, :'t1'::timestamptz, 'Sandbox') as r \gset s1_
select pg_temp.apple('s_real', '2000000000000201', 'app.vant.vendas.banco.mensal', :'fim30'::timestamptz, :'t1'::timestamptz, 'Sandbox') \gset x_
select t.verdade('S1 a Sandbox purchase on a REAL account is stored for the record and gives NOTHING: no plan, no Pro, no bank slot, profile untouched',
  :'s1_r' = 'gravada' and (select count(*) = 2 from public.apple_assinaturas where user_id = pg_temp.id('s_real'))
  and pg_temp.plano('s_real') = 'expired' and not public.vant_pro_pleno(pg_temp.id('s_real')) and not public.pro_anual(pg_temp.id('s_real'))
  and public.vant_plano(pg_temp.id('s_real')) = 'sem_plano'
  and not exists (select 1 from public.bancos_extra_compras where user_id = pg_temp.id('s_real'))
  and (public.open_finance_limite(pg_temp.id('s_real')) ->> 'extras')::int = 0
  and not exists (select 1 from public.vant_direitos(pg_temp.id('s_real'))));
select t.verdade('S2 Sandbox never reaches the money tables: no Hotmart row, no Hotmart event, no Pro row',
  not exists (select 1 from public.subscriptions where user_id = pg_temp.id('s_real'))
  and not exists (select 1 from public.hotmart_eventos where user_id = pg_temp.id('s_real'))
  and not exists (select 1 from public.orbis_pro where user_id = pg_temp.id('s_real')));

select pg_temp.conta('s_teste');
insert into public.apple_contas_de_teste (user_id, motivo) values (pg_temp.id('s_teste'), 'segunda conta de revisao da Apple');
select pg_temp.apple('s_teste', '2000000000000210', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t1'::timestamptz, 'Sandbox') \gset x_
select t.verdade('S3 the same purchase on a registered TEST account gives access, and the record says Sandbox',
  pg_temp.plano('s_teste') = 'active' and public.vant_plano(pg_temp.id('s_teste')) = 'pro'
  and (select count(*) = 2 and bool_and(origem = 'apple' and ambiente = 'Sandbox') from public.vant_direitos(pg_temp.id('s_teste'))));
delete from public.apple_contas_de_teste where user_id = pg_temp.id('s_teste');
select public.apple_expirar_vencidas() \gset x_
select t.verdade('S4 taking the account off the test list ends that access at the next sweep', pg_temp.plano('s_teste') = 'expired' and not public.vant_pro_pleno(pg_temp.id('s_teste')));
select pg_temp.apple('a_pro', '1000000000000020', 'app.vant.vendas.pro.mensal', now() - interval '1 day', :'t3'::timestamptz, 'Sandbox') as r \gset s5a_
select pg_temp.apple('s_real', '2000000000000200', 'app.vant.vendas.pro.anual', :'fim30'::timestamptz, :'t3'::timestamptz, 'Production') as r \gset s5b_
select t.verdade('S5 a Sandbox status never overwrites a Production subscription, nor the reverse',
  :'s5a_r' = 'ambiente_diferente' and :'s5b_r' = 'ambiente_diferente'
  and (select ambiente = 'Production' and expira_em = :'fim30'::timestamptz from public.apple_assinaturas where original_transaction_id = '1000000000000020')
  and (select ambiente = 'Sandbox' from public.apple_assinaturas where original_transaction_id = '2000000000000200')
  and public.vant_plano(pg_temp.id('a_pro')) = 'pro' and public.vant_plano(pg_temp.id('s_real')) = 'sem_plano');
select t.verdade('S6 the test list needs a written reason', t.erro(format('insert into public.apple_contas_de_teste (user_id, motivo) values (%L, ''x'')', pg_temp.id('s_real'))) like '%motivo%');

-- ============================================================ ownership, order and repetition
select pg_temp.conta('o_dono');
select pg_temp.conta('o_outro');
select pg_temp.apple('o_dono', '1000000000000300', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t1'::timestamptz) \gset x_
select pg_temp.apple('o_outro', '1000000000000300', 'app.vant.vendas.pro.mensal', :'fim30'::timestamptz, :'t2'::timestamptz) as r \gset o1_
select t.verdade('O1 a restored purchase presented by ANOTHER VANT account: "pertence_a_outra_conta"; the owner keeps it, the other account gets nothing',
  :'o1_r' = 'pertence_a_outra_conta'
  and (select user_id = pg_temp.id('o_dono') and assinado_em = :'t1'::timestamptz from public.apple_assinaturas where original_transaction_id = '1000000000000300')
  and pg_temp.plano('o_dono') = 'active' and pg_temp.plano('o_outro') = 'expired' and not public.vant_pro_pleno(pg_temp.id('o_outro')));
select public.apple_assinatura_gravar(null, '1000000000000301', 'app.vant.vendas.pro.mensal', 'Production', :'fim30'::timestamptz, :'t1'::timestamptz) as r \gset o2_
select t.verdade('O2 a notification for a subscription with no known account: "sem_dono", nothing stored',
  :'o2_r' = 'sem_dono'
  and not exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000000301'));
select public.apple_assinatura_gravar(null, '1000000000000300', 'app.vant.vendas.pro.mensal', 'Production', now() + interval '60 days', :'t2'::timestamptz) as r \gset o3_
select t.verdade('O3 a notification without the account (renewal) reaches the owner already stored',
  :'o3_r' = 'gravada'
  and (select expira_em > now() + interval '59 days' and user_id = pg_temp.id('o_dono') from public.apple_assinaturas where original_transaction_id = '1000000000000300'));
select pg_temp.apple('o_dono', '1000000000000300', 'app.vant.vendas.pro.mensal', now() - interval '1 day', :'t0'::timestamptz) as r \gset o4_
select t.verdade('O4 an OLDER status arriving late (the expiry signed before the renewal) is ignored: "antigo_ignorado", access kept',
  :'o4_r' = 'antigo_ignorado'
  and pg_temp.plano('o_dono') = 'active' and (select expira_em > now() + interval '59 days' from public.apple_assinaturas where original_transaction_id = '1000000000000300'));
select expira_em as antes from public.apple_assinaturas where original_transaction_id = '1000000000000300' \gset o5_
select public.apple_assinatura_gravar(null, '1000000000000300', 'app.vant.vendas.pro.mensal', 'Production', :'o5_antes'::timestamptz, :'t2'::timestamptz) as r \gset o5_
select t.verdade('O5 the SAME status twice changes nothing the second time',
  :'o5_r' = 'gravada' and (select expira_em = :'o5_antes'::timestamptz from public.apple_assinaturas where original_transaction_id = '1000000000000300')
  and (select count(*) = 1 from public.apple_assinaturas where user_id = pg_temp.id('o_dono')) and pg_temp.plano('o_dono') = 'active');
select t.verdade('O6 incomplete data and an invalid environment are refused',
  t.erro(format('select public.apple_assinatura_gravar(%L, null, ''app.vant.vendas.pro.mensal'', ''Production'', now(), now())', pg_temp.id('o_dono'))) like '%dados incompletos'
  and t.erro(format('select public.apple_assinatura_gravar(%L, ''1000000000000302'', ''app.vant.vendas.pro.mensal'', ''Xcode'', now(), now())', pg_temp.id('o_dono'))) like '%ambiente invalido');

select public.apple_evento_registrar('uuid-ficticio-1', 'DID_RENEW', null, 'Production', '1000000000000300', pg_temp.id('o_dono'), now(), '{"ficticio":true}'::jsonb) as primeira \gset
select public.apple_evento_registrar('uuid-ficticio-1', 'DID_RENEW', null, 'Production', '1000000000000300', pg_temp.id('o_dono'), now(), '{"ficticio":true}'::jsonb) as segunda \gset
select t.verdade('O7 a notification is recorded once: first time true, the repetition false, one row',
  :'primeira' = 't' and :'segunda' = 'f' and (select count(*) = 1 from public.apple_eventos where notification_uuid = 'uuid-ficticio-1'));

-- ============================================================ where each right comes from
select t.verdade('R1 vant_direitos names every valid right and its origin',
  (select count(*) filter (where direito = 'plano' and origem = 'apple') = 1 and count(*) filter (where direito = 'pro' and origem = 'apple') = 1
          and bool_and(ambiente is distinct from 'Sandbox') from public.vant_direitos(pg_temp.id('o_dono')))
  and (select count(*) = 1 and bool_and(direito = 'banco' and origem = 'apple' and referencia = 'apple:1000000000000111')
         from public.vant_direitos(pg_temp.id('b_dois')) where direito = 'banco')
  and (select count(*) filter (where direito = 'plano' and origem = 'hotmart') = 1 from public.vant_direitos(pg_temp.id('b_dois')))
  and (select count(*) filter (where direito = 'plano' and origem = 'cortesia') = 1 and count(*) filter (where direito = 'plano' and origem = 'apple') = 1
         from public.vant_direitos(pg_temp.id('d_equipe'))));
select pg_temp.app(pg_temp.id('o_outro'));
select t.verdade('R2 a person reads only their own rights', not exists (select 1 from public.vant_direitos(pg_temp.id('o_dono'))));
select pg_temp.servidor();

-- ============================================================ closed to the app
select t.verdade('X1 a logged-in person cannot read or write any Apple table',
  t.linhas_como('authenticated', pg_temp.id('o_dono'), 'select 1 from public.apple_assinaturas') = -1
  and t.linhas_como('authenticated', pg_temp.id('o_dono'), 'select 1 from public.apple_eventos') = -1
  and t.linhas_como('authenticated', pg_temp.id('o_dono'), 'select 1 from public.apple_contas_de_teste') = -1
  and t.linhas_como('authenticated', pg_temp.id('o_dono'), 'select 1 from public.apple_acesso') = -1
  and t.linhas_como('anon', pg_temp.id('o_dono'), 'select 1 from public.apple_assinaturas') = -1);
select t.verdade('X2 a logged-in person cannot call the functions that write or decide',
  t.erro(format('select public.apple_assinatura_gravar(%L, ''1000000000000999'', ''app.vant.vendas.pro.anual'', ''Production'', now() + interval ''1 year'', now())', pg_temp.id('o_outro')), 'authenticated', pg_temp.id('o_outro')) like '42501|%'
  and t.erro(format('select public.apple_acesso_recalcular(%L)', pg_temp.id('o_outro')), 'authenticated', pg_temp.id('o_outro')) like '42501|%'
  and t.erro('select public.apple_expirar_vencidas()', 'authenticated', pg_temp.id('o_outro')) like '42501|%'
  and t.erro(format('insert into public.apple_contas_de_teste (user_id, motivo) values (%L, ''quero acesso de teste'')', pg_temp.id('o_outro')), 'authenticated', pg_temp.id('o_outro')) like '42501|%'
  and t.erro('select public.apple_evento_registrar(''u'', ''TEST'', null, ''Sandbox'', null, null, now(), ''{}''::jsonb)', 'anon', pg_temp.id('o_outro')) like '42501|%'
  and not exists (select 1 from public.apple_assinaturas where original_transaction_id = '1000000000000999'));
select t.verdade('X3 row level security is on in the four tables',
  (select count(*) = 4 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('apple_assinaturas', 'apple_eventos', 'apple_contas_de_teste', 'apple_acesso') and c.relrowsecurity));
