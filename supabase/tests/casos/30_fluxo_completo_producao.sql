-- Products, Mercado and Production — the whole operational flow (23/11/2026), fictional data:
-- buy ingredients → recipes for morango and maracujá → produce different amounts → ingredients go
-- down exactly → sell → check stock → correct and undo. Plus failures, duplicates, missing
-- ingredients, a lost connection, initial stock per flavour, an old purchase edited, resale,
-- an incomplete recipe and price precision.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity::numeric from public.product_variants where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
create or replace function pg_temp.ing(p_nome text) returns uuid language sql as $$
  select id from public.ingredients where user_id = pg_temp.id('u') and name = p_nome
$$;
create or replace function pg_temp.itens(p text[][]) returns jsonb language plpgsql as $$
declare v jsonb := '[]'; i int;
begin
  for i in 1 .. array_length(p, 1) loop
    v := v || jsonb_strip_nulls(jsonb_build_object('produto', pg_temp.id(p[i][1]), 'sabor', pg_temp.id(nullif(p[i][2], '')), 'unidades', p[i][3]::int));
  end loop;
  return v;
end $$;
create or replace function pg_temp.registrar(p_chave text, p text[][], p_just text default null) returns text language sql as $$
  select t.erro(format('select public.producao_registrar(%L, %L::jsonb, null, null, %L)', p_chave, pg_temp.itens(p), p_just))
$$;
create or replace function pg_temp.registro(p_chave text) returns uuid language sql as $$
  select registro_id from public.producao_eventos where chave = p_chave
$$;

select t.vendedor('Fluxo Completo') as u \gset
insert into f values ('u', :'u');
select t.logar(:'u');

-- ---------------------------------------------------------------- 1) recipes first (the registration), no stock yet
do $$
declare u uuid := pg_temp.id('u'); p uuid; v uuid;
begin
  insert into public.ingredients (user_id, name, unit) values (u, 'Leite condensado', 'un'), (u, 'Açúcar', 'g'), (u, 'Morango', 'g'), (u, 'Polpa de maracujá', 'g');
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem, sale_price) values (u, 'Batida', 'batch', 10, 'faz', 12) returning id into p;
  insert into f values ('bat', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, pg_temp.ing('Leite condensado'), 1), (u, p, pg_temp.ing('Açúcar'), 100);
end $$;
select public.produto_sabores_salvar(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('nome', 'Morango', 'rende', 6, 'itens', jsonb_build_array(jsonb_build_object('nome', 'Morango', 'qtd', 300), jsonb_build_object('nome', 'Açúcar', 'qtd', 30))),
  jsonb_build_object('nome', 'Maracujá', 'rende', 5, 'itens', jsonb_build_array(jsonb_build_object('nome', 'Polpa de maracujá', 'qtd', 200))))) is not null as ok \gset
insert into f select 'bat:' || lower(left(name, 3)), id from public.product_variants where product_id = pg_temp.id('bat');
select t.verdade('C1 recipes saved: Morango (rende 6) and Maracujá (rende 5), sugar shared by the base and Morango, one stock record',
  (select batch_yield from public.product_variants where id = pg_temp.id('bat:mor')) = 6
  and (select batch_yield from public.product_variants where id = pg_temp.id('bat:mar')) = 5
  and (select count(*) from public.product_recipes where ingredient_id = pg_temp.ing('Açúcar')) = 2
  and (select count(*) from public.ingredients where user_id = pg_temp.id('u') and name = 'Açúcar') = 1);

-- ---------------------------------------------------------------- 2) Mercado: buy, nothing is manufactured
select public.mercado_salvar(jsonb_build_array(
  jsonb_build_object('tipo', 'ingrediente', 'id', pg_temp.ing('Leite condensado'), 'nome', 'Leite condensado', 'qtd', 10, 'preco_unit', 6.5, 'para', '[]'::jsonb),
  jsonb_build_object('tipo', 'ingrediente', 'id', pg_temp.ing('Açúcar'), 'nome', 'Açúcar', 'qtd', 1000, 'preco_unit', 0.03599, 'para', '[]'::jsonb),
  jsonb_build_object('tipo', 'ingrediente', 'id', pg_temp.ing('Morango'), 'nome', 'Morango', 'qtd', 2000, 'preco_unit', 0.02, 'para', '[]'::jsonb),
  jsonb_build_object('tipo', 'ingrediente', 'id', pg_temp.ing('Polpa de maracujá'), 'nome', 'Polpa de maracujá', 'qtd', 1000, 'preco_unit', 0.03, 'para', '[]'::jsonb)),
  null, true, 0, null, null) as compra \gset
insert into f values ('lc', pg_temp.ing('Leite condensado')), ('acucar', pg_temp.ing('Açúcar')), ('mor', pg_temp.ing('Morango')), ('mar', pg_temp.ing('Polpa de maracujá'));
select t.verdade('M1 ingredients went into stock (10 cans, 1000 g sugar, 2000 g strawberry, 1000 g pulp)',
  pg_temp.est('lc') = 10 and pg_temp.est('acucar') = 1000 and pg_temp.est('mor') = 2000 and pg_temp.est('mar') = 1000);
select t.verdade('M2 the purchase manufactured NOTHING: product and flavour stock 0, no batch',
  pg_temp.est('bat') = 0 and pg_temp.est('bat:mor') = 0 and pg_temp.est('bat:mar') = 0
  and not exists (select 1 from public.production_batches where user_id = pg_temp.id('u')));
select t.verdade('M3 the answer says it made nothing and the recipe is complete (per-flavour: no single "pode fazer")',
  (select bool_and((p->>'unidades')::numeric = 0 and (p->>'receita_completa')::boolean and p->'pode_unidades' = 'null'::jsonb)
     from jsonb_array_elements((:'compra'::jsonb)->'produtos') p)
  and jsonb_array_length((:'compra'::jsonb)->'produtos') = 1);
select t.igual('M4 R$ 35,99 per kg of sugar is kept exact: 0,03599 per g (was 0,0360)', (select cost_per_unit from public.ingredients where id = pg_temp.id('acucar')), 0.03599);
select t.verdade('M5 the purchase total is recorded (65 + 35,99 + 40 + 30) and, as today, not thrown into the day cost',
  (select total from public.mercado_compras where id = ((:'compra'::jsonb)->>'compra_id')::uuid) = 170.99
  and not exists (select 1 from public.daily_sales where user_id = pg_temp.id('u') and coalesce(cost, 0) > 0));

-- ---------------------------------------------------------------- 3) preview, then produce different amounts
select public.producao_simular(pg_temp.itens(array[['bat','bat:mor','12'],['bat','bat:mar','10']])) as sim \gset
select t.verdade('P0 preview writes nothing and lists what goes: 4 cans, 460 g sugar, nothing missing',
  not exists (select 1 from public.producao_eventos where user_id = pg_temp.id('u'))
  and exists (select 1 from jsonb_array_elements((:'sim'::jsonb)->'consumo') c where c->>'nome' = 'Leite condensado' and (c->>'real')::numeric = 4)
  and exists (select 1 from jsonb_array_elements((:'sim'::jsonb)->'consumo') c where c->>'nome' = 'Açúcar' and (c->>'real')::numeric = 460)
  and jsonb_array_length((:'sim'::jsonb)->'faltas') = 0);
select t.verdade('P1 12 morango (rende 6) + 10 maracujá (rende 5): registered',
  pg_temp.registrar('fluxo-0001', array[['bat','bat:mor','12'],['bat','bat:mar','10']]) = 'ok');
select t.verdade('P2 ingredients down exactly: cans 10-4, sugar 1000-(400+60), strawberry 2000-600, pulp 1000-400',
  pg_temp.est('lc') = 6 and pg_temp.est('acucar') = 540 and pg_temp.est('mor') = 1400 and pg_temp.est('mar') = 600);
select t.verdade('P3 product 22, morango 12, maracujá 10', pg_temp.est('bat') = 22 and pg_temp.est('bat:mor') = 12 and pg_temp.est('bat:mar') = 10);

-- ---------------------------------------------------------------- 4) duplicates and a lost connection
select t.verdade('D1 the answer was lost: the phone resends the SAME key and content → the stored answer, applied once',
  (select (public.producao_registrar('fluxo-0001', pg_temp.itens(array[['bat','bat:mor','12'],['bat','bat:mar','10']])))->>'repetido')::boolean
  and pg_temp.est('lc') = 6 and pg_temp.est('bat') = 22);
select t.verdade('D2 same key, different content: refused (never applies a second, different production)',
  pg_temp.registrar('fluxo-0001', array[['bat','bat:mor','6']]) like 'VANT_CHAVE_CONFLITO|%' and pg_temp.est('bat') = 22);
select t.igual('D3 exactly one production in the history', (select count(*) from public.producao_registros where user_id = pg_temp.id('u')), 1);

-- ---------------------------------------------------------------- 5) missing ingredient
select public.producao_simular(pg_temp.itens(array[['bat','bat:mor','60']])) as sim2 \gset
select t.verdade('F1 preview of 60 morango shows the missing cans (needs 10, has 6)',
  exists (select 1 from jsonb_array_elements((:'sim2'::jsonb)->'faltas') x where x->>'nome' = 'Leite condensado' and (x->>'precisa')::numeric = 10 and (x->>'tem')::numeric = 6));
select t.verdade('F2 registering it is refused and nothing moves',
  pg_temp.registrar('fluxo-0002', array[['bat','bat:mor','60']]) like 'VANT_FALTA_INGREDIENTE|%Leite condensado%'
  and pg_temp.est('lc') = 6 and pg_temp.est('bat') = 22);

-- ---------------------------------------------------------------- 6) sell, then check stock
insert into public.challenge_sessions (id, user_id, date, status, daily_goal) values (gen_random_uuid(), pg_temp.id('u'), t.dia(0), 'active', 100) returning id as sessao \gset
insert into public.defcon_sales (user_id, session_id, amount, method, product_id, qty, variant_id)
values (pg_temp.id('u'), :'sessao', 36, 'pix', pg_temp.id('bat'), 3, pg_temp.id('bat:mor')) returning id as venda \gset
select t.verdade('V1 selling 3 morango: product 22→19, morango 12→9, maracujá untouched',
  pg_temp.est('bat') = 19 and pg_temp.est('bat:mor') = 9 and pg_temp.est('bat:mar') = 10);
select t.verdade('V2 selling does not touch ingredients (batch recipe: they went at production)', pg_temp.est('lc') = 6);

-- ---------------------------------------------------------------- 7) correct and undo
select t.verdade('E1 correction without a reason: refused',
  t.erro(format('select public.producao_corrigir(%L, %L, %L::jsonb, null, null)', pg_temp.registro('fluxo-0001'), 'fluxo-cor-01',
    pg_temp.itens(array[['bat','bat:mor','6'],['bat','bat:mar','10']]))) like 'VANT_MOTIVO_OBRIGATORIO|%');
select t.verdade('E2 correcting morango 12→6 (6 were never made): ok',
  t.erro(format('select public.producao_corrigir(%L, %L, %L::jsonb, null, %L)', pg_temp.registro('fluxo-0001'), 'fluxo-cor-02',
    pg_temp.itens(array[['bat','bat:mor','6'],['bat','bat:mar','10']]), 'contei errado')) = 'ok');
select t.verdade('E3 stock follows: morango 9→3, product 19→13; 1 can and 100+30 g sugar and 300 g strawberry come back',
  pg_temp.est('bat:mor') = 3 and pg_temp.est('bat') = 13 and pg_temp.est('lc') = 7 and pg_temp.est('acucar') = 670 and pg_temp.est('mor') = 1700);
select t.verdade('E4 correcting below what was already sold: refused (morango 6→2 with only 3 left in stock... 3 sold)',
  t.erro(format('select public.producao_corrigir(%L, %L, %L::jsonb, null, %L)', pg_temp.registro('fluxo-0001'), 'fluxo-cor-03',
    pg_temp.itens(array[['bat','bat:mor','2'],['bat','bat:mar','10']]), 'contei errado de novo')) like 'VANT_UNIDADES_VENDIDAS|%'
  and pg_temp.est('bat:mor') = 3);
select t.verdade('E5 undo while 3 of its units were sold: refused, nothing moves',
  t.erro(format('select public.producao_desfazer(%L, %L, %L)', pg_temp.registro('fluxo-0001'), 'fluxo-des-01', 'produção errada')) like 'VANT_UNIDADES_VENDIDAS|%'
  and pg_temp.est('bat') = 13);
delete from public.defcon_sales where id = :'venda';
select t.verdade('E6 the sale is cancelled: the 3 come back to morango and the product', pg_temp.est('bat:mor') = 6 and pg_temp.est('bat') = 16);
select t.verdade('E7 now undo works', t.erro(format('select public.producao_desfazer(%L, %L, %L)', pg_temp.registro('fluxo-0001'), 'fluxo-des-02', 'produção errada')) = 'ok');
select t.verdade('E8 everything is back to the purchase: 10 cans, 1000 g sugar, 2000 g strawberry, 1000 g pulp, 0 units',
  pg_temp.est('lc') = 10 and pg_temp.est('acucar') = 1000 and pg_temp.est('mor') = 2000 and pg_temp.est('mar') = 1000
  and pg_temp.est('bat') = 0 and pg_temp.est('bat:mor') = 0 and pg_temp.est('bat:mar') = 0);
select t.verdade('E9 undoing twice: refused', t.erro(format('select public.producao_desfazer(%L, %L, %L)', pg_temp.registro('fluxo-0001'), 'fluxo-des-03', 'de novo')) like 'VANT_REGISTRO_DESFEITO|%');
select t.verdade('E10 the history keeps all three versions (registro, correção, desfazer)',
  (select array_agg(tipo order by versao) = array['registro', 'correcao', 'desfazer'] from public.producao_eventos where registro_id = pg_temp.registro('fluxo-0001')));
select public.producao_recentes(10) as recentes \gset
select t.verdade('E11 recent list shows it undone, with the items it had (6 morango, 10 maracujá)',
  ((:'recentes'::jsonb)->0->>'status') = 'desfeita' and jsonb_array_length((:'recentes'::jsonb)->0->'itens') = 2);

-- ---------------------------------------------------------------- 8) initial stock per flavour
do $$
declare p uuid;
begin
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (pg_temp.id('u'), 'Geladinho', 'batch', 20, 'faz') returning id into p;
  insert into f values ('gel', p);
end $$;
select public.produto_sabores_salvar(pg_temp.id('gel'), '[{"nome":"Coco"},{"nome":"Uva"}]') is not null as ok2 \gset
insert into f select 'gel:' || lower(name), id from public.product_variants where product_id = pg_temp.id('gel');
select t.verdade('S1 initial stock: 8 coco + 5 uva + 2 without flavour = 15',
  (select (public.produto_estoque_inicial(pg_temp.id('gel'), 2, jsonb_build_array(jsonb_build_object('id', pg_temp.id('gel:coco'), 'unidades', 8), jsonb_build_object('id', pg_temp.id('gel:uva'), 'unidades', 5))))->>'estoque')::int = 15
  and pg_temp.est('gel:coco') = 8 and pg_temp.est('gel:uva') = 5);
insert into public.defcon_sales (user_id, session_id, amount, method, product_id, qty, variant_id) values (pg_temp.id('u'), :'sessao', 3, 'dinheiro', pg_temp.id('gel'), 1, pg_temp.id('gel:uva'));
select t.verdade('S2 after a sale it is not "initial" any more: refused, stock untouched',
  t.erro(format($q$select public.produto_estoque_inicial(%L, 0, '[]'::jsonb)$q$, pg_temp.id('gel'))) like 'VANT_ESTOQUE_JA_MOVIMENTADO|%' and pg_temp.est('gel') = 14);
select t.verdade('S3 another seller cannot set it', t.erro(format($q$select public.produto_estoque_inicial(%L, 1, '[]'::jsonb)$q$, pg_temp.id('bat')), null, gen_random_uuid()) like 'VANT_PRODUTO_INVALIDO|%');
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- 9) resale: the purchase is the stock
do $$
declare p uuid;
begin
  insert into public.products (user_id, name, recipe_mode, origem, sale_price) values (pg_temp.id('u'), 'Água 500 ml', 'none', 'compra', 3) returning id into p;
  insert into f values ('agua', p);
end $$;
select public.mercado_salvar(jsonb_build_array(jsonb_build_object('tipo', 'produto', 'id', pg_temp.id('agua'), 'nome', 'Água', 'qtd', 24, 'preco_unit', 1.25, 'para', '[]'::jsonb)), null, true, 0, null, null) is not null as ok3 \gset
select t.verdade('R1 resale bought: 24 in stock at R$ 1,25 each, no production',
  pg_temp.est('agua') = 24 and (select cost from public.products where id = pg_temp.id('agua')) = 1.25
  and not exists (select 1 from public.production_batches where product_id = pg_temp.id('agua')));
select t.verdade('R2 resale cannot be "produced" in the new flow',
  pg_temp.registrar('fluxo-0003', array[['agua','','5']]) like 'VANT_PRODUTO_SEM_RECEITA|%');

-- ---------------------------------------------------------------- 10) an incomplete recipe keeps a safe way to record stock
do $$
declare p uuid;
begin
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (pg_temp.id('u'), 'Trufa', 'batch', 10, 'faz') returning id into p;
  insert into f values ('trufa', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (pg_temp.id('u'), p, pg_temp.id('lc'), 1), (pg_temp.id('u'), p, pg_temp.id('acucar'), 0);
end $$;
select t.verdade('T1 incomplete (sugar without quantity): stays registered, the new flow asks to complete it',
  pg_temp.registrar('fluxo-0004', array[['trufa','','10']]) like 'VANT_RECEITA_INCOMPLETA|%' and exists (select 1 from public.products where id = pg_temp.id('trufa')));
select t.verdade('T2 ...the current "Produzi" still records it (as today: consumes the lines it knows)',
  t.erro(format('select public.produto_produzir(%L, 10)', pg_temp.id('trufa'))) = 'ok' and pg_temp.est('trufa') = 10 and pg_temp.est('lc') = 9);
update public.product_recipes set quantity = 100 where product_id = pg_temp.id('trufa') and ingredient_id = pg_temp.id('acucar');
select t.verdade('T3 once completed, the new flow produces it', pg_temp.registrar('fluxo-0005', array[['trufa','','10']], 'receita completa agora') = 'ok' and pg_temp.est('trufa') = 20);

-- ---------------------------------------------------------------- 11) a purchase saved BEFORE this change, edited now
do $$
declare c uuid;
begin
  insert into public.mercado_compras (user_id, total, por_item, itens) values (pg_temp.id('u'), 0, true, '[]') returning id into c;
  insert into f values ('compra_antiga', c);
  -- what the old automatic production left: 10 units made "Tô no mercado" from 1 can
  insert into public.production_batches (user_id, product_id, batches_count, units_produced, notes, mercado_compra_id) values (pg_temp.id('u'), pg_temp.id('trufa'), 1, 10, 'Tô no mercado', c);
end $$;
select public.mercado_salvar(jsonb_build_array(jsonb_build_object('tipo', 'ingrediente', 'id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 2, 'preco_unit', 6.5, 'para', '[]'::jsonb)),
  null, true, 0, null, pg_temp.id('compra_antiga')) as editada \gset
select t.verdade('O1 the answer says the automatic production of that purchase was undone (Trufa, 10)',
  ((:'editada'::jsonb)->'producao_desfeita'->0->>'nome') = 'Trufa' and ((:'editada'::jsonb)->'producao_desfeita'->0->>'unidades')::numeric = 10);
select t.verdade('O2 ...and it was not remade', not exists (select 1 from public.production_batches where mercado_compra_id = pg_temp.id('compra_antiga')));

-- ---------------------------------------------------------------- 12) prices: precise, and a recipe edit never overwrites the Mercado price
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0),
  jsonb_build_object('id', pg_temp.id('acucar'), 'nome', 'Açúcar', 'qtd', 100, 'preco', 0)), 10) is not null as ok4 \gset
select t.igual('Q1 editing the recipe with untouched prices (sent as 0) keeps the sugar at the Mercado price', (select cost_per_unit from public.ingredients where id = pg_temp.id('acucar')), 0.03599);
select public.produto_salvar_receita(pg_temp.id('bat'), jsonb_build_array(
  jsonb_build_object('id', pg_temp.id('lc'), 'nome', 'Leite condensado', 'qtd', 1, 'preco', 0),
  jsonb_build_object('id', pg_temp.id('acucar'), 'nome', 'Açúcar', 'qtd', 100, 'preco', 0.03799)), 10) is not null as ok5 \gset
select t.igual('Q2 a price typed by the seller is saved exactly (R$ 37,99 per kg = 0,03799)', (select cost_per_unit from public.ingredients where id = pg_temp.id('acucar')), 0.03799);
select t.verdade('Q3 the recipe save kept the flavour recipes (base only rewritten)',
  (select count(*) from public.product_recipes where product_id = pg_temp.id('bat') and variant_id is not null) = 3);
