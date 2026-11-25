-- Per-unit costs (25/11/2026, Rick). Rules:
--   * a line is per batch (1 box per recipe) or per unit produced (1 bottle per unit);
--   * total = batch costs + per-unit costs × yield; unit cost = total ÷ yield;
--   * costs without stock (labour) add to the cost and never leave any stock;
--   * production of N units consumes batch lines by N ÷ yield and per-unit lines by N;
--   * old lines (no classification) stay exactly as they were; nothing is consumed twice.
-- Fictional data only (prices invented for the test).
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
create or replace function pg_temp.q(p_prod text, p_ing text) returns numeric language sql as $$
  select quantity from public.product_recipes where product_id = pg_temp.id(p_prod) and ingredient_id = pg_temp.id(p_ing) and variant_id is null
$$;
create or replace function pg_temp.produzir(p_chave text, p_prod text, p_sabor text, p_un int) returns text language sql as $$
  -- the recipe was re-saved in this test, so production asks why it changed (Etapa 1 guard): give a reason
  select t.erro(format('select public.producao_registrar(%L, %L::jsonb, null, null, %L)', p_chave,
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('produto', pg_temp.id(p_prod), 'sabor', pg_temp.id(p_sabor), 'unidades', p_un))), 'ajustei a receita por unidade'))
$$;

do $$
declare u uuid := t.vendedor('Receita Teste'); v uuid; p uuid;
begin
  insert into f values ('u', u);
  perform t.logar(u);
  -- prices of 1 unit of measure: box R$ 6,49; milk R$ 0,00489/ml; strawberry R$ 0,0118/g;
  -- bottle R$ 1,30; sticker R$ 0,25; straw R$ 0,065
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Leite condensado', 'un', 10, 6.49) returning id into v; insert into f values ('lc', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Leite', 'ml', 5000, 0.00489) returning id into v; insert into f values ('leite', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Morango', 'g', 3000, 0.0118) returning id into v; insert into f values ('morango', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Garrafa', 'un', 100, 1.30) returning id into v; insert into f values ('garrafa', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Adesivo', 'un', 100, 0.25) returning id into v; insert into f values ('adesivo', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Canudo', 'un', 100, 0.065) returning id into v; insert into f values ('canudo', v);
  insert into public.products (user_id, name, sale_price, stock_quantity) values (u, 'Batida', 20, 0) returning id into p; insert into f values ('bat', p);
  insert into public.products (user_id, name, sale_price, stock_quantity) values (u, 'Antiga', 10, 0) returning id into p; insert into f values ('velha', p);
end $$;
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- 1) an old app (no "por"): exactly as before
select public.produto_salvar_receita(pg_temp.id('velha'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0),
  jsonb_build_object('id', pg_temp.id('garrafa'), 'nome', 'Garrafa', 'qtd', 1, 'preco', 0)), 5) is not null as ok0 \gset
select t.verdade('L1 old app: lines saved per batch and unclassified (base null), 1 bottle per batch as he typed',
  pg_temp.q('velha', 'garrafa') = 1 and (select bool_and(base is null and qtd_por_unidade is null) from public.product_recipes where product_id = pg_temp.id('velha')));
select t.igual('L2 old app: cost is the old formula (6,49 + 1,30) ÷ 5', (select cost from public.products where id = pg_temp.id('velha')), 1.56);

-- ---------------------------------------------------------------- 2) the Cremo-like case: batch lines + per-unit lines + labour
-- before (bottle, sticker, straw typed as 1 per RECIPE, no labour)
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('leite'), 'nome', 'Leite', 'qtd', 200, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('morango'), 'nome', 'Morango', 'qtd', 300, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('garrafa'), 'nome', 'Garrafa', 'qtd', 1, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('adesivo'), 'nome', 'Adesivo', 'qtd', 1, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('canudo'), 'nome', 'Canudo', 'qtd', 1, 'preco', 0, 'por', 'receita')), 5) is not null as ok1 \gset
-- 6,49 + 0,978 + 3,54 + 1,30 + 0,25 + 0,065 = 12,623 → 2,52 each
select t.igual('C1 before: everything per recipe, 12,623 ÷ 5 = 2,52 (the bottles were counted once)', (select cost from public.products where id = pg_temp.id('bat')), 2.52);

-- after: bottle, sticker, straw PER UNIT and labour R$ 0,70 per unit
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('leite'), 'nome', 'Leite', 'qtd', 200, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('morango'), 'nome', 'Morango', 'qtd', 300, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('garrafa'), 'nome', 'Garrafa', 'qtd', 1, 'preco', 0, 'por', 'unidade'),
  jsonb_build_object('id', pg_temp.id('adesivo'), 'nome', 'Adesivo', 'qtd', 1, 'preco', 0, 'por', 'unidade'),
  jsonb_build_object('id', pg_temp.id('canudo'), 'nome', 'Canudo', 'qtd', 1, 'preco', 0, 'por', 'unidade')), 5,
  jsonb_build_array(jsonb_build_object('nome', 'Mão de obra', 'valor', 0.70, 'por', 'unidade'))) is not null as ok2 \gset
select t.verdade('C2 1 bottle per unit × rende 5 = 5 bottles per batch (sticker and straw too); the per-unit amount is kept',
  pg_temp.q('bat', 'garrafa') = 5 and pg_temp.q('bat', 'adesivo') = 5 and pg_temp.q('bat', 'canudo') = 5
  and (select qtd_por_unidade from public.product_recipes where product_id = pg_temp.id('bat') and ingredient_id = pg_temp.id('garrafa')) = 1);
select t.verdade('C3 batch lines stay as typed: 1 box, 200 ml, 300 g', pg_temp.q('bat', 'lc') = 1 and pg_temp.q('bat', 'leite') = 200 and pg_temp.q('bat', 'morango') = 300);
-- batch 11,008 + per unit (1,615 × 5 = 8,075) + labour (0,70 × 5 = 3,50) = 22,583 → 4,52 each
select t.igual('C4 after: (11,008 + 1,615 × 5 + 0,70 × 5) ÷ 5 = 4,52 each', (select cost from public.products where id = pg_temp.id('bat')), 4.52);
select t.verdade('C5 labour is a cost without stock: no ingredient called "Mão de obra" was created',
  not exists (select 1 from public.ingredients where user_id = pg_temp.id('u') and name ilike 'mão de obra%'));
select t.verdade('C6 the labour is kept on the product', (select custos_extras from public.products where id = pg_temp.id('bat')) = '[{"nome": "Mão de obra", "por": "unidade", "valor": 0.70}]'::jsonb);
-- saving again from an old app (3 args) keeps the labour
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('leite'), 'nome', 'Leite', 'qtd', 200, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('morango'), 'nome', 'Morango', 'qtd', 300, 'preco', 0, 'por', 'receita'),
  jsonb_build_object('id', pg_temp.id('garrafa'), 'nome', 'Garrafa', 'qtd', 1, 'preco', 0, 'por', 'unidade'),
  jsonb_build_object('id', pg_temp.id('adesivo'), 'nome', 'Adesivo', 'qtd', 1, 'preco', 0, 'por', 'unidade'),
  jsonb_build_object('id', pg_temp.id('canudo'), 'nome', 'Canudo', 'qtd', 1, 'preco', 0, 'por', 'unidade')), 5) is not null as ok3 \gset
select t.igual('C7 a save without extras keeps the labour (same cost 4,52)', (select cost from public.products where id = pg_temp.id('bat')), 4.52);
select t.verdade('C8 invalid labour is refused', t.erro(format('select public.produto_salvar_receita(%L, %L::jsonb, 5, %L::jsonb)', pg_temp.id('bat'),
  jsonb_build_array(jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0)),
  jsonb_build_array(jsonb_build_object('nome', 'Mão de obra', 'valor', -1, 'por', 'unidade')))) <> 'ok');

-- ---------------------------------------------------------------- 3) production: physical consumption
select t.verdade('P1 producing 5 = 1 recipe: 1 box and 5 bottles leave the stock',
  pg_temp.produzir('rpu-0001', 'bat', null, 5) = 'ok' and pg_temp.est('lc') = 9 and pg_temp.est('garrafa') = 95 and pg_temp.est('adesivo') = 95 and pg_temp.est('canudo') = 95);
select t.verdade('P2 producing 10 = 2 recipes: 2 boxes and 10 bottles', pg_temp.produzir('rpu-0002', 'bat', null, 10) = 'ok' and pg_temp.est('lc') = 7 and pg_temp.est('garrafa') = 85);
select t.verdade('P3 the same production sent twice is not consumed twice', pg_temp.produzir('rpu-0002', 'bat', null, 10) = 'ok' and pg_temp.est('lc') = 7 and pg_temp.est('garrafa') = 85);
select t.igual('P4 15 Batidas in stock', pg_temp.est('bat'), 15);

-- ---------------------------------------------------------------- 4) the yield changes elsewhere: per-unit lines follow
update public.products set batch_yield = 8 where id = pg_temp.id('bat');
select t.verdade('Y1 yield 5 → 8: still 1 bottle per unit (8 per batch); the box stays 1 per batch',
  pg_temp.q('bat', 'garrafa') = 8 and pg_temp.q('bat', 'lc') = 1);
select t.verdade('Y2 producing 8 now: 1 box and 8 bottles', pg_temp.produzir('rpu-0003', 'bat', null, 8) = 'ok' and pg_temp.est('lc') = 6 and pg_temp.est('garrafa') = 77);
update public.products set batch_yield = 5 where id = pg_temp.id('bat');

-- ---------------------------------------------------------------- 5) a flavour with its own yield
do $$
declare v uuid;
begin
  insert into public.product_variants (user_id, product_id, name, posicao, batch_yield) values (pg_temp.id('u'), pg_temp.id('bat'), 'Grande', 0, 4) returning id into v;
  insert into f values ('bat:grande', v);
end $$;
select t.verdade('S1 flavour making 4 per recipe, 4 units: 1 box (4 ÷ 4) and 4 bottles (1 per unit, not 5)',
  pg_temp.produzir('rpu-0004', 'bat', 'bat:grande', 4) = 'ok' and pg_temp.est('lc') = 5 and pg_temp.est('garrafa') = 73);

-- ---------------------------------------------------------------- 6) a Mercado price change keeps the labour in the cost
update public.ingredients set cost_per_unit = 1.50 where id = pg_temp.id('garrafa');
select public.recalc_custo_produtos_do_ingrediente(pg_temp.id('garrafa'));
-- (11,008 + (1,50 + 0,25 + 0,065) × 5 + 3,50) ÷ 5 = 4,72
select t.igual('M1 bottle R$ 1,50: (11,008 + 1,815 × 5 + 3,50) ÷ 5 = 4,72', (select cost from public.products where id = pg_temp.id('bat')), 4.72);
select t.igual('M2 the old product without extras: same old formula ((6,49 + 1,50) ÷ 5)', (select cost from public.products where id = pg_temp.id('velha')), 1.60);

-- ---------------------------------------------------------------- 7) rollback refuses while there is per-unit data
\set ON_ERROR_STOP off
\ir ../../receita-por-unidade/rollback.sql
rollback;
\set ON_ERROR_STOP on
select t.verdade('R1 rollback refused: per-unit lines and labour are still there, nothing changed',
  pg_temp.q('bat', 'garrafa') = 5 and exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'custos_extras'));
