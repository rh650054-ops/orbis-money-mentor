-- 27/11/2026 (Etapa 3): who may be offered a purchase on the iPhone, and no commission on Apple
-- subscriptions through the old partner functions (migration 20261127123000). Fictional data only.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
\ir ../schema/extra/direitos_producao_20261127_c.sql
select t.verdade('F0 the two partner functions under test are production''s (fingerprints of 27/11/2026)',
  (select count(*) = 2 from pg_proc p where p.pronamespace = 'public'::regnamespace
    and (p.proname, left(md5(lower(regexp_replace(p.prosrc, '\s+', '', 'g'))), 10)) in (('parceiros_painel', '21280dfd4b'), ('parceiros_resumo', '32a930da42'))));
-- the photograph of today: a recurring partner is credited for every attributed account with the plan on
select pg_temp.servidor();
insert into public.parceiros (code, nome, tipo, comissao, recorrente) values ('PARCEIROUM', 'Parceiro Ficticio', 'influenciador', 10, true), ('VENDEDORDOIS', 'Vendedor Ficticio', 'vendedor', 20, false);
select pg_temp.conta(k) from unnest(array['c_hotmart', 'c_apple', 'c_ambos', 'c_manual']) k;
insert into public.orbis_atribuicao (user_id, code) select pg_temp.id(k), 'PARCEIROUM' from unnest(array['c_hotmart', 'c_apple', 'c_ambos', 'c_manual']) k;
select public.hotmart_acesso_aplicar(pg_temp.id(k), 'ativar', 'SUB-' || k, 'HP-' || k, now() + interval '20 days', false) from unnest(array['c_hotmart', 'c_ambos']) k;
update public.profiles set plan_status = 'active' where user_id in (pg_temp.id('c_apple'), pg_temp.id('c_manual'));
create or replace function pg_temp.resumo(p_code text, p_campo text) returns numeric language sql as $$
  select (x ->> p_campo)::numeric from json_array_elements(public.parceiros_resumo(to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'))) x where x ->> 'code' = p_code $$;
create or replace function pg_temp.painel(p_code text, p_campo text) returns numeric language sql as $$
  select (x ->> p_campo)::numeric from json_array_elements(public.parceiros_painel((current_date - 40)::text, (current_date + 2)::text) -> 'parceiros') x where x ->> 'code' = p_code $$;
select t.verdade('P0 as it is today: the recurring partner is credited for the 4 attributed accounts with the plan on (4 x 10 = 40), whatever turned the plan on',
  pg_temp.resumo('PARCEIROUM', 'assinantes_mes') = 4 and pg_temp.resumo('PARCEIROUM', 'ganhos_mes') = 40 and pg_temp.painel('PARCEIROUM', 'ativos') = 4);

\ir direitos/migracoes.sql
select pg_temp.servidor();
\ir direitos/apple.sql
\set ESS 'app.vant.vendas.essencial.mensal'
\set PRO 'app.vant.vendas.pro.mensal'
\set BANCO 'app.vant.vendas.banco.mensal'
select t.verdade('P1 after the migration, with no Apple subscription anywhere, the partner figures are exactly the same',
  pg_temp.resumo('PARCEIROUM', 'ganhos_mes') = 40 and pg_temp.painel('PARCEIROUM', 'ativos') = 4 and pg_temp.painel('PARCEIROUM', 'novos') = 2);
update public.profiles set plan_status = 'expired' where user_id = pg_temp.id('c_apple');
select pg_temp.apple('c_apple', '1000000000005001', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.apple('c_ambos', '1000000000005002', :'PRO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('P2 THE RULE: an account whose plan is on ONLY because of an Apple subscription generates no commission: the recurring partner is credited for 3 (Hotmart, Hotmart + Apple, manual), not 4; Hotmart-paid accounts keep counting even with an Apple subscription on top',
  pg_temp.plano('c_apple') = 'active' and pg_temp.resumo('PARCEIROUM', 'assinantes_mes') = 3 and pg_temp.resumo('PARCEIROUM', 'ganhos_mes') = 30
  and pg_temp.painel('PARCEIROUM', 'ativos') = 3);
select t.verdade('P3 an Apple purchase never writes public.subscriptions, the only thing the per-sale commission ("novos") and the third old function (painel_parceiro) pay on',
  not exists (select 1 from public.subscriptions where user_id = pg_temp.id('c_apple')) and pg_temp.painel('PARCEIROUM', 'novos') = 2
  and (public.parceiros_painel((current_date - 40)::text, (current_date + 2)::text) #>> '{totais,a_pagar}')::numeric = 20);
select t.verdade('P4 the commercial attribution of the Apple subscription is preserved: the partner is recorded on it',
  (select parceiro_code = 'PARCEIROUM' and origem_fixada_em is not null from public.apple_assinaturas where original_transaction_id = '1000000000005001'));
select public.hotmart_acesso_aplicar(pg_temp.id('c_ambos'), 'cancelar', 'SUB-c_ambos', 'HP-x') \gset x_
select t.verdade('P5 the Hotmart subscription of the account with both ends: from then on its plan is on only through Apple and it stops counting too',
  pg_temp.plano('c_ambos') = 'active' and pg_temp.resumo('PARCEIROUM', 'assinantes_mes') = 2);

-- ============================================================ who may be offered a purchase
create or replace function pg_temp.oferta(p_k text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.app(pg_temp.id(p_k)); j := public.assinatura_apple_oferta(); perform pg_temp.servidor(); return j;
end $$;
select pg_temp.conta(k) from unnest(array['o_livre', 'o_hotmart', 'o_tolerancia', 'o_processando', 'o_regularizar', 'o_cancelada', 'o_apple', 'o_suspensa', 'o_so_banco']) k;
select pg_temp.conta('o_teste', 'teste');
select pg_temp.conta('o_equipe', 'equipe');
select public.hotmart_acesso_aplicar(pg_temp.id(k), 'ativar', 'SUB-' || k, 'HP-' || k, now() + interval '20 days', false) from unnest(array['o_hotmart', 'o_tolerancia', 'o_cancelada', 'o_suspensa']) k;
select public.hotmart_acesso_aplicar(pg_temp.id('o_tolerancia'), 'atrasar', 'SUB-o_tolerancia', 'HP-a') \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('o_cancelada'), 'cancelar', 'SUB-o_cancelada', 'HP-c') \gset x_
-- Hotmart mirror: a purchase waiting for payment, and a subscription with an overdue charge
insert into public.hotmart_eventos (event_type, subscription_id, user_id, payload)
select e.tipo, 'SUB-' || e.k, pg_temp.id(e.k), jsonb_build_object('data', jsonb_build_object('subscription', jsonb_build_object('status', e.status)))
  from (values ('o_processando', 'PURCHASE_BILLET_PRINTED', 'STARTED'), ('o_regularizar', 'PURCHASE_DELAYED', 'OVERDUE')) as e (k, tipo, status);
select pg_temp.apple('o_apple', '1000000000005003', :'ESS', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select pg_temp.admin(true);
select public.admin_suspender_acesso(pg_temp.id('o_suspensa'), 'suspensao ficticia') \gset x_
select pg_temp.admin(false);
select public.banco_extra_registrar(pg_temp.id('o_so_banco'), 'SUB-BANCO-o', true, now() + interval '30 days');

select t.verdade('O1 never paid, or test still running, or a Hotmart subscription that was cancelled and is over: the three plans can be offered',
  pg_temp.oferta('o_livre') ->> 'plano' = 'livre' and pg_temp.oferta('o_teste') ->> 'plano' = 'livre' and pg_temp.oferta('o_cancelada') ->> 'plano' = 'livre'
  and pg_temp.oferta('o_livre') ->> 'motivo' is null);
select t.verdade('O2 THE RULE: a valid Hotmart subscription is never offered another main plan on the iPhone',
  pg_temp.oferta('o_hotmart') = jsonb_build_object('plano', 'bloqueado', 'motivo', 'hotmart_ativa', 'apple', null, 'banco', 'bloqueado', 'conta_de_teste', false));
select t.verdade('O3 the same protection for the tolerance period, a purchase still being processed and a pending payment',
  pg_temp.oferta('o_tolerancia') ->> 'motivo' = 'hotmart_em_tolerancia' and pg_temp.oferta('o_processando') ->> 'motivo' = 'hotmart_processando'
  and pg_temp.oferta('o_regularizar') ->> 'motivo' = 'hotmart_pagamento_pendente'
  and (select bool_and(pg_temp.oferta(k) ->> 'plano' = 'bloqueado') from unnest(array['o_tolerancia', 'o_processando', 'o_regularizar']) k));
select t.verdade('O4 courtesy and suspended accounts are not offered a purchase either (a suspended one not even the bank add-on)',
  pg_temp.oferta('o_equipe') ->> 'motivo' = 'cortesia' and pg_temp.oferta('o_suspensa') ->> 'motivo' = 'suspensa' and pg_temp.oferta('o_suspensa') ->> 'banco' = 'bloqueado');
select t.verdade('O5 a plan that is already Apple''s: the change of plan goes through Apple, and the answer says which product and until when',
  pg_temp.oferta('o_apple') ->> 'plano' = 'trocar' and pg_temp.oferta('o_apple') #>> '{apple,produto}' = :'ESS'
  and (pg_temp.oferta('o_apple') #>> '{apple,ate}')::timestamptz > now() + interval '29 days');
select t.verdade('O6 the bank add-on is not sold on the iPhone yet (27/11/2026): no account is offered it, with or without a main plan',
  (select bool_and(pg_temp.oferta(k) ->> 'banco' = 'bloqueado') from unnest(array['o_hotmart', 'o_apple', 'o_teste', 'o_livre', 'o_so_banco']) k));
select pg_temp.apple('o_apple', '1000000000005004', :'BANCO', :'fim30'::timestamptz, :'t0'::timestamptz) \gset x_
select t.verdade('O7 an add-on already held through Apple is reported as such; a slot bought on Hotmart before is kept',
  pg_temp.oferta('o_apple') ->> 'banco' = 'ja_tem'
  and (select ativo from public.bancos_extra_compras where chave = 'SUB-BANCO-o'));
select t.verdade('O8 it answers only about the logged-in account; without a session nothing is offered; anon cannot call it',
  (select public.assinatura_apple_oferta() ->> 'motivo') = 'sem_sessao'
  and t.erro('select public.assinatura_apple_oferta()', 'anon', pg_temp.id('o_livre')) like '42501|%');
