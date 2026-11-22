-- Etapa 1 (22/11/2026): a recipe edited to consume less cannot silently bypass the production
-- checks. Edits stay free; every one is logged, and the next production after a REDUCTION asks for
-- a justification once. Recipe edits change no cost, price or stock.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.produzir(p_chave text, p_unidades int, p_just text default null) returns text language sql as $$
  select t.erro(format($q$select public.producao_registrar(%L, jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', %s)), null, null, %L)$q$,
    p_chave, pg_temp.id('brig'), p_unidades, p_just))
$$;
create or replace function pg_temp.log(p_reduz boolean default null) returns numeric language sql as $$
  select count(*) from public.receita_alteracoes where product_id = pg_temp.id('brig') and (p_reduz is null or reduz = p_reduz)
$$;

do $$
declare u uuid := t.vendedor('Receita Teste'); p uuid; v uuid; g uuid; h uuid; x uuid; a uuid;
begin
  insert into f values ('u', u);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Leite condensado', 'lata', 1000) returning id into g;
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Chocolate', 'g', 100000) returning id into h;
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Granulado', 'g', 100000) returning id into x;
  insert into f values ('lc', g), ('choc', h), ('gran', x);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Açúcar', 'g', 100000) returning id into a;
  insert into f values ('acucar', a);
  insert into public.products (user_id, name, recipe_mode, batch_yield, cost, sale_price) values (u, 'Brigadeiro', 'batch', 20, 1.5, 3) returning id into p;
  insert into f values ('brig', p);
  insert into public.product_variants (user_id, product_id, name) values (u, p, 'Branco') returning id into v;
  insert into f values ('brig:branco', v);
  perform t.logar(u);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1), (u, p, h, 50);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, x, 10, v);
end $$;
select t.logar(pg_temp.id('u'));

-- ---------------------------------------------------------------- logging
select t.igual('R1 creating the recipe is logged (3 rows), not as a reduction', pg_temp.log(false), 3);
select t.verdade('R1 the log says who changed it', (select bool_and(por = pg_temp.id('u')) from public.receita_alteracoes));
select t.verdade('R1 first production: no reduction, no justification needed', pg_temp.produzir('rec-00001', 20) = 'ok');
select t.verdade('R1 production records the recipe version it used',
  (select (receita_versoes->>pg_temp.id('brig')::text)::bigint = (select max(id) from public.receita_alteracoes) from public.producao_eventos where chave = 'rec-00001'));
select t.igual('R1 production itself writes no recipe log (stock/flag updates are not recipe changes)', pg_temp.log(), 3);

-- ---------------------------------------------------------------- the bypass: zero the recipe, then produce
update public.product_recipes set quantity = 0 where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('choc');
select t.verdade('R2 setting an ingredient to zero is logged as a reduction (50 -> 0)',
  exists (select 1 from public.receita_alteracoes where ingredient_id = pg_temp.id('choc') and operacao = 'alterou' and antes = '50' and depois = '0' and reduz));
select t.verdade('R2 next production without a reason: refused, names the product',
  pg_temp.produzir('rec-00002', 20) like 'VANT_RECEITA_REDUZIDA|%Brigadeiro%');
select t.igual('R2 refused production moved nothing', (select stock_quantity from public.products where id = pg_temp.id('brig')), 20);
select t.verdade('R2 with a reason: accepted', pg_temp.produzir('rec-00003', 20, 'chocolate saiu da receita, agora é só leite') = 'ok');
select t.verdade('R2 the event is flagged and keeps the reason',
  (select receita_reduzida and justificativa_consumo = 'chocolate saiu da receita, agora é só leite' from public.producao_eventos where chave = 'rec-00003'));
select t.verdade('R2 the consumption history shows the recipe as it was used (no chocolate line)',
  not exists (select 1 from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id where e.chave = 'rec-00003' and c.ingredient_id = pg_temp.id('choc')));
select t.verdade('R3 asked once: the following production needs no reason', pg_temp.produzir('rec-00004', 20) = 'ok');

-- ---------------------------------------------------------------- every kind of reduction
delete from public.product_recipes where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('lc');
select t.verdade('R4 removing an ingredient: reduction, logged with the old amount',
  exists (select 1 from public.receita_alteracoes where ingredient_id = pg_temp.id('lc') and operacao = 'removeu' and antes = '1' and reduz));
-- chocolate is already 0 (R2), so with the milk gone the base recipe consumes nothing: an empty
-- recipe cannot produce at all, with or without a reason (case 27)
select t.verdade('R4 ...the base recipe is now empty: refused as incomplete, a reason does not open it',
  pg_temp.produzir('rec-00005', 20) like 'VANT_RECEITA_INCOMPLETA|%' and pg_temp.produzir('rec-00005b', 20, 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%');
insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (pg_temp.id('u'), pg_temp.id('brig'), pg_temp.id('lc'), 1);
update public.product_recipes set quantity = 60 where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('choc');
select t.verdade('R4 putting it back is logged but is not a reduction... the earlier removal still needs a reason once',
  pg_temp.produzir('rec-00006', 20) like 'VANT_RECEITA_REDUZIDA|%');
select t.verdade('R4 reason given', pg_temp.produzir('rec-00007', 20, 'leite voltou para a receita') = 'ok');
select t.verdade('R9 adding an ingredient back is logged, not as a reduction',
  exists (select 1 from public.receita_alteracoes where ingredient_id = pg_temp.id('lc') and operacao = 'incluiu' and depois = '1' and not reduz and em > (select max(em) from public.receita_alteracoes where operacao = 'removeu')));
select t.verdade('R9 raising an amount (0 -> 60) is logged, not as a reduction',
  exists (select 1 from public.receita_alteracoes where ingredient_id = pg_temp.id('choc') and antes = '0' and depois = '60' and not reduz));

update public.products set batch_yield = 40 where id = pg_temp.id('brig');
select t.verdade('R5 more units per batch: reduction', exists (select 1 from public.receita_alteracoes where campo = 'rendimento' and antes = '20' and depois = '40' and reduz));
select t.verdade('R5 ...asks for a reason', pg_temp.produzir('rec-00008', 20) like 'VANT_RECEITA_REDUZIDA|%');
select t.verdade('R5 reason given', pg_temp.produzir('rec-00009', 20, 'nova forma rende o dobro') = 'ok');
update public.products set batch_yield = 20 where id = pg_temp.id('brig');
select t.verdade('R5 fewer units per batch (consumes more): no reason needed', pg_temp.produzir('rec-00010', 20) = 'ok');

update public.products set recipe_mode = 'per_unit' where id = pg_temp.id('brig');
select t.verdade('R6 leaving batch mode: reduction', exists (select 1 from public.receita_alteracoes where campo = 'modo' and antes = 'batch' and depois = 'per_unit' and reduz));
update public.products set recipe_mode = 'batch' where id = pg_temp.id('brig');
select t.verdade('R6 back to batch is not a reduction, but the earlier one still asks once', pg_temp.produzir('rec-00011', 20) like 'VANT_RECEITA_REDUZIDA|%');
select t.verdade('R6 reason given', pg_temp.produzir('rec-00012', 20, 'testei vender por unidade') = 'ok');

update public.product_recipes set quantity = 1 where variant_id = pg_temp.id('brig:branco');
select t.verdade('R7 lowering a flavour extra: reduction of the product', exists (select 1 from public.receita_alteracoes where variant_id = pg_temp.id('brig:branco') and antes = '10' and depois = '1' and reduz));
select t.verdade('R7 ...asks for a reason', pg_temp.produzir('rec-00013', 20) like 'VANT_RECEITA_REDUZIDA|%');
select t.verdade('R7 reason given', pg_temp.produzir('rec-00014', 20, 'menos granulado no branco') = 'ok');

update public.product_recipes set ingredient_id = pg_temp.id('acucar') where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('lc');
select t.verdade('R8 swapping an ingredient: reduction (the old one left the recipe)',
  exists (select 1 from public.receita_alteracoes where ingredient_id = pg_temp.id('lc') and operacao = 'alterou' and reduz));
select t.verdade('R8 a correction also counts: its mandatory reason covers it',
  t.erro(format($q$select public.producao_corrigir(%L, 'rec-cor-0001', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 21)), null, 'troquei o leite pelo açúcar')$q$,
    (select registro_id from public.producao_eventos where chave = 'rec-00014'), pg_temp.id('brig'))) = 'ok');
select t.verdade('R8 the correction event is flagged', (select receita_reduzida from public.producao_eventos where chave = 'rec-cor-0001'));

-- ---------------------------------------------------------------- recipe edits change nothing else
select t.verdade('R10 product cost and price untouched by any of it', (select cost = 1.5 and sale_price = 3 from public.products where id = pg_temp.id('brig')));
update public.products set stock_quantity = stock_quantity + 1, name = 'Brigadeiro gourmet' where id = pg_temp.id('brig');
select t.igual('R10 other product updates (stock, name) write no log: still the 4 yield/mode changes', (select count(*) from public.receita_alteracoes where campo in ('rendimento', 'modo')), 4);
do $$
declare o uuid := gen_random_uuid(); p uuid;
begin  -- an orphan product (its user no longer exists): 4 exist in production
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (o, 'Órfão', 'batch', 1) returning id into p;
  insert into f values ('orfao', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (o, p, gen_random_uuid(), 1);
  update public.products set batch_yield = 2 where id = p;
end $$;
select t.verdade('R10 editing an orphan product still works and is not logged (no failure path)',
  (select batch_yield = 2 from public.products where id = pg_temp.id('orfao')) and not exists (select 1 from public.receita_alteracoes where product_id = pg_temp.id('orfao')));

-- ---------------------------------------------------------------- the log itself
select t.verdade('R11 the log cannot be edited', t.erro($$update public.receita_alteracoes set reduz = false$$) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('R11 the log cannot be deleted', t.erro($$delete from public.receita_alteracoes$$) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('R11 the app cannot write it directly',
  t.erro(format($q$insert into public.receita_alteracoes (user_id, product_id, campo, operacao, reduz) values (%L, %L, 'modo', 'alterou', false)$q$, pg_temp.id('u'), pg_temp.id('brig')), 'authenticated', pg_temp.id('u')) like '42501|%');
select t.verdade('R11 the owner reads it', t.linhas_como('authenticated', pg_temp.id('u'), 'select 1 from public.receita_alteracoes') > 0);
select t.igual('R11 another seller does not', t.linhas_como('authenticated', gen_random_uuid(), 'select 1 from public.receita_alteracoes'), 0);
select t.verdade('R12 the account can be deleted', t.erro(format('delete from auth.users where id = %L', pg_temp.id('u'))) = 'ok');
select t.verdade('R12 ...and its recipe log went with it', not exists (select 1 from public.receita_alteracoes where user_id = pg_temp.id('u')));
