-- VANT Quick V2: quick sale options from what the seller already uses; the server charges ITS option.
-- Fictional data.
\set ON_ERROR_STOP on
create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
update public.defcon_persistencia_config set marcar_novas = true, vant_quick = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('loja')), (pg_temp.u('sem')), (pg_temp.u('cfg'));
create or replace function pg_temp.dia(p_user uuid) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); sid uuid;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, p_user, pg_temp.hoje(), 1000, 1, 'normal', 1000);
  insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount, timer_status, timer_started_at) values (v, p_user, 0, '8h', 1000, 'running', now());
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks, current_block_index) values (p_user, pg_temp.hoje(), 1000, 'active', 1, 0) returning id into sid;
  return sid;
end $$;
-- the shop: a product at R$ 20 with a "2 un por R$ 35" tier in today's Carga do dia, 10 in stock
insert into public.products (id, user_id, name, sale_price, stock_quantity, controla_estoque) values
  (pg_temp.id('bala'), pg_temp.u('loja'), 'Bala', 20, 10, true),
  (pg_temp.id('fora'), pg_temp.u('loja'), 'Fora da carga', 50, 5, true);
insert into public.product_price_tiers (user_id, product_id, qty, price) values (pg_temp.u('loja'), pg_temp.id('bala'), 2, 35);
insert into public.defcon_daily_loadout (user_id, date, product_id, product_name, qty_initial) values (pg_temp.u('loja'), pg_temp.hoje(), pg_temp.id('bala'), 'Bala', 10);
select pg_temp.dia(pg_temp.u('loja')) as s \gset l_
select pg_temp.dia(pg_temp.u('sem')) as s \gset s_
select t.logar(pg_temp.u('loja'));
select public.vant_quick_emitir('iphone-loja-0001') ->> 'token' as tk \gset l_
select t.logar(pg_temp.u('sem'));
select public.vant_quick_emitir('iphone-sem-00001') ->> 'token' as tk \gset s_
select t.logar(pg_temp.u('cfg'));
select public.vant_quick_salvar_config(12, 'cartao');
select public.vant_quick_emitir('iphone-cfg-00001') ->> 'token' as tk \gset c_
reset role;
create or replace function pg_temp.esperar() returns void language sql as $$ update public.vant_quick_credenciais set ultimo_uso_em = now() - interval '5 seconds' $$;

-- A. the options
select public.vant_quick_opcoes(pg_temp.u('loja')) as o \gset l_
select t.verdade('A1 the Carga do dia product: 1 unit R$ 20 first, then the registered 2-for-R$ 35 tier',
  (:'l_o'::jsonb) -> 0 ->> 'id' = 'p:' || pg_temp.id('bala') || ':1' and ((:'l_o'::jsonb) -> 0 ->> 'valor')::numeric = 20
  and (:'l_o'::jsonb) -> 1 ->> 'id' = 'p:' || pg_temp.id('bala') || ':2' and ((:'l_o'::jsonb) -> 1 ->> 'valor')::numeric = 35
  and ((:'l_o'::jsonb) -> 1 ->> 'qtd')::int = 2);
select t.igual('A2 nothing invented: a product outside today''s operation is not offered', jsonb_array_length(:'l_o'::jsonb), 2);
select t.igual('A3 no product, no sale, no config: no option (the widget asks for the first sale)', jsonb_array_length(public.vant_quick_opcoes(pg_temp.u('sem'))), 0);
select t.verdade('A4 only the VANT Quick configuration: it is the option, with its method',
  public.vant_quick_opcoes(pg_temp.u('cfg')) -> 0 ->> 'id' = 'c' and public.vant_quick_opcoes(pg_temp.u('cfg')) -> 0 ->> 'metodo' = 'cartao');
-- a DEFCON sale of R$ 20 in Pix with no product (the case of the test account on 28/11)
select t.logar(pg_temp.u('sem'));
select public.defcon_lancar(pg_temp.id('s-app'), 'venda', :'s_s'::uuid, 0, 20, 'pix');
reset role;
select t.verdade('A5 after a R$ 20 Pix sale in the DEFCON the V2 widget offers R$ 20 Pix (no "Definir valor"); build 31''s "rapida" stays the config (none here)',
  public.vant_quick_opcoes(pg_temp.u('sem')) -> 0 ->> 'id' = 'v:2000' and public.vant_quick_opcoes(pg_temp.u('sem')) -> 0 ->> 'metodo' = 'pix'
  and public.vant_quick_painel(pg_temp.u('sem')) -> 'rapida' = 'null'::jsonb);

-- B. a tap charges the server's option
select public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t1'), 'widget', 'p:' || pg_temp.id('bala') || ':2', 35) as r \gset b_
select t.verdade('B1 "2 unidades R$ 35" from the widget: confirmed', (:'b_r'::jsonb ->> 'ok')::boolean);
select t.verdade('B1 ...one sale of R$ 35, product Bala, quantity 2, method cash (nothing used today)',
  exists (select 1 from public.defcon_sales where id = pg_temp.id('t1') and amount = 35 and product_id = pg_temp.id('bala') and qty = 2 and method = 'dinheiro'));
select t.igual('B1 ...stock down by 2 (10 -> 8)', (select stock_quantity from public.products where id = pg_temp.id('bala')), 8);
select t.verdade('B1 ...the panel the phone gets back has the new totals', ((:'b_r'::jsonb) -> 'painel' ->> 'faturamento')::numeric = 35
  and ((:'b_r'::jsonb) -> 'painel' ->> 'vendas')::int = 1);
select pg_temp.esperar();
select public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t2'), 'widget', 'p:' || pg_temp.id('bala') || ':2', 30) ->> 'motivo' as m \gset b2_
select t.verdade('B2 a price the server does not have (the phone says R$ 30 for the tier): refused, nothing written',
  :'b2_m' = 'opcao_mudou' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('t2')));
select public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t3'), 'widget', 'p:' || pg_temp.id('fora') || ':1', 50) ->> 'motivo' as m \gset b3_
select t.verdade('B3 a product outside the options (even the account''s own): refused, nothing written',
  :'b3_m' = 'opcao_indisponivel' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('t3'))
  and (select stock_quantity from public.products where id = pg_temp.id('fora')) = 5);
select t.verdade('B4 another account''s product id: refused', public.vant_quick_executar(:'s_tk', 'venda', pg_temp.id('t4'), 'widget',
  'p:' || pg_temp.id('bala') || ':1', 20) ->> 'motivo' = 'opcao_indisponivel');
select t.verdade('B5 a refusal brings the fresh options back (the widget redraws its buttons)',
  jsonb_array_length(public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t5'), 'widget', 'v:999', 9.99) -> 'painel' -> 'opcoes') = 2);
select pg_temp.esperar();
select t.verdade('B6 the same tap delivered twice: one sale, stock down once', (public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t1'), 'widget',
  'p:' || pg_temp.id('bala') || ':2', 35) ->> 'repetido')::boolean
  and (select count(*) from public.defcon_sales where id = pg_temp.id('t1')) = 1 and (select stock_quantity from public.products where id = pg_temp.id('bala')) = 8);
select pg_temp.esperar();
select pg_temp.esperar();
select public.vant_quick_executar(:'s_tk', 'venda', pg_temp.id('t7')) as r \gset b7_
select t.verdade('B7 build 31 (no option, no price) with no VANT Quick config: refused, nothing written (it never guesses a value)',
  :'b7_r'::jsonb ->> 'motivo' = 'sem_valor' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('t7')));
select pg_temp.esperar();
select public.vant_quick_executar(:'s_tk', 'abordagem', pg_temp.id('t8'), 'atividade') as r \gset b8_
select t.verdade('B8 an approach from the lock screen: confirmed, and the conversion goes 1 sale / 2 approaches',
  (:'b8_r'::jsonb ->> 'ok')::boolean and ((:'b8_r'::jsonb) -> 'painel' ->> 'vendas')::int = 1 and ((:'b8_r'::jsonb) -> 'painel' ->> 'abordagens')::int = 2);
select t.verdade('B9 the DEFCON configuration is only read: the VANT Quick config of the shop was never created',
  not exists (select 1 from public.vant_quick_config where user_id = pg_temp.u('loja')));
select pg_temp.esperar();
select public.vant_quick_executar(:'l_tk', 'venda', pg_temp.id('t10'), 'atividade', null, 12) ->> 'motivo' as m \gset b10_
select t.verdade('B10 a lock screen button drawn before the server''s list (no option id) with a price that is not the first option: refused',
  :'b10_m' = 'opcao_mudou' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('t10')));

-- C. review of 28/11 (Rick): two products at the same price; build 31 vs a changed first option
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('dois'));
insert into public.products (id, user_id, name, sale_price, stock_quantity, controla_estoque) values
  (pg_temp.id('brig'), pg_temp.u('dois'), 'Brigadeiro', 20, 10, true),
  (pg_temp.id('trufa'), pg_temp.u('dois'), 'Trufa', 20, 10, true);
insert into public.defcon_daily_loadout (user_id, date, product_id, product_name, qty_initial) values
  (pg_temp.u('dois'), pg_temp.hoje(), pg_temp.id('brig'), 'Brigadeiro', 10), (pg_temp.u('dois'), pg_temp.hoje(), pg_temp.id('trufa'), 'Trufa', 10);
select pg_temp.dia(pg_temp.u('dois')) as s \gset d_
select t.logar(pg_temp.u('dois'));
select public.vant_quick_emitir('iphone-dois-0001') ->> 'token' as tk \gset d_
reset role;
select public.vant_quick_opcoes(pg_temp.u('dois')) as o \gset d_
select t.verdade('C1 two products at R$ 20: two buttons, each with its product and named apart',
  jsonb_array_length(:'d_o'::jsonb) = 2
  and (select count(distinct e ->> 'produto') from jsonb_array_elements(:'d_o'::jsonb) e) = 2
  and (select count(distinct e ->> 'rotulo') from jsonb_array_elements(:'d_o'::jsonb) e) = 2);
select pg_temp.esperar();
select public.vant_quick_executar(:'d_tk', 'venda', pg_temp.id('c2'), 'widget', 'p:' || pg_temp.id('trufa') || ':1', 20) ->> 'ok' as ok \gset c2_
select t.verdade('C2 the Trufa button sells a Trufa: Trufa stock 10 -> 9, Brigadeiro untouched',
  :'c2_ok'::boolean and exists (select 1 from public.defcon_sales where id = pg_temp.id('c2') and product_id = pg_temp.id('trufa'))
  and (select stock_quantity from public.products where id = pg_temp.id('trufa')) = 9
  and (select stock_quantity from public.products where id = pg_temp.id('brig')) = 10);
-- build 31 sends neither option nor price. Its button showed the shop's first option (R$ 20); a product
-- at R$ 15 added to today's operation becomes the first option before the tap.
select t.logar(pg_temp.u('dois'));
select public.vant_quick_salvar_config(12, 'pix');
reset role;
insert into public.products (id, user_id, name, sale_price, stock_quantity) values (pg_temp.id('bolo'), pg_temp.u('dois'), 'Bolo', 15, 10);
insert into public.defcon_daily_loadout (user_id, date, product_id, product_name, qty_initial) values (pg_temp.u('dois'), pg_temp.hoje(), pg_temp.id('bolo'), 'Bolo', 10);
select (public.vant_quick_painel(pg_temp.u('dois')) -> 'rapida' ->> 'valor')::numeric as v \gset c3_
select pg_temp.esperar();
select public.vant_quick_executar(:'d_tk', 'venda', pg_temp.id('c3')) as r \gset c3_
select t.verdade('C3 build 31 charges exactly what its button shows ("rapida" = the VANT Quick config, never a derived option)',
  :'c3_v'::numeric = 12 and (:'c3_r'::jsonb ->> 'ok')::boolean
  and exists (select 1 from public.defcon_sales where id = pg_temp.id('c3') and amount = 12 and method = 'pix' and product_id is null));
select pg_temp.esperar();
select public.vant_quick_executar(:'d_tk', 'venda', pg_temp.id('c4'), 'widget', null, 15) ->> 'motivo' as m \gset c4_
select t.verdade('C4 a V2 button with no id drawn at R$ 15 while the first option is now Trufa R$ 20 (sold today): refused, nothing written',
  :'c4_m' = 'opcao_mudou' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('c4')));
