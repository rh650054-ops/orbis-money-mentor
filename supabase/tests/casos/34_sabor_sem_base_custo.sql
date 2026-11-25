-- Flavour cost shown (25/11/2026): a flavour that does not use the base is its own recipe ÷ its yield
-- + the product's costs without stock; a flavour that uses the base keeps the old formula. Fictional data.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
do $$
declare u uuid := t.vendedor('Sabor Custo'); v uuid; p uuid; s uuid;
begin
  insert into f values ('u', u);
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, 'Garrafa', 'un', 50, 1.20) returning id into v; insert into f values ('gar', v);
  insert into public.products (user_id, name, sale_price, stock_quantity, recipe_mode, batch_yield, cost, custos_extras)
    values (u, 'Shake', 15, 0, 'batch', 6, 2.00, '[{"nome":"Mão de obra","valor":0.70,"por":"unidade"}]') returning id into p; insert into f values ('p', p);
  insert into public.product_variants (user_id, product_id, name, batch_yield, usa_base) values (u, p, 'Sozinho', 6, false) returning id into s; insert into f values ('so', s);
  insert into public.product_variants (user_id, product_id, name, posicao, usa_base) values (u, p, 'ComBase', 1, true) returning id into s; insert into f values ('cb', s);
  insert into public.product_recipes (user_id, product_id, variant_id, ingredient_id, quantity) values (u, p, pg_temp.id('so'), v, 6);
  insert into public.product_recipes (user_id, product_id, variant_id, ingredient_id, quantity) values (u, p, pg_temp.id('cb'), v, 6);
end $$;
select t.logar(pg_temp.id('u'));
-- own recipe 6 × 1,20 ÷ 6 = 1,20 + 0,70 labour = 1,90 (before: 2,00 base + 1,20 = 3,20)
select t.igual('S1 flavour without the base: own recipe ÷ yield + labour, never the base on top',
  (select custo from public.produto_sabores(pg_temp.id('p')) where id = pg_temp.id('so')), 1.90);
select t.igual('S2 flavour with the base: exactly the old formula (base + its extra ÷ yield)',
  (select custo from public.produto_sabores(pg_temp.id('p')) where id = pg_temp.id('cb')), 3.20);
