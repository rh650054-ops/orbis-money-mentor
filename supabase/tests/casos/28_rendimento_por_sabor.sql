-- Yield per flavour (23/11/2026). Rules (Rick, 23/11):
--   * each flavour may have its own yield; each flavour may take the base recipe or have its own;
--   * usa_base is true by default (today's behaviour);
--   * the same ingredient may be in several recipes and flavours with ONE stock record;
--   * consumption uses each flavour's yield;
--   * an incomplete recipe (an active ingredient without quantity included) does not open the new
--     production;
--   * the old paths, which only know the product's yield, refuse these products and only these.
-- Fictional data only.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity::numeric from public.product_variants where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
-- producao_registrar with items given as [[product, flavour or null, units], ...]
create or replace function pg_temp.produzir(p_chave text, p_itens text[][], p_just text default null) returns text language plpgsql as $$
declare v jsonb := '[]'; i int;
begin
  for i in 1 .. array_length(p_itens, 1) loop
    v := v || jsonb_strip_nulls(jsonb_build_object('produto', pg_temp.id(p_itens[i][1]), 'sabor', pg_temp.id(nullif(p_itens[i][2], '')), 'unidades', p_itens[i][3]::int));
  end loop;
  return t.erro(format('select public.producao_registrar(%L, %L::jsonb, null, null, %L)', p_chave, v, p_just));
end $$;
create or replace function pg_temp.consumo(p_chave text, p_ing text) returns numeric language sql as $$
  select c.quantidade_receita from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id
   where e.chave = p_chave and c.ingredient_id = pg_temp.id(p_ing)
$$;

do $$
declare u uuid := t.vendedor('Sabor Teste'); p uuid; v uuid;
begin
  insert into f values ('u', u);
  perform t.logar(u);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Leite condensado', 'lata', 100) returning id into v; insert into f values ('lc', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Açúcar', 'g', 10000) returning id into v; insert into f values ('acucar', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Polpa de maracujá', 'g', 10000) returning id into v; insert into f values ('mara', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Morango', 'g', 10000) returning id into v; insert into f values ('moran', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Creme de café', 'g', 10000) returning id into v; insert into f values ('cafe', v);
  -- Batida: base per batch of 10 = 1 can + 100 g sugar
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Batida', 'batch', 10, 'faz') returning id into p;
  insert into f values ('bat', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, pg_temp.id('lc'), 1), (u, p, pg_temp.id('acucar'), 100);
  insert into public.product_variants (user_id, product_id, name, posicao) values (u, p, 'Maracujá', 0) returning id into v; insert into f values ('bat:mara', v);
  insert into public.product_variants (user_id, product_id, name, posicao) values (u, p, 'Morango', 1) returning id into v; insert into f values ('bat:moran', v);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values
    (u, p, pg_temp.id('mara'), 200, pg_temp.id('bat:mara')), (u, p, pg_temp.id('moran'), 300, pg_temp.id('bat:moran'));
  -- Brigadeiro: an old-style product (no per-flavour data), with a flavour extra, as in production today
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Brigadeiro', 'batch', 20, 'faz') returning id into p;
  insert into f values ('brig', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, pg_temp.id('lc'), 1);
  insert into public.product_variants (user_id, product_id, name) values (u, p, 'Branco') returning id into v; insert into f values ('brig:branco', v);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, pg_temp.id('acucar'), 50, v);
end $$;
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- defaults: nothing changes for existing flavours
select t.verdade('D1 existing and new flavours: no own yield, take the base (usa_base = true)',
  (select bool_and(batch_yield is null and usa_base) from public.product_variants));
select t.verdade('D2 the old products are not "per flavour": the old paths still accept them',
  not public.produto_receita_por_sabor(pg_temp.id('bat')) and not public.produto_receita_por_sabor(pg_temp.id('brig')));
select t.verdade('D3 with no per-flavour data, consumption is the 22/11 one: 10 maracujá + 10 morango = 2 cans',
  pg_temp.produzir('sab-0001', array[['bat','bat:mara','10'],['bat','bat:moran','10']]) = 'ok'
  and pg_temp.consumo('sab-0001', 'lc') = 2 and pg_temp.consumo('sab-0001', 'mara') = 200 and pg_temp.consumo('sab-0001', 'moran') = 300);

-- ---------------------------------------------------------------- each flavour with its own yield
update public.product_variants set batch_yield = 5 where id = pg_temp.id('bat:mara');
update public.product_variants set batch_yield = 6 where id = pg_temp.id('bat:moran');
select t.verdade('Y1 more units per batch than the product (5, 6 vs 10)? no: FEWER, so no reason is asked',
  not exists (select 1 from public.receita_alteracoes where variant_id is not null and campo = 'rendimento' and reduz));
select t.verdade('Y2 10 maracujá (rende 5) + 12 morango (rende 6) = 2 + 2 = 4 cans of the base',
  pg_temp.produzir('sab-0002', array[['bat','bat:mara','10'],['bat','bat:moran','12']]) = 'ok'
  and pg_temp.consumo('sab-0002', 'lc') = 4);
select t.igual('Y3 base sugar follows the same batches: 4 x 100 g', pg_temp.consumo('sab-0002', 'acucar'), 400);
select t.igual('Y4 maracujá extra uses ITS yield: 10/5 x 200 g', pg_temp.consumo('sab-0002', 'mara'), 400);
select t.igual('Y5 morango extra uses ITS yield: 12/6 x 300 g', pg_temp.consumo('sab-0002', 'moran'), 600);
select t.igual('Y6 the stock moved by exactly that (100 - 2 - 4 cans)', pg_temp.est('lc'), 94);
select t.igual('Y7 flavour stock grew by what was produced', pg_temp.est('bat:mara') + pg_temp.est('bat:moran'), 10 + 10 + 10 + 12);
select t.verdade('Y8 a flavour without own yield keeps the product one (item without flavour: 10 units = 1 can)',
  pg_temp.produzir('sab-0003', array[['bat','','10']]) = 'ok' and pg_temp.consumo('sab-0003', 'lc') = 1);
update public.product_variants set batch_yield = 20 where id = pg_temp.id('bat:mara');
select t.verdade('Y9 raising a flavour yield (5 -> 20) is a reduction: logged, the next production asks why once',
  exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('bat:mara') and campo = 'rendimento' and antes = '5' and depois = '20' and reduz)
  and pg_temp.produzir('sab-0004', array[['bat','bat:mara','20']]) like 'VANT_RECEITA_REDUZIDA|%Batida%'
  and pg_temp.produzir('sab-0005', array[['bat','bat:mara','20']], 'forma maior, rende mais') = 'ok'
  and pg_temp.consumo('sab-0005', 'lc') = 1);
update public.product_variants set batch_yield = 5 where id = pg_temp.id('bat:mara');
select t.verdade('Y10 lowering it back (20 -> 5) consumes more: logged, not a reduction, no reason',
  exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('bat:mara') and antes = '20' and depois = '5' and not reduz)
  and pg_temp.produzir('sab-0006', array[['bat','bat:mara','5']]) = 'ok');
select t.verdade('Y11 the yield must be > 0 (null = the product one)',
  t.erro(format('update public.product_variants set batch_yield = 0 where id = %L', pg_temp.id('bat:mara'))) like '23514|%');

-- ---------------------------------------------------------------- shared ingredients, one stock record
select t.verdade('S1 the same ingredient in the base AND in a flavour: allowed now (was UNIQUE)',
  t.erro(format('insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (%L, %L, %L, 30, %L)',
    pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('acucar'), pg_temp.id('bat:moran'))) = 'ok');
select t.verdade('S2 ...and in a second flavour too',
  t.erro(format('insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (%L, %L, %L, 20, %L)',
    pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('acucar'), pg_temp.id('bat:mara'))) = 'ok');
select t.igual('S3 still ONE sugar in stock', (select count(*) from public.ingredients where user_id = pg_temp.id('u') and name = 'Açúcar'), 1);
select t.verdade('S4 twice in the base of one product: still refused',
  t.erro(format('insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (%L, %L, %L, 5)',
    pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('acucar'))) like '23505|%');
select t.verdade('S5 twice in the same flavour: still refused',
  t.erro(format('insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (%L, %L, %L, 5, %L)',
    pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('acucar'), pg_temp.id('bat:mara'))) like '23505|%');
select t.verdade('S6 sugar is consumed from every place it is in: base 4 x 100 + maracujá 10/5 x 20 + morango 12/6 x 30 = 500',
  pg_temp.produzir('sab-0007', array[['bat','bat:mara','10'],['bat','bat:moran','12']]) = 'ok'
  and pg_temp.consumo('sab-0007', 'acucar') = 500);
select t.verdade('S7 one consumption line per ingredient (summed), not one per recipe row',
  (select count(*) = 1 from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id
    where e.chave = 'sab-0007' and c.ingredient_id = pg_temp.id('acucar')));

-- ---------------------------------------------------------------- a flavour with its own recipe (no base)
do $$
declare v uuid;
begin
  insert into public.product_variants (user_id, product_id, name, posicao, batch_yield, usa_base)
  values (pg_temp.id('u'), pg_temp.id('bat'), 'Café', 2, 8, false) returning id into v;
  insert into f values ('bat:cafe', v);
end $$;
select t.verdade('P1 a new flavour created without the base is logged (no reduction: nothing produced with it yet)',
  exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('bat:cafe') and campo = 'modo' and depois = 'receita_propria' and not reduz));
select t.verdade('P2 own recipe still empty: refused as incomplete (the base does not count for it)',
  pg_temp.produzir('sab-0008', array[['bat','bat:cafe','8']]) like 'VANT_RECEITA_INCOMPLETA|%Batida%');
insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values
  (pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('cafe'), 80, pg_temp.id('bat:cafe')),
  (pg_temp.id('u'), pg_temp.id('bat'), pg_temp.id('acucar'), 40, pg_temp.id('bat:cafe'));
select t.verdade('P3 8 cafés (rende 8): only its own recipe, no can of the base',
  pg_temp.produzir('sab-0009', array[['bat','bat:cafe','8']]) = 'ok'
  and pg_temp.consumo('sab-0009', 'cafe') = 80 and pg_temp.consumo('sab-0009', 'acucar') = 40 and pg_temp.consumo('sab-0009', 'lc') is null);
select t.verdade('P4 mixed with base flavours in one call: each by its own rule (cans only from maracujá: 5/5 = 1)',
  pg_temp.produzir('sab-0010', array[['bat','bat:cafe','16'],['bat','bat:mara','5']]) = 'ok'
  and pg_temp.consumo('sab-0010', 'lc') = 1 and pg_temp.consumo('sab-0010', 'cafe') = 160
  and pg_temp.consumo('sab-0010', 'acucar') = 100 + 20 + 80);
update public.product_variants set usa_base = false where id = pg_temp.id('bat:mara');
select t.verdade('P5 a flavour leaving the base is a reduction (it stops taking the base)',
  exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('bat:mara') and campo = 'modo' and antes = 'usa_base' and depois = 'receita_propria' and reduz)
  and pg_temp.produzir('sab-0011', array[['bat','bat:mara','5']]) like 'VANT_RECEITA_REDUZIDA|%'
  and pg_temp.produzir('sab-0012', array[['bat','bat:mara','5']], 'maracujá sem leite agora') = 'ok'
  and pg_temp.consumo('sab-0012', 'lc') is null and pg_temp.consumo('sab-0012', 'mara') = 200);
update public.product_variants set usa_base = true where id = pg_temp.id('bat:mara');
select t.verdade('P6 back to the base: logged, not a reduction',
  exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('bat:mara') and antes = 'receita_propria' and depois = 'usa_base' and not reduz)
  and pg_temp.produzir('sab-0013', array[['bat','bat:mara','5']]) = 'ok' and pg_temp.consumo('sab-0013', 'lc') = 1);

-- ---------------------------------------------------------------- incomplete recipes do not open the new production
update public.product_recipes set quantity = 0 where variant_id = pg_temp.id('bat:moran') and ingredient_id = pg_temp.id('moran');
select t.verdade('I1 a zeroed ingredient in the flavour: that flavour is refused as incomplete, with or without a reason',
  pg_temp.produzir('sab-0014', array[['bat','bat:moran','6']]) like 'VANT_RECEITA_INCOMPLETA|%Batida%'
  and pg_temp.produzir('sab-0015', array[['bat','bat:moran','6']], 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%');
select t.verdade('I2 ...a mixed call with it is refused whole (nothing moves)',
  pg_temp.produzir('sab-0016', array[['bat','bat:mara','5'],['bat','bat:moran','6']], 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%'
  and not exists (select 1 from public.producao_eventos where chave = 'sab-0016'));
select t.verdade('I3 ...the other flavours of the product still produce', pg_temp.produzir('sab-0017', array[['bat','bat:mara','5']], 'reduções anteriores') = 'ok');
update public.product_recipes set quantity = 300 where variant_id = pg_temp.id('bat:moran') and ingredient_id = pg_temp.id('moran');
update public.product_recipes set aprender = true where product_id = pg_temp.id('bat') and variant_id is null and ingredient_id = pg_temp.id('acucar');
select t.verdade('I4 a base line still "to learn at the next purchase" (aprender): incomplete for every flavour that takes the base',
  pg_temp.produzir('sab-0018', array[['bat','bat:mara','5']], 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%'
  and pg_temp.produzir('sab-0019', array[['bat','','10']], 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%');
select t.verdade('I5 ...but not for the flavour with its own recipe (the base does not apply to it)',
  pg_temp.produzir('sab-0020', array[['bat','bat:cafe','8']], 'motivo qualquer') = 'ok');
update public.product_recipes set aprender = false where product_id = pg_temp.id('bat') and variant_id is null and ingredient_id = pg_temp.id('acucar');

-- ---------------------------------------------------------------- the old paths: refuse per-flavour products only
select t.verdade('L1 per-flavour product: the old "Produzi" refuses it, with its own hint',
  t.erro(format('select public.produto_produzir(%L, 10)', pg_temp.id('bat'))) like 'VANT_RECEITA_POR_SABOR|%');
select t.verdade('L2 ...the old "Produzi por sabor" refuses it',
  t.erro(format($q$select public.produto_produzir_sabores(%L, jsonb_build_array(jsonb_build_object('id', %L, 'unidades', 5)))$q$, pg_temp.id('bat'), pg_temp.id('bat:mara'))) like 'VANT_RECEITA_POR_SABOR|%');
select t.verdade('L3 ...the old "distribuir sem sabor" refuses it',
  t.erro(format($q$select public.produto_sabores_distribuir(%L, jsonb_build_array(jsonb_build_object('id', %L, 'unidades', 1)))$q$, pg_temp.id('bat'), pg_temp.id('bat:mara'))) like 'VANT_RECEITA_POR_SABOR|%');
select pg_temp.est('lc') as lc_antes \gset
select public.produto_produzir(pg_temp.id('brig'), 20) is not null as produziu \gset
select t.igual('L4 old product: the old "Produzi" works as in production (base only: 20 brigadeiros = 1 can)', pg_temp.est('lc'), :lc_antes - 1);
select pg_temp.est('acucar') as acucar_antes \gset
select t.erro(format($q$select public.produto_produzir_sabores(%L, jsonb_build_array(jsonb_build_object('id', %L, 'unidades', 20)))$q$, pg_temp.id('brig'), pg_temp.id('brig:branco'))) as l5 \gset
select t.verdade('L5 old product: the old "Produzi por sabor" works (20 brancos = 1 can + 50 g sugar)',
  :'l5' = 'ok' and pg_temp.est('lc') = :lc_antes - 2 and pg_temp.est('acucar') = :acucar_antes - 50
  and (select count(*) from public.production_batches where product_id = pg_temp.id('brig')) = 2);

-- ---------------------------------------------------------------- saving flavours (produto_sabores_salvar)
select t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","itens":[{"nome":"Polpa de maracujá","qtd":200}]},{"nome":"Morango","itens":[{"nome":"Morango","qtd":300}]},{"nome":"Café","itens":[{"nome":"Creme de café","qtd":80}]}]'::jsonb)$q$, pg_temp.id('bat'))) as v1 \gset
select t.verdade('V1 the app today (no new keys): saves as before and keeps yield / usa_base untouched',
  :'v1' = 'ok'
  and (select batch_yield from public.product_variants where id = pg_temp.id('bat:mara')) = 5
  and (select batch_yield = 8 and not usa_base from public.product_variants where id = pg_temp.id('bat:cafe')));
select t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","itens":[{"nome":"Polpa de maracujá","qtd":200},{"nome":"Açúcar","qtd":20}]},{"nome":"Morango","itens":[{"nome":"Morango","qtd":300},{"nome":"Açúcar","qtd":30}]},{"nome":"Café","itens":[{"nome":"Creme de café","qtd":80}]}]'::jsonb)$q$, pg_temp.id('bat'))) as v2 \gset
select t.verdade('V2 the same ingredient in two flavours, in one save: saved (the 22/11 bug: UNIQUE lost the whole save)',
  :'v2' = 'ok'
  and (select count(*) from public.product_recipes where product_id = pg_temp.id('bat') and ingredient_id = pg_temp.id('acucar')) = 3
  and (select count(*) from public.ingredients where user_id = pg_temp.id('u') and name = 'Açúcar') = 1);
select t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","rende":4,"usa_base":true,"itens":[{"nome":"Polpa de maracujá","qtd":200}]},{"nome":"Morango","rende":null,"itens":[{"nome":"Morango","qtd":300}]},{"nome":"Café","usa_base":false,"itens":[{"nome":"Creme de café","qtd":80}]},{"nome":"Coco","rende":7,"usa_base":false,"itens":[{"nome":"Coco ralado","qtd":90}]}]'::jsonb)$q$, pg_temp.id('bat'))) as v3 \gset
select t.verdade('V3 new keys: rende and usa_base are saved',
  :'v3' = 'ok'
  and (select batch_yield from public.product_variants where id = pg_temp.id('bat:mara')) = 4
  and (select batch_yield is null and usa_base from public.product_variants where id = pg_temp.id('bat:moran'))
  and (select batch_yield = 8 and not usa_base from public.product_variants where id = pg_temp.id('bat:cafe'))
  and (select batch_yield = 7 and not usa_base from public.product_variants where product_id = pg_temp.id('bat') and name = 'Coco'));
select t.verdade('V4 invalid yield (0, text): refused, nothing saved',
  t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","rende":0}]'::jsonb)$q$, pg_temp.id('bat'))) like 'VANT_SABOR_RENDE_INVALIDO|%'
  and t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","rende":"6"}]'::jsonb)$q$, pg_temp.id('bat'))) like 'VANT_SABOR_RENDE_INVALIDO|%'
  and t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Maracujá","usa_base":"sim"}]'::jsonb)$q$, pg_temp.id('bat'))) like 'VANT_SABOR_USA_BASE_INVALIDO|%');
select t.verdade('V4 ...and nothing was saved', (select count(*) from public.product_variants where product_id = pg_temp.id('bat')) = 4);
do $$
declare p uuid;
begin
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (pg_temp.id('u'), 'Salgado', 'per_unit', 0, 'faz') returning id into p;
  insert into f values ('salg', p);
end $$;
select t.verdade('V5 per_unit product: no yield or own recipe per flavour (consumed at the sale, by the base)',
  t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Frango","rende":5}]'::jsonb)$q$, pg_temp.id('salg'))) like 'VANT_SABOR_POR_UNIDADE|%'
  and t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Frango","usa_base":false}]'::jsonb)$q$, pg_temp.id('salg'))) like 'VANT_SABOR_POR_UNIDADE|%'
  and t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"Frango"}]'::jsonb)$q$, pg_temp.id('salg'))) = 'ok');
select t.verdade('V6 another seller cannot save flavours on this product',
  t.erro(format($q$select public.produto_sabores_salvar(%L, '[{"nome":"X","rende":3}]'::jsonb)$q$, pg_temp.id('bat')), null, gen_random_uuid()) like '%produto não é seu');
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- permissions
select t.verdade('A1 the helper is not callable by the app (anon, authenticated)',
  not has_function_privilege('authenticated', 'public.produto_receita_por_sabor(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.produto_receita_por_sabor(uuid)', 'execute'));
select t.verdade('A2 the old functions keep their grants (authenticated can still call them)',
  has_function_privilege('authenticated', 'public.produto_produzir(uuid,numeric)', 'execute')
  and has_function_privilege('authenticated', 'public.produto_sabores_salvar(uuid,jsonb)', 'execute'));
select t.verdade('A3 nothing touched costs: products.cost unchanged by any of the above',
  (select cost from public.products where id = pg_temp.id('bat')) = 0 and (select cost from public.products where id = pg_temp.id('brig')) = 0);
