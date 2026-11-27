-- THE PHOTOGRAPH (27/11/2026): what hotmart_acesso_aplicar, expire_overdue_subscriptions,
-- pro_conceder / pro_revogar and the readers of the rights do TODAY, for accounts that only have
-- Hotmart, courtesy or the free test. Fictional data only.
-- This same file is run three times and must give the same answers every time:
--   casos/40  on production's functions as they are
--   casos/41  after the Apple migration (no Apple data): nothing may change for these accounts
--   casos/43  after the migration AND its rollback
-- Some lines record behaviour that is questionable (marked "as it is today"): they are here so a
-- change to it is a decision, never a side effect.
select pg_temp.servidor();
select now() + interval '10 days' as fim \gset
select now() + interval '40 days' as fim_longe \gset

-- ============================================================ hotmart_acesso_aplicar
select pg_temp.conta('h_novo', 'teste');
select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'ativar', 'SUB-A', 'HP-A1', :'fim'::timestamptz, false) as r \gset h1_
select t.verdade('H1 approved payment on an account in the free test: "ativada", Hotmart row active until the next charge, grace 3 days later, plan active, test flag off',
  :'h1_r' = 'ativada'
  and (select provider = 'hotmart' and status = 'active' and current_period_end = :'fim'::timestamptz
              and grace_until = :'fim'::timestamptz + interval '3 days' and hotmart_subscription_id = 'SUB-A' and hotmart_purchase_id = 'HP-A1'
         from public.subscriptions where user_id = pg_temp.id('h_novo'))
  and (select plan_status = 'active' and not is_trial_active from public.profiles where user_id = pg_temp.id('h_novo')));

select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'atrasar', 'SUB-A', 'HP-A2') as r \gset h2_
select t.verdade('H2 late payment of the same subscription: "atrasada", row past_due, plan still active',
  :'h2_r' = 'atrasada' and (select status from public.subscriptions where user_id = pg_temp.id('h_novo')) = 'past_due' and pg_temp.plano('h_novo') = 'active');

select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'atrasar', 'SUB-OUTRA', 'HP-X') as r \gset h3_
select t.verdade('H3 late payment of ANOTHER subscription: "outra_assinatura", nothing changes',
  :'h3_r' = 'outra_assinatura' and (select hotmart_subscription_id = 'SUB-A' and hotmart_purchase_id = 'HP-A2' from public.subscriptions where user_id = pg_temp.id('h_novo')));

select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'cancelar', 'SUB-OUTRA', 'HP-X') as r \gset h4_
select t.verdade('H4 cancellation of ANOTHER subscription: "outra_assinatura", access kept',
  :'h4_r' = 'outra_assinatura' and pg_temp.plano('h_novo') = 'active' and (select status from public.subscriptions where user_id = pg_temp.id('h_novo')) = 'past_due');

select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'cancelar', 'SUB-A', 'HP-A3') as r \gset h5_
select t.verdade('H5 cancellation of the subscription that holds the access: "cancelada", row canceled with the grace closed now, account blocked',
  :'h5_r' = 'cancelada'
  and (select status = 'canceled' and grace_until <= now() and hotmart_purchase_id = 'HP-A3' from public.subscriptions where user_id = pg_temp.id('h_novo'))
  and pg_temp.plano('h_novo') = 'expired');

select public.hotmart_acesso_aplicar(pg_temp.id('h_novo'), 'ativar', 'SUB-A', 'HP-A4', :'fim'::timestamptz, true) as r \gset h6_
select t.verdade('H6 a COMPLETE event never reopens an existing row: "complete_ignorado", still blocked',
  :'h6_r' = 'complete_ignorado' and pg_temp.plano('h_novo') = 'expired');

select pg_temp.conta('h_duas');
select public.hotmart_acesso_aplicar(pg_temp.id('h_duas'), 'ativar', 'SUB-B1', 'HP-B1', :'fim_longe'::timestamptz, false) \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('h_duas'), 'ativar', 'SUB-B2', 'HP-B2', :'fim'::timestamptz, false) as r \gset h7_
select t.verdade('H7 a second subscription paid until an EARLIER date does not take the row: "outra_assinatura_paga_mais_longe"',
  :'h7_r' = 'outra_assinatura_paga_mais_longe' and (select hotmart_subscription_id = 'SUB-B1' and current_period_end = :'fim_longe'::timestamptz from public.subscriptions where user_id = pg_temp.id('h_duas')));

select pg_temp.hotmart_viva('h_duas', 'SUB-B2', 10);
select public.hotmart_acesso_aplicar(pg_temp.id('h_duas'), 'cancelar', 'SUB-B1', 'HP-B3') as r \gset h8_
select t.verdade('H8 cancellation while ANOTHER Hotmart subscription is alive: "trocou_para_outra", the live one takes the row, access kept',
  :'h8_r' = 'trocou_para_outra'
  and (select status = 'active' and hotmart_subscription_id = 'SUB-B2' and current_period_end > now() + interval '9 days' from public.subscriptions where user_id = pg_temp.id('h_duas'))
  and pg_temp.plano('h_duas') = 'active');

select pg_temp.conta('h_equipe', 'equipe');
select public.hotmart_acesso_aplicar(pg_temp.id('h_equipe'), 'ativar', 'SUB-E', 'HP-E1', :'fim'::timestamptz, false) \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('h_equipe'), 'cancelar', 'SUB-E', 'HP-E2') as r \gset h9_
select t.verdade('H9 as it is today: a cancellation writes "expired" on a courtesy account too (its access comes from billing_exempt, read as "equipe")',
  :'h9_r' = 'cancelada' and pg_temp.plano('h_equipe') = 'expired' and public.vant_plano(pg_temp.id('h_equipe')) = 'equipe');

select pg_temp.conta('h_sem_linha');
select public.hotmart_acesso_aplicar(pg_temp.id('h_sem_linha'), 'cancelar', 'SUB-Z', 'HP-Z') as r \gset h10_
select t.verdade('H10 cancellation for an account with no row: "cancelada", a canceled row is created, account blocked',
  :'h10_r' = 'cancelada' and (select status from public.subscriptions where user_id = pg_temp.id('h_sem_linha')) = 'canceled' and pg_temp.plano('h_sem_linha') = 'expired');

select pg_temp.app(pg_temp.id('h_novo'));
select t.verdade('H11 only the server calls it: a logged-in person gets "so o servidor"',
  t.erro(format('select public.hotmart_acesso_aplicar(%L, ''ativar'', ''SUB-A'', ''HP'', now() + interval ''1 day'', false)', pg_temp.id('h_novo'))) like '%so o servidor');
select pg_temp.servidor();
select t.verdade('H12 an unknown action is refused', t.erro(format('select public.hotmart_acesso_aplicar(%L, ''apagar'', ''S'', ''P'')', pg_temp.id('h_novo'))) like '%acao invalida');

-- ============================================================ expire_overdue_subscriptions
select pg_temp.conta(k) from unnest(array['e_dentro', 'e_passou', 'e_sem_datas', 'e_cancelada', 'e_recente']) k;
select pg_temp.conta('e_equipe', 'equipe');
select pg_temp.conta('e_demo');
update public.profiles set is_demo = true where user_id = pg_temp.id('e_demo');
select pg_temp.conta('e_teste', 'teste');
select count(public.hotmart_acesso_aplicar(pg_temp.id(k), 'ativar', 'SUB-' || k, 'HP-' || k, now() + interval '1 day', false))
  from unnest(array['e_dentro', 'e_passou', 'e_sem_datas', 'e_cancelada', 'e_recente', 'e_equipe', 'e_demo']) k \gset x_
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '2 days', grace_until = now() + interval '1 day' where user_id = pg_temp.id('e_dentro');
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '4 days', grace_until = now() - interval '1 day' where user_id = pg_temp.id('e_passou');
update public.subscriptions set current_period_end = null, grace_until = null, last_event_at = now() - interval '34 days' where user_id = pg_temp.id('e_sem_datas');
update public.subscriptions set current_period_end = null, grace_until = null, last_event_at = now() - interval '32 days' where user_id = pg_temp.id('e_recente');
update public.subscriptions set status = 'canceled', grace_until = now() - interval '5 days' where user_id = pg_temp.id('e_cancelada');
update public.profiles set plan_status = 'active' where user_id = pg_temp.id('e_cancelada');
update public.subscriptions set status = 'past_due', grace_until = now() - interval '10 days' where user_id in (pg_temp.id('e_equipe'), pg_temp.id('e_demo'));
select public.expire_overdue_subscriptions() as n \gset e_
select t.igual('E1 it returns how many accounts it blocked', :'e_n'::numeric, 2);
select t.verdade('E2 2 days late, inside the grace: untouched',
  pg_temp.plano('e_dentro') = 'active' and (select status from public.subscriptions where user_id = pg_temp.id('e_dentro')) = 'past_due');
select t.verdade('E3 grace over: row expired, account blocked, test flag off',
  (select status from public.subscriptions where user_id = pg_temp.id('e_passou')) = 'expired'
  and (select plan_status = 'expired' and not is_trial_active from public.profiles where user_id = pg_temp.id('e_passou')));
select t.verdade('E4 no dates at all: blocked 33 days after the last event, not before',
  pg_temp.plano('e_sem_datas') = 'expired' and pg_temp.plano('e_recente') = 'active');
select t.verdade('E5 a canceled row is never looked at again',
  pg_temp.plano('e_cancelada') = 'active' and (select status from public.subscriptions where user_id = pg_temp.id('e_cancelada')) = 'canceled');
select t.verdade('E6 courtesy and demo accounts are spared: row and plan untouched',
  pg_temp.plano('e_equipe') = 'active' and pg_temp.plano('e_demo') = 'active'
  and (select count(*) from public.subscriptions where user_id in (pg_temp.id('e_equipe'), pg_temp.id('e_demo')) and status = 'past_due') = 2);
select t.verdade('E7 someone on the free test without a subscription is not touched',
  (select plan_status = 'trial' and is_trial_active from public.profiles where user_id = pg_temp.id('e_teste')));
select public.expire_overdue_subscriptions() as n \gset e2_
select t.igual('E8 running it again blocks nobody else', :'e2_n'::numeric, 0);

-- ============================================================ pro_conceder / pro_revogar and who reads the Pro
select pg_temp.conta(k) from unnest(array['p_mensal', 'p_anual', 'p_longo', 'p_vencido', 'p_sem_linha']) k;
select pg_temp.conta('p_cortesia', 'equipe');
select count(public.hotmart_acesso_aplicar(pg_temp.id(k), 'ativar', 'SUB-' || k, 'HP-' || k, :'fim'::timestamptz, false))
  from unnest(array['p_mensal', 'p_anual', 'p_longo', 'p_vencido', 'p_sem_linha']) k \gset x_

select public.pro_conceder(pg_temp.id('p_mensal'), 'hotmart', 'SUB-p_mensal', '5y86n311', now() + interval '30 days') as r \gset p1_
select t.verdade('P1 monthly Pro granted: row active with origin, code, product and end; Pro on, not annual, plan "pro"',
  :'p1_r' = 't'
  and (select ativo and origem = 'hotmart' and assinante_codigo = 'SUB-p_mensal' and produto_id = '5y86n311' and cancelado_em is null and expira_em > now() + interval '29 days'
         from public.orbis_pro where user_id = pg_temp.id('p_mensal'))
  and public.vant_pro_pleno(pg_temp.id('p_mensal')) and not public.pro_anual(pg_temp.id('p_mensal'))
  and public.orbis_pro_ativo(pg_temp.id('p_mensal')) and public.vant_plano(pg_temp.id('p_mensal')) = 'pro');

select public.pro_revogar(pg_temp.id('p_mensal')) as r \gset p2_
select t.verdade('P2 Pro revoked: row off with the cancellation moment; Pro off; plan back to "essencial"; the main plan is not touched',
  :'p2_r' = 't'
  and (select not ativo and cancelado_em is not null and origem = 'hotmart' and produto_id = '5y86n311' from public.orbis_pro where user_id = pg_temp.id('p_mensal'))
  and not public.vant_pro_pleno(pg_temp.id('p_mensal')) and public.vant_plano(pg_temp.id('p_mensal')) = 'essencial'
  and pg_temp.plano('p_mensal') = 'active' and (select status from public.subscriptions where user_id = pg_temp.id('p_mensal')) = 'active');

select public.pro_conceder(pg_temp.id('p_mensal'), 'hotmart', null, null, now() + interval '30 days') \gset x_
select t.verdade('P3 granted again without code or product: back on, cancellation cleared, the old code and product are kept',
  (select ativo and cancelado_em is null and assinante_codigo = 'SUB-p_mensal' and produto_id = '5y86n311' from public.orbis_pro where user_id = pg_temp.id('p_mensal'))
  and public.vant_pro_pleno(pg_temp.id('p_mensal')));

select public.pro_conceder(pg_temp.id('p_anual'), 'hotmart', 'SUB-p_anual', 'ew11enu0', now() + interval '365 days') \gset x_
select public.pro_conceder(pg_temp.id('p_longo'), 'hotmart', 'SUB-p_longo', 'oferta-nova', now() + interval '200 days') \gset x_
select t.verdade('P4 annual Pro: by the annual offer code, or by an end more than 180 days ahead; plan "pro_anual"',
  public.pro_anual(pg_temp.id('p_anual')) and public.vant_plano(pg_temp.id('p_anual')) = 'pro_anual'
  and public.pro_anual(pg_temp.id('p_longo')) and public.vant_plano(pg_temp.id('p_longo')) = 'pro_anual');

select public.pro_conceder(pg_temp.id('p_vencido'), 'hotmart', 'SUB-p_vencido', '5y86n311', now() - interval '1 minute') \gset x_
select t.verdade('P5 a Pro whose end has passed gives nothing, even with the row on',
  (select ativo from public.orbis_pro where user_id = pg_temp.id('p_vencido')) and not public.vant_pro_pleno(pg_temp.id('p_vencido'))
  and public.vant_plano(pg_temp.id('p_vencido')) = 'essencial');

select public.pro_conceder(pg_temp.id('p_cortesia'), 'cortesia', null, null, null) \gset x_
select t.verdade('P6 courtesy Pro: no end date, origin "cortesia", Pro on',
  (select ativo and origem = 'cortesia' and expira_em is null from public.orbis_pro where user_id = pg_temp.id('p_cortesia')) and public.vant_pro_pleno(pg_temp.id('p_cortesia')));
select public.pro_revogar(pg_temp.id('p_cortesia')) \gset x_
select t.verdade('P7 as it is today: pro_revogar does not ask where the Pro came from; it turns a courtesy Pro off too',
  (select not ativo and origem = 'cortesia' from public.orbis_pro where user_id = pg_temp.id('p_cortesia')) and not public.vant_pro_pleno(pg_temp.id('p_cortesia')));

select public.pro_revogar(pg_temp.id('p_sem_linha')) as r \gset p8_
select t.verdade('P8 revoking an account that never had the Pro: answers true and creates nothing',
  :'p8_r' = 't' and not exists (select 1 from public.orbis_pro where user_id = pg_temp.id('p_sem_linha')));

select pg_temp.app(pg_temp.id('p_mensal'));
select t.verdade('P9 only the server grants or revokes the Pro',
  t.erro(format('select public.pro_conceder(%L)', pg_temp.id('p_mensal'))) like '%so o servidor libera o Pro'
  and t.erro(format('select public.pro_revogar(%L)', pg_temp.id('p_mensal'))) like '%so o servidor mexe no Pro');
select pg_temp.servidor();

-- ============================================================ extra bank and the plan names
select pg_temp.conta(k) from unnest(array['b_essencial', 'b_sem_plano']) k;
select pg_temp.conta('b_equipe', 'equipe');
select public.hotmart_acesso_aplicar(pg_temp.id('b_essencial'), 'ativar', 'SUB-b_essencial', 'HP-b', :'fim'::timestamptz, false) \gset x_
select public.banco_extra_registrar(pg_temp.id('b_essencial'), 'SUB-BANCO-1', true, now() + interval '30 days');
select public.banco_extra_registrar(pg_temp.id('b_sem_plano'), 'SUB-BANCO-2', true, now() + interval '30 days');
select public.banco_extra_registrar(pg_temp.id('b_equipe'), 'SUB-BANCO-3', true, now() + interval '30 days');
select t.verdade('B1 extra bank on an Essencial account: bank released, Pro still off, plan "essencial_banco", one extra slot',
  public.orbis_pro_ativo(pg_temp.id('b_essencial')) and not public.vant_pro_pleno(pg_temp.id('b_essencial'))
  and public.vant_plano(pg_temp.id('b_essencial')) = 'essencial_banco'
  and (public.open_finance_limite(pg_temp.id('b_essencial')) ->> 'extras')::int = 1
  and (public.open_finance_limite(pg_temp.id('b_essencial')) ->> 'incluidos')::int = 0);
select t.verdade('B2 the extra bank never writes the main plan: an account without a plan stays blocked',
  pg_temp.plano('b_sem_plano') = 'expired' and not exists (select 1 from public.subscriptions where user_id = pg_temp.id('b_sem_plano'))
  and not public.vant_pro_pleno(pg_temp.id('b_sem_plano')));
select t.verdade('B3 as it is today: the plan NAME of that blocked account reads "essencial_banco"',
  public.vant_plano(pg_temp.id('b_sem_plano')) = 'essencial_banco');
select t.verdade('B4 courtesy account with a paid extra bank counts as full Pro',
  public.cortesia_com_banco_pago(pg_temp.id('b_equipe')) and public.vant_pro_pleno(pg_temp.id('b_equipe')));
select public.banco_extra_registrar(pg_temp.id('b_essencial'), 'SUB-BANCO-1', false, null);
select t.verdade('B5 extra bank cancelled: slot closed now, plan back to "essencial", main plan untouched',
  (select not ativo and ate <= now() from public.bancos_extra_compras where chave = 'SUB-BANCO-1')
  and public.vant_plano(pg_temp.id('b_essencial')) = 'essencial' and pg_temp.plano('b_essencial') = 'active');

select t.verdade('L1 banks included by plan: Essencial 0, Pro 1, annual Pro 2',
  (public.open_finance_limite(pg_temp.id('b_essencial')) ->> 'incluidos')::int = 0
  and (public.open_finance_limite(pg_temp.id('p_mensal')) ->> 'incluidos')::int = 1
  and (public.open_finance_limite(pg_temp.id('p_anual')) ->> 'incluidos')::int = 2
  and public.open_finance_limite(pg_temp.id('p_mensal')) ->> 'plano' = 'pro'
  and public.open_finance_limite(pg_temp.id('p_anual')) ->> 'plano' = 'pro_anual');

select pg_temp.conta('v_teste', 'teste');
select pg_temp.conta('v_sem');
select t.verdade('V1 plan names: free test "teste", nothing "sem_plano", courtesy "equipe", paid "essencial"',
  public.vant_plano(pg_temp.id('v_teste')) = 'teste' and public.vant_plano(pg_temp.id('v_sem')) = 'sem_plano'
  and public.vant_plano(pg_temp.id('e_equipe')) = 'equipe' and public.vant_plano(pg_temp.id('e_dentro')) = 'essencial');

-- what the app shows in "Minha Conta" (orbis_pro_status), as the logged-in person
select pg_temp.app(pg_temp.id('p_mensal'));
select t.verdade('S1 Pro through Hotmart: pro, origin "hotmart", with start and end', (select pro and origem = 'hotmart' and desde is not null and ate > now() from public.orbis_pro_status()));
select pg_temp.app(pg_temp.id('b_sem_plano'));
select t.verdade('S2 only the extra bank: not pro, origin "banco_avulso", end = the slot''s', (select not pro and origem = 'banco_avulso' and ate > now() + interval '29 days' from public.orbis_pro_status()));
select pg_temp.app(pg_temp.id('b_equipe'));
select t.verdade('S3 courtesy with a paid bank: pro, origin "cortesia_banco"', (select pro and origem = 'cortesia_banco' from public.orbis_pro_status()));
select pg_temp.app(pg_temp.id('e_equipe'));
select t.verdade('S4 plain courtesy: not pro, origin "cortesia"', (select not pro and origem = 'cortesia' from public.orbis_pro_status()));
select pg_temp.app(pg_temp.id('v_sem'));
select t.verdade('S5 nothing at all: not pro, no origin, no dates', (select not pro and origem is null and desde is null and ate is null from public.orbis_pro_status()));
select pg_temp.servidor();
