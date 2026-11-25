-- How the seller measures what he uses (25/11/2026, Rick). Rules:
--   * the ingredient keeps its stock unit (caixinha = un); the line quantity is in that unit
--     (200 g of a 395 g box = 200/395 box), so cost and production need no conversion here;
--   * receita_definir_medidas only remembers the package content, its name and the unit typed;
--   * it never changes quantity, stock or cost, and only the owner's rows.
-- Fictional data only.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
do $$
declare u uuid := t.vendedor('Medida Teste'); o uuid := t.vendedor('Medida Outro'); v uuid; p uuid;
begin
  insert into f values ('u', u), ('o', o);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Leite condensado', 'un', 10, 3.79) returning id into v; insert into f values ('lc', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values (u, 'Morango', 'g', 3000, 0.01499, 1000) returning id into v; insert into f values ('mor', v);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (o, 'Leite condensado', 'un', 4, 5) returning id into v; insert into f values ('lc_outro', v);
  insert into public.products (user_id, name, sale_price, stock_quantity) values (u, 'Batida', 20, 0) returning id into p; insert into f values ('bat', p);
  insert into public.products (user_id, name, sale_price, stock_quantity) values (o, 'Do outro', 10, 0) returning id into p; insert into f values ('outro', p);
end $$;
select t.logar(pg_temp.id('u'));

-- 200 g of a 395 g box (the app converts: 200/395 box) + 300 g of strawberry bought by the kg, yield 1
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 200.0 / 395, 'preco', 0),
  jsonb_build_object('id', pg_temp.id('mor'), 'nome', 'Morango', 'qtd', 300, 'preco', 0)), 1) is not null as ok0 \gset
-- 0,50633 × 3,79 = 1,919 + 300 × 0,01499 = 4,497 → 6,42
select t.igual('M1 cost: 200 g of a R$ 3,79 box of 395 g (1,92) + 300 g of R$ 14,99/kg (4,50) = 6,42',
  (select cost from public.products where id = pg_temp.id('bat')), 6.42);

select t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('nome', 'leite  Condensado ', 'unidade_uso', 'g', 'conteudo_qtd', 395, 'conteudo_unidade', 'g', 'embalagem', 'caixinha'),
  jsonb_build_object('nome', 'Morango', 'unidade_uso', 'g')))) as m2 \gset
select t.verdade('M2a accepted', :'m2' = 'ok');
select t.verdade('M2 the box content and name are remembered on the SAME ingredient (no duplicate), the unit typed on the line',
  (select conteudo_qtd = 395 and conteudo_unidade = 'g' and embalagem_nome = 'caixinha' from public.ingredients where id = pg_temp.id('lc'))
  and (select count(*) from public.ingredients where user_id = pg_temp.id('u') and lower(name) = 'leite condensado') = 1
  and (select unidade_uso from public.product_recipes where product_id = pg_temp.id('bat') and ingredient_id = pg_temp.id('lc')) = 'g');
select t.verdade('M3 nothing else changed: quantity, stock and cost stay as saved',
  (select quantity from public.product_recipes where product_id = pg_temp.id('bat') and ingredient_id = pg_temp.id('lc')) = 200.0 / 395
  and pg_temp.est('lc') = 10 and (select cost_per_unit from public.ingredients where id = pg_temp.id('lc')) = 3.79
  and (select cost from public.products where id = pg_temp.id('bat')) = 6.42);
select t.verdade('M4 g and ml are never mixed: an invalid content unit is refused',
  t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado', 'conteudo_qtd', 1, 'conteudo_unidade', 'caixa')))) <> 'ok'
  and (select conteudo_unidade from public.ingredients where id = pg_temp.id('lc')) = 'g');
select t.verdade('M5 content without its unit, zero or negative: refused',
  t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado', 'conteudo_qtd', 395)))) <> 'ok'
  and t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado', 'conteudo_qtd', 0, 'conteudo_unidade', 'g')))) <> 'ok');
select t.verdade('M6 another seller''s product: refused, his ingredient untouched',
  t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('outro'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado', 'conteudo_qtd', 1, 'conteudo_unidade', 'g')))) <> 'ok'
  and (select conteudo_qtd from public.ingredients where id = pg_temp.id('lc_outro')) is null);
-- the call runs first (\gset): inside one AND the planner may read the rows before the call
select t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado')))) as m7 \gset
select t.verdade('M7 the unit typed can be cleared (back to the box) without clearing the box content',
  :'m7' = 'ok'
  and (select unidade_uso from public.product_recipes where product_id = pg_temp.id('bat') and ingredient_id = pg_temp.id('lc')) is null
  and (select conteudo_qtd from public.ingredients where id = pg_temp.id('lc')) = 395);
select t.verdade('M8 the app cannot write the new columns of someone else directly (RLS as before) and the function is not open to anon',
  not has_function_privilege('anon', 'public.receita_definir_medidas(uuid, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.receita_definir_medidas(uuid, jsonb)', 'EXECUTE'));
select t.erro(format('select public.receita_definir_medidas(%L, %L::jsonb)', pg_temp.id('bat'), jsonb_build_array(jsonb_build_object('nome', 'Leite condensado', 'embalagem', '')))) as m9 \gset
select t.verdade('M9 back to plain "un": the package name is cleared, the content is kept', :'m9' = 'ok'
  and (select embalagem_nome is null and conteudo_qtd = 395 from public.ingredients where id = pg_temp.id('lc')));
-- production of 1 unit (yield 1): 200/395 of a box leaves the box stock, 300 g leave the strawberry
select t.erro(format('select public.producao_registrar(%L, %L::jsonb, null, null, %L)', 'med-0001',
  jsonb_build_array(jsonb_build_object('produto', pg_temp.id('bat'), 'unidades', 1)), 'medida de uso')) as p1 \gset
select t.verdade('P1 production takes 0,5063 box (never 200 boxes, never 200 g of "un") and 300 g of strawberry',
  :'p1' = 'ok' and round(pg_temp.est('lc'), 4) = round(10 - 200.0 / 395, 4) and pg_temp.est('mor') = 2700 and pg_temp.est('bat') = 1);
