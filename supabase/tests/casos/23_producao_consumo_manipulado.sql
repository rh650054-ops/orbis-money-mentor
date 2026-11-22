-- Etapa 1 review (22/11/2026): attempts to produce goods without the ingredients by manipulating
-- the typed consumption (p_consumo). Every attack must be refused and move nothing.
-- Fixture: stock is exactly ONE batch of brigadeiro (20 units = 1 can + 50 g).
create temp table f (k text primary key, id uuid);
create temp table f2 (k text primary key, v numeric);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity::numeric from public.product_variants where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
-- A production of brigadeiros with a typed consumption (jsonb text) and an optional justification.
create or replace function pg_temp.brig(p_chave text, p_unidades int, p_consumo text, p_just text default null) returns text language sql as $$
  select t.erro(format($q$select public.producao_registrar(%L, jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', %s)), %L::jsonb, null, %L)$q$,
    p_chave, pg_temp.id('brig'), p_unidades, coalesce(p_consumo, 'null'), p_just))
$$;
create or replace function pg_temp.c(p_ing text, p_qtd text) returns text language sql as $$
  select format('{"ingrediente": "%s", "quantidade": %s}', pg_temp.id(p_ing), p_qtd)
$$;
create or replace function pg_temp.nada_mudou() returns boolean language sql as $$
  select pg_temp.est('brig') = (select v from f2 where k = 'brig') and pg_temp.est('lc') = (select v from f2 where k = 'lc')
     and pg_temp.est('choc') = (select v from f2 where k = 'choc')
     and (select count(*) from public.producao_eventos) = (select v from f2 where k = 'eventos')
$$;
create or replace function pg_temp.foto() returns void language sql as $$
  delete from f2;
  insert into f2 values ('brig', pg_temp.est('brig')), ('lc', pg_temp.est('lc')), ('choc', pg_temp.est('choc')),
                        ('eventos', (select count(*) from public.producao_eventos));
$$;

do $$
declare u uuid := t.vendedor('Consumo Teste'); p uuid; v uuid; g uuid; h uuid; x uuid;
begin
  insert into f values ('u', u);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Leite condensado', 'lata', 1) returning id into g;
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Chocolate', 'g', 50) returning id into h;
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Granulado', 'g', 1000) returning id into x;
  insert into f values ('lc', g), ('choc', h), ('gran', x);
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Brigadeiro', 'batch', 20) returning id into p;
  insert into f values ('brig', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1), (u, p, h, 50);
  -- a recipe the seller never gave a yield to: today the old functions produce it with no ingredient
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Farinha', 'kg', 0) returning id into g;
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Bolo', 'batch', 0) returning id into p;
  insert into f values ('bolo', p), ('farinha', g);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
  -- popsicle with a flavour whose extra is the only ingredient
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Polpa', 'g', 0) returning id into g;
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Geladinho', 'batch', 10) returning id into p;
  insert into public.product_variants (user_id, product_id, name) values (u, p, 'Uva') returning id into v;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, g, 100, v);
  insert into f values ('gel', p), ('gel:uva', v), ('polpa', g);
end $$;
select t.logar(pg_temp.id('u'));
select pg_temp.foto();

-- ---------------------------------------------------------------- attacks: produce 200 with stock for 20
select t.verdade('A1 consumption zero for every ingredient: refused',
  pg_temp.brig('ataque-0001', 200, '[' || pg_temp.c('lc', '0') || ',' || pg_temp.c('choc', '0') || ']', 'sobrou de ontem') like 'VANT_CONSUMO_ABAIXO_DO_MINIMO|%');
select t.verdade('A1 nothing moved', pg_temp.nada_mudou());
select t.verdade('A2 consumption = exactly what is in stock (10% of the recipe): refused',
  pg_temp.brig('ataque-0002', 200, '[' || pg_temp.c('lc', '1') || ',' || pg_temp.c('choc', '50') || ']', 'rendeu muito') like 'VANT_CONSUMO_ABAIXO_DO_MINIMO|%Leite condensado (receita 10 lata, mínimo 9 lata, informado 1 lata)%');
select t.verdade('A2 nothing moved', pg_temp.nada_mudou());
select t.verdade('A3 omitting an ingredient does not exempt it (the recipe applies): refused for missing stock',
  pg_temp.brig('ataque-0003', 40, '[' || pg_temp.c('choc', '100') || ']') like 'VANT_FALTA_INGREDIENTE|%Leite condensado%');
select t.verdade('A4 empty consumption list = the recipe: refused for missing stock',
  pg_temp.brig('ataque-0004', 40, '[]') like 'VANT_FALTA_INGREDIENTE|%');
select t.verdade('A5 null quantity: refused', pg_temp.brig('ataque-0005', 20, '[{"ingrediente": "' || pg_temp.id('lc') || '", "quantidade": null}]') like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('A5 negative quantity: refused', pg_temp.brig('ataque-0006', 20, '[' || pg_temp.c('lc', '-1') || ']') like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('A5 quantity as text: refused', pg_temp.brig('ataque-0007', 20, '[' || pg_temp.c('lc', '"0"') || ']') like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('A5 consumption as an object: refused', pg_temp.brig('ataque-0008', 20, '{"x": 1}') like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('A5 same ingredient twice (0 then the recipe): refused',
  pg_temp.brig('ataque-0009', 20, '[' || pg_temp.c('lc', '0') || ',' || pg_temp.c('lc', '1') || ']') like 'VANT_CONSUMO_INVALIDO|%');
select t.verdade('A1-A5 nothing moved', pg_temp.nada_mudou());
select t.verdade('A6 recipe without yield: refused instead of producing with no ingredient',
  t.erro(format($q$select public.producao_registrar('ataque-0010', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 50)))$q$, pg_temp.id('bolo')))
  like 'VANT_RECEITA_SEM_RENDIMENTO|%Bolo%');
select t.igual('A6 no cake produced', pg_temp.est('bolo'), 0);
select t.verdade('A7 flavour extra set to zero: refused',
  t.erro(format($q$select public.producao_registrar('ataque-0011', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'sabor', %L::uuid, 'unidades', 10)), jsonb_build_array(jsonb_build_object('ingrediente', %L::uuid, 'quantidade', 0)), null, 'sem polpa')$q$,
    pg_temp.id('gel'), pg_temp.id('gel:uva'), pg_temp.id('polpa'))) like 'VANT_CONSUMO_ABAIXO_DO_MINIMO|%Polpa%');
select t.igual('A7 no popsicle produced', pg_temp.est('gel'), 0);

-- ---------------------------------------------------------------- legitimate real consumption, with rules
select t.verdade('B1 within tolerance but without a justification: refused',
  pg_temp.brig('real-0001', 20, '[' || pg_temp.c('choc', '45') || ']') like 'VANT_JUSTIFICATIVA_OBRIGATORIA|%');
select t.verdade('B1 a justification of one letter: refused',
  pg_temp.brig('real-0002', 20, '[' || pg_temp.c('choc', '45') || ']', 'x') like 'VANT_JUSTIFICATIVA_OBRIGATORIA|%');
select t.verdade('B2 exactly the 10% floor (45 of 50 g) with a reason: accepted',
  pg_temp.brig('real-0003', 20, '[' || pg_temp.c('choc', '45') || ']', 'raspei a panela, sobrou chocolate') = 'ok');
select t.igual('B2 chocolate 50 - 45', pg_temp.est('choc'), 5);
select t.igual('B2 condensed milk follows the recipe', pg_temp.est('lc'), 0);
select t.verdade('B2 history: recipe 50, real 45 and the reason are kept',
  exists (select 1 from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id
           where c.ingredient_id = pg_temp.id('choc') and c.quantidade_receita = 50 and c.quantidade_real = 45
             and e.consumo_ajustado and e.justificativa_consumo = 'raspei a panela, sobrou chocolate'));
select t.verdade('B2 history: a recipe-exact ingredient is not flagged as adjusted',
  exists (select 1 from public.producao_consumos where ingredient_id = pg_temp.id('lc') and quantidade_receita = quantidade_real));
select t.verdade('B2 answer lists the adjustment',
  (select e.resposta->'ajustes' @> jsonb_build_array(jsonb_build_object('nome', 'Chocolate', 'receita', 50, 'real', 45))
     from public.producao_eventos e where e.chave = 'real-0003'));
select t.verdade('B3 resend with another justification: refused (same key, other content)',
  pg_temp.brig('real-0003', 20, '[' || pg_temp.c('choc', '45') || ']', 'outro motivo qualquer') like 'VANT_CHAVE_CONFLITO|%');
update public.ingredients set stock_quantity = 100 where id in (pg_temp.id('lc'), pg_temp.id('choc'));
select t.verdade('B4 using MORE than the recipe needs a reason too',
  pg_temp.brig('real-0004', 20, '[' || pg_temp.c('choc', '80') || ']') like 'VANT_JUSTIFICATIVA_OBRIGATORIA|%');
select t.verdade('B5 an ingredient outside the recipe needs a reason',
  pg_temp.brig('real-0005', 20, '[' || pg_temp.c('gran', '30') || ']') like 'VANT_JUSTIFICATIVA_OBRIGATORIA|%');
select t.verdade('B6 more than the recipe and an extra, with a reason: accepted',
  pg_temp.brig('real-0006', 20, '[' || pg_temp.c('choc', '80') || ',' || pg_temp.c('gran', '30') || ']', 'queimou uma parte e passei no granulado') = 'ok');
select t.igual('B6 granulado taken', pg_temp.est('gran'), 970);

-- ---------------------------------------------------------------- corrections cannot erode the recipe step by step
create temp table reg as select (resposta->>'registro_id')::uuid as id from public.producao_eventos where chave = 'real-0006';
select t.verdade('C1 correction down to the floor (90%): accepted',
  t.erro(format($q$select public.producao_corrigir(%L, 'corr-0001', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 20)),
     jsonb_build_array(jsonb_build_object('ingrediente', %L::uuid, 'quantidade', 0.9)), 'usei menos leite')$q$, (select id from reg), pg_temp.id('brig'), pg_temp.id('lc'))) = 'ok');
select t.verdade('C2 a second correction 10% below the previous one (81% of the recipe): refused',
  t.erro(format($q$select public.producao_corrigir(%L, 'corr-0002', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 20)),
     jsonb_build_array(jsonb_build_object('ingrediente', %L::uuid, 'quantidade', 0.81)), 'usei menos ainda')$q$, (select id from reg), pg_temp.id('brig'), pg_temp.id('lc'))) like 'VANT_CONSUMO_ABAIXO_DO_MINIMO|%');
select t.verdade('C3 a correction that raises units and zeroes the consumption: refused',
  t.erro(format($q$select public.producao_corrigir(%L, 'corr-0003', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 200)),
     jsonb_build_array(jsonb_build_object('ingrediente', %L::uuid, 'quantidade', 0), jsonb_build_object('ingrediente', %L::uuid, 'quantidade', 0)), 'recontei')$q$,
     (select id from reg), pg_temp.id('brig'), pg_temp.id('lc'), pg_temp.id('choc'))) like 'VANT_CONSUMO_ABAIXO_DO_MINIMO|%');

-- ---------------------------------------------------------------- invariant over the whole history
select t.verdade('D every stored version consumed at least 90% of its recipe on every ingredient',
  not exists (select 1 from public.producao_consumos where quantidade_real < quantidade_receita * 0.9));
select t.verdade('D every adjusted version carries a justification',
  not exists (select 1 from public.producao_eventos e where e.consumo_ajustado and coalesce(char_length(trim(e.justificativa_consumo)), 0) < 5));
