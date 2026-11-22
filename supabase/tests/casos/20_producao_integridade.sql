-- Etapa 1 (22/11/2026): producao_registrar / producao_corrigir / producao_desfazer.
-- Fictional seller: a brigadeiro (recipe per batch of 20), a popsicle with two flavours (batch of 10,
-- base milk + flavour extras) and a pastry in 'per_unit' mode (ingredients leave at the sale).
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity::numeric from public.product_variants where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;

do $$
declare u uuid := t.vendedor('Ana Teste'); o uuid := t.vendedor('Outro Teste'); p uuid; v uuid; g uuid;
begin
  insert into f values ('u', u), ('o', o);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values
    (u, 'Leite condensado', 'lata', 5, 7), (u, 'Chocolate', 'g', 500, 0.05), (u, 'Leite', 'L', 3, 5),
    (u, 'Morango', 'g', 1000, 0.03), (u, 'Coco', 'g', 500, 0.04), (u, 'Farinha', 'kg', 10, 6);
  insert into f select 'i:' || name, id from public.ingredients where user_id = u;

  insert into public.products (user_id, name, recipe_mode, batch_yield, cost, sale_price) values (u, 'Brigadeiro', 'batch', 20, 1, 3) returning id into p;
  insert into f values ('brig', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values
    (u, p, pg_temp.id('i:Leite condensado'), 1), (u, p, pg_temp.id('i:Chocolate'), 50);

  insert into public.products (user_id, name, recipe_mode, batch_yield, cost, sale_price) values (u, 'Geladinho', 'batch', 10, 1, 4) returning id into p;
  insert into f values ('gel', p);
  insert into public.product_variants (user_id, product_id, name, posicao) values (u, p, 'Morango', 1) returning id into v;
  insert into f values ('gel:morango', v);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, pg_temp.id('i:Morango'), 200, v);
  insert into public.product_variants (user_id, product_id, name, posicao) values (u, p, 'Coco', 2) returning id into v;
  insert into f values ('gel:coco', v);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, pg_temp.id('i:Coco'), 100, v);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, pg_temp.id('i:Leite'), 1);

  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Salgado', 'per_unit', 0) returning id into p;
  insert into f values ('salg', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, pg_temp.id('i:Farinha'), 0.1);

  insert into public.products (user_id, name, recipe_mode, batch_yield) values (o, 'Produto do outro', 'batch', 1) returning id into p;
  insert into f values ('outro', p);
  insert into public.ingredients (user_id, name, stock_quantity) values (o, 'Ingrediente do outro', 9) returning id into g;
  insert into f values ('i:outro', g);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (o, p, g, 1);
end $$;

select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- 1. several products and flavours, one transaction
create temp table r1 as select public.producao_registrar('teste-reg-0001', jsonb_build_array(
  jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 40),
  jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:morango'), 'unidades', 10),
  jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:coco'), 'unidades', 20),
  jsonb_build_object('produto', pg_temp.id('salg'), 'unidades', 15)), null, 'primeira leva') as r;
insert into f select 'reg1', (r->>'registro_id')::uuid from r1;

select t.igual('1 multi: Brigadeiro +40', pg_temp.est('brig'), 40);
select t.igual('1 multi: Geladinho +30 (both flavours)', pg_temp.est('gel'), 30);
select t.igual('1 multi: flavour Morango +10', pg_temp.est('gel:morango'), 10);
select t.igual('1 multi: flavour Coco +20', pg_temp.est('gel:coco'), 20);
select t.igual('1 multi: Salgado +15', pg_temp.est('salg'), 15);
select t.igual('1 recipe: condensed milk 2 batches x 1 = -2', pg_temp.est('i:Leite condensado'), 3);
select t.igual('1 recipe: chocolate 2 batches x 50 = -100', pg_temp.est('i:Chocolate'), 400);
select t.igual('1 recipe: milk base by the TOTAL of flavours (30/10 x 1) = -3, exactly to zero', pg_temp.est('i:Leite'), 0);
select t.igual('1 recipe: strawberry extra 10/10 x 200 = -200', pg_temp.est('i:Morango'), 800);
select t.igual('1 recipe: coconut extra 20/10 x 100 = -200', pg_temp.est('i:Coco'), 300);
select t.igual('1 per_unit: production takes no flour (the sale does)', pg_temp.est('i:Farinha'), 10);
select t.verdade('1 per_unit: answer warns that Salgado takes ingredients at the sale',
  (select r->'avisos' ? 'Salgado: baixa os ingredientes na venda, não na produção.' from r1));
select t.igual('1 history: 5 consumption rows', (select count(*) from public.producao_consumos where registro_id = pg_temp.id('reg1')), 5);
select t.igual('1 history: 4 item rows', (select count(*) from public.producao_itens where registro_id = pg_temp.id('reg1')), 4);
select t.igual('1 ledger: 10 movements (3 products, 2 flavours, 5 ingredients)', (select count(*) from public.producao_movimentos where registro_id = pg_temp.id('reg1')), 10);
select t.verdade('1 ledger: every movement has depois = antes + delta', not exists (select 1 from public.producao_movimentos where depois <> antes + delta));
select t.verdade('1 costs: product costs untouched', (select bool_and(cost = 1) from public.products where id in (pg_temp.id('brig'), pg_temp.id('gel'))));
select t.verdade('1 costs: ingredient costs untouched', (select cost_per_unit = 7 from public.ingredients where id = pg_temp.id('i:Leite condensado')));

-- ---------------------------------------------------------------- 2. missing ingredient blocks everything
select t.verdade('2 falta: specific message with what is needed and what there is',
  t.erro($$select public.producao_registrar('teste-reg-0002', jsonb_build_array(
     jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 20),
     jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:morango'), 'unidades', 10)))$$)
  = 'VANT_FALTA_INGREDIENTE|Falta ingrediente: Leite (precisa 1 L, tem 0 L).');
select t.igual('2 rollback: the brigadeiro of the same call was not produced', pg_temp.est('brig'), 40);
select t.igual('2 rollback: its condensed milk was not taken', pg_temp.est('i:Leite condensado'), 3);
select t.igual('2 rollback: no registro left behind', (select count(*) from public.producao_registros), 1);
select t.igual('2 rollback: no event left behind', (select count(*) from public.producao_eventos), 1);
select t.verdade('2 falta: lists every missing ingredient at once',
  t.erro($$select public.producao_registrar('teste-reg-0003', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 200)))$$)
  = 'VANT_FALTA_INGREDIENTE|Falta ingrediente: Chocolate (precisa 500 g, tem 400 g); Leite condensado (precisa 10 lata, tem 3 lata).'
  or t.erro($$select public.producao_registrar('teste-reg-0003', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 200)))$$)
  = 'VANT_FALTA_INGREDIENTE|Falta ingrediente: Leite condensado (precisa 10 lata, tem 3 lata); Chocolate (precisa 500 g, tem 400 g).');

-- ---------------------------------------------------------------- 3. idempotency
create temp table r1b as select public.producao_registrar('teste-reg-0001', jsonb_build_array(
  jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 40),
  jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:morango'), 'unidades', 10),
  jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:coco'), 'unidades', 20),
  jsonb_build_object('produto', pg_temp.id('salg'), 'unidades', 15)), null, 'primeira leva') as r;
select t.verdade('3 resend after a lost answer: repetido = true', (select (r->>'repetido')::boolean from r1b));
select t.verdade('3 resend: same registro', (select r->>'registro_id' from r1b) = pg_temp.id('reg1')::text);
select t.igual('3 resend: stock not added twice', pg_temp.est('brig'), 40);
select t.igual('3 resend: ingredient not taken twice', pg_temp.est('i:Chocolate'), 400);
select t.igual('3 resend: still one event', (select count(*) from public.producao_eventos), 1);
select t.verdade('3 same key, other content: refused',
  t.erro($$select public.producao_registrar('teste-reg-0001', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 41)))$$)
  like 'VANT_CHAVE_CONFLITO|%');
select t.verdade('3 keys are per seller: another seller may use the same key',
  t.erro($$select public.producao_registrar('teste-reg-0001', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('outro'), 'unidades', 1)))$$, null, pg_temp.id('o')) = 'ok');
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- 4. real consumption typed by the seller
create temp table r4 as select public.producao_registrar('teste-reg-0004',
  jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 20)),
  jsonb_build_array(jsonb_build_object('ingrediente', pg_temp.id('i:Chocolate'), 'quantidade', 70)), null, 'chocolate grudou na panela') as r;
insert into f select 'reg4', (r->>'registro_id')::uuid from r4;
select t.igual('4 real: chocolate takes the typed 70, not the recipe 50', pg_temp.est('i:Chocolate'), 330);
select t.igual('4 real: condensed milk follows the recipe (1 batch)', pg_temp.est('i:Leite condensado'), 2);
select t.verdade('4 history keeps recipe 50 and real 70 side by side',
  exists (select 1 from public.producao_consumos where registro_id = pg_temp.id('reg4') and ingredient_id = pg_temp.id('i:Chocolate') and quantidade_receita = 50 and quantidade_real = 70));

-- ---------------------------------------------------------------- 5. correction (20 -> 10, recipe consumption)
create temp table r5 as select public.producao_corrigir(pg_temp.id('reg4'), 'teste-cor-0005',
  jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 10)), null, 'contei errado') as r;
select t.igual('5 correction: brigadeiro 60 -> 50', pg_temp.est('brig'), 50);
select t.igual('5 correction: condensed milk gets back 1 - 0,5', pg_temp.est('i:Leite condensado'), 2.5);
select t.igual('5 correction: chocolate gets back the REAL 70 minus the new 25', pg_temp.est('i:Chocolate'), 375);
select t.verdade('5 correction: registro is version 2, status corrigida',
  (select status = 'corrigida' and versao = 2 from public.producao_registros where id = pg_temp.id('reg4')));
select t.verdade('5 correction: event stores the reason',
  exists (select 1 from public.producao_eventos where registro_id = pg_temp.id('reg4') and tipo = 'correcao' and motivo = 'contei errado'));
select t.verdade('5 correction: version 1 consumption is still there (real 70)',
  exists (select 1 from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id
           where e.registro_id = pg_temp.id('reg4') and e.versao = 1 and c.quantidade_real = 70));
select t.verdade('5 correction without a reason: refused',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg4'), 'teste-cor-0006', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 9)))$$)
  like 'VANT_MOTIVO_OBRIGATORIO|%');
select t.verdade('5 correction equal to the current one: refused',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg4'), 'teste-cor-0007', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 10)), null, 'nada')$$)
  like 'VANT_SEM_MUDANCA|%');
select t.verdade('5 correction that needs more than the stock: refused with the missing ingredient',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg4'), 'teste-cor-0008', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 200)), null, 'mais')$$)
  like 'VANT_FALTA_INGREDIENTE|Falta ingrediente:%Leite condensado (precisa 9,5 lata, tem 2,5 lata)%');
select t.igual('5 refused correction moved nothing', pg_temp.est('brig'), 50);
select t.verdade('5 refused correction kept version 2', (select versao = 2 from public.producao_registros where id = pg_temp.id('reg4')));

-- ---------------------------------------------------------------- 6. undo returns what was STORED, not today's recipe
update public.product_recipes set quantity = 999 where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('i:Chocolate');
create temp table r6 as select public.producao_desfazer(pg_temp.id('reg4'), 'teste-des-0009', 'produção de teste') as r;
select t.igual('6 undo: brigadeiro 50 -> 40', pg_temp.est('brig'), 40);
select t.igual('6 undo: chocolate gets back the stored 25 (recipe is 999 now)', pg_temp.est('i:Chocolate'), 400);
select t.igual('6 undo: condensed milk back to 3', pg_temp.est('i:Leite condensado'), 3);
select t.verdade('6 undo: ledger of the registro adds up to zero on every item',
  not exists (select 1 from public.producao_movimentos where registro_id = pg_temp.id('reg4') group by alvo, alvo_id having sum(delta) <> 0));
select t.verdade('6 undo: status desfeita, version 3', (select status = 'desfeita' and versao = 3 from public.producao_registros where id = pg_temp.id('reg4')));
select t.verdade('6 undo resent with the same key: repetido',
  (select (public.producao_desfazer(pg_temp.id('reg4'), 'teste-des-0009', 'produção de teste')->>'repetido')::boolean));
select t.igual('6 undo resent: stock untouched', pg_temp.est('brig'), 40);
select t.verdade('6 undo twice (new key): refused', t.erro($$select public.producao_desfazer(pg_temp.id('reg4'), 'teste-des-0010', 'de novo')$$) like 'VANT_REGISTRO_DESFEITO|%');
select t.verdade('6 correcting an undone production: refused',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg4'), 'teste-cor-0011', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 5)), null, 'recontei')$$) like 'VANT_REGISTRO_DESFEITO|%');
update public.product_recipes set quantity = 50 where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('i:Chocolate');

-- ---------------------------------------------------------------- 7. units already sold
-- 35 brigadeiros sold (the sale trigger lowers products.stock_quantity; simulated directly here).
update public.products set stock_quantity = 5 where id = pg_temp.id('brig');
select t.verdade('7 undo after selling: refused, says what is left',
  t.erro($$select public.producao_desfazer(pg_temp.id('reg1'), 'teste-des-0012', 'teste')$$)
  = 'VANT_UNIDADES_VENDIDAS|Essas unidades já foram vendidas ou saíram do estoque: Brigadeiro (precisa tirar 40, só restam 5 no estoque).');
select t.verdade('7 correction below what was sold: refused',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg1'), 'teste-cor-0013', jsonb_build_array(
     jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 30),
     jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:morango'), 'unidades', 10),
     jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:coco'), 'unidades', 20),
     jsonb_build_object('produto', pg_temp.id('salg'), 'unidades', 15)), null, 'teste')$$) like 'VANT_UNIDADES_VENDIDAS|%Brigadeiro (precisa tirar 10, só restam 5%');
select t.igual('7 refused: brigadeiro stays 5', pg_temp.est('brig'), 5);
select t.igual('7 refused: geladinho stays 30', pg_temp.est('gel'), 30);
select t.igual('7 refused: milk stays 0', pg_temp.est('i:Leite'), 0);
select t.verdade('7 refused: registro 1 still active v1', (select status = 'ativa' and versao = 1 from public.producao_registros where id = pg_temp.id('reg1')));
-- a flavour sold out is protected the same way
update public.product_variants set stock_quantity = 2 where id = pg_temp.id('gel:coco');
select t.verdade('7 flavour sold: refused by flavour name',
  t.erro($$select public.producao_corrigir(pg_temp.id('reg1'), 'teste-cor-0014', jsonb_build_array(
     jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 40),
     jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:morango'), 'unidades', 10),
     jsonb_build_object('produto', pg_temp.id('gel'), 'sabor', pg_temp.id('gel:coco'), 'unidades', 10),
     jsonb_build_object('produto', pg_temp.id('salg'), 'unidades', 15)), null, 'teste')$$) like 'VANT_UNIDADES_VENDIDAS|%Geladinho Coco (precisa tirar 10, só restam 2%');

-- ---------------------------------------------------------------- 8. validation
select set_config('request.jwt.claim.sub', '', false);
select t.verdade('8 not logged in: refused', t.erro($$select public.producao_registrar('teste-reg-0015', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 1)))$$) like 'VANT_LOGIN|%');
select t.logar(pg_temp.id('u'));
select t.verdade('8 fractional units: refused', t.erro($$select public.producao_registrar('teste-reg-0016', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 1.5)))$$) like 'VANT_UNIDADES_INVALIDAS|%');
select t.verdade('8 zero units: refused', t.erro($$select public.producao_registrar('teste-reg-0017', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 0)))$$) like 'VANT_UNIDADES_INVALIDAS|%');
select t.verdade('8 another seller''s product: refused', t.erro($$select public.producao_registrar('teste-reg-0018', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('outro'), 'unidades', 1)))$$) like 'VANT_PRODUTO_INVALIDO|%');
select t.verdade('8 flavour of another product: refused', t.erro($$select public.producao_registrar('teste-reg-0019', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'sabor', pg_temp.id('gel:coco'), 'unidades', 1)))$$) like 'VANT_SABOR_INVALIDO|%');
select t.verdade('8 another seller''s ingredient in the typed consumption: refused', t.erro($$select public.producao_registrar('teste-reg-0020', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 1)), jsonb_build_array(jsonb_build_object('ingrediente', pg_temp.id('i:outro'), 'quantidade', 1)))$$) like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('8 empty list: refused', t.erro($$select public.producao_registrar('teste-reg-0021', '[]'::jsonb)$$) like 'VANT_ITENS_INVALIDOS|%');
select t.verdade('8 short key: refused', t.erro($$select public.producao_registrar('abc', jsonb_build_array(jsonb_build_object('produto', pg_temp.id('brig'), 'unidades', 1)))$$) like 'VANT_CHAVE_INVALIDA|%');
select t.verdade('8 another seller''s registro: not found', t.erro(format($$select public.producao_desfazer(%L, 'teste-des-0022', 'teste')$$, pg_temp.id('reg1')), null, pg_temp.id('o')) like 'VANT_REGISTRO_INVALIDO|%');
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- 9. immutable history
select t.verdade('9 consumption cannot be edited', t.erro($$update public.producao_consumos set quantidade_real = 0$$) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('9 events cannot be deleted', t.erro($$delete from public.producao_eventos$$) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('9 ledger cannot be truncated', t.erro($$truncate public.producao_movimentos cascade$$) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('9 registro status cannot be edited by hand', t.erro(format($$update public.producao_registros set status = 'ativa' where id = %L$$, pg_temp.id('reg4'))) like 'VANT_HISTORICO_IMUTAVEL|%');

-- ---------------------------------------------------------------- 10. access
select t.igual('10 anon cannot read the history', t.linhas_como('anon', pg_temp.id('u'), 'select 1 from public.producao_eventos'), -1);
select t.igual('10 the owner reads only his own events', t.linhas_como('authenticated', pg_temp.id('o'), 'select 1 from public.producao_eventos'), 1);
select t.verdade('10 the app cannot write history directly',
  t.erro($$insert into public.producao_registros (user_id) values (auth.uid())$$, 'authenticated', pg_temp.id('u')) = '42501|permission denied for table producao_registros');
select t.verdade('10 anon cannot call the functions',
  t.erro($$select public.producao_registrar('teste-reg-0023', '[]'::jsonb)$$, 'anon', pg_temp.id('u')) like '42501|%');
select t.verdade('10 the app cannot call the internal helper that moves stock',
  t.erro($$select public.producao_aplicar(auth.uid(), gen_random_uuid(), gen_random_uuid(), '[]')$$, 'authenticated', pg_temp.id('u')) like '42501|%');

-- ---------------------------------------------------------------- 11. existing behaviour kept
select t.verdade('11 deleting a product still works (no FK from the history)', t.erro(format($$delete from public.products where id = %L$$, pg_temp.id('salg'))) = 'ok');
select t.verdade('11 history keeps the deleted product''s name', exists (select 1 from public.producao_itens where product_id = pg_temp.id('salg') and produto_nome = 'Salgado'));
select t.verdade('11 undoing a production of a deleted product: specific refusal',
  t.erro($$select public.producao_desfazer(pg_temp.id('reg1'), 'teste-des-0024', 'teste')$$) like 'VANT_ITEM_APAGADO|%');
