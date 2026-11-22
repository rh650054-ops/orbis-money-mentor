-- Etapa 1 final check (22/11/2026): a recipe emptied of consumption (every ingredient zeroed or
-- removed) must not let the seller justify once and then produce without limit using no material.
-- Rules: an incomplete recipe may stay saved as a draft; a recipe without valid consumption cannot
-- be used in production; legitimate edits keep working; history is kept; nothing is invented.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.est(p text) returns numeric language sql as $$
  select coalesce((select stock_quantity::numeric from public.products where id = pg_temp.id(p)),
                  (select stock_quantity from public.ingredients where id = pg_temp.id(p)))
$$;
create or replace function pg_temp.produzir(p_chave text, p_prod text, p_unidades int, p_just text default null, p_sabor text default null, p_consumo jsonb default null) returns text language sql as $$
  select t.erro(format($q$select public.producao_registrar(%L, jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('produto', %L::uuid, 'sabor', %L::uuid, 'unidades', %s))), %L::jsonb, null, %L)$q$,
    p_chave, pg_temp.id(p_prod), pg_temp.id(p_sabor), p_unidades, p_consumo, p_just))
$$;

do $$
declare u uuid := t.vendedor('Rascunho Teste'); p uuid; v uuid; g uuid; h uuid;
begin
  insert into f values ('u', u);
  perform t.logar(u);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Leite condensado', 'lata', 100) returning id into g;
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Chocolate', 'g', 5000) returning id into h;
  insert into f values ('lc', g), ('choc', h);
  -- made by the seller, recipe per batch of 20
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Brigadeiro', 'batch', 20, 'faz') returning id into p;
  insert into f values ('brig', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1), (u, p, h, 50);
  -- a second one, to empty by deleting every line and leaving batch mode
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Beijinho', 'batch', 20, 'faz') returning id into p;
  insert into f values ('beij', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
  -- sold at the light, ingredients taken at the sale
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Salgado', 'per_unit', 0, 'faz') returning id into p;
  insert into f values ('salg', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 0.1);
  -- popsicle: empty base, everything is in the flavour
  insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Geladinho', 'batch', 10, 'faz') returning id into p;
  insert into public.product_variants (user_id, product_id, name) values (u, p, 'Chocolate') returning id into v;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, h, 100, v);
  insert into f values ('gel', p), ('gel:choc', v);
  -- resale: bought ready, never had a recipe
  insert into public.products (user_id, name, recipe_mode, origem) values (u, 'Água', 'none', 'compra') returning id into p;
  insert into f values ('agua', p);
  -- made by the seller, recipe never filled in
  insert into public.products (user_id, name, recipe_mode, origem) values (u, 'Trufa', 'none', 'faz') returning id into p;
  insert into f values ('trufa', p);
end $$;
select t.logar(pg_temp.id('u'));
select t.verdade('setup: a normal production works and consumes', pg_temp.produzir('zero-0001', 'brig', 20) = 'ok' and pg_temp.est('lc') = 99);

-- ---------------------------------------------------------------- the attack: zero everything, justify once, produce forever
update public.product_recipes set quantity = 0 where product_id = pg_temp.id('brig');
select t.verdade('Z1 the zeroed recipe stays saved as a draft (rows kept, edit allowed)',
  (select count(*) = 2 and bool_and(quantity = 0) from public.product_recipes where product_id = pg_temp.id('brig')));
select t.verdade('Z1 producing it is refused EVEN with a justification',
  pg_temp.produzir('zero-0002', 'brig', 20, 'zerei a receita de propósito') like 'VANT_RECEITA_INCOMPLETA|%Brigadeiro%');
select t.verdade('Z1 ...and again without one (no "justify once, then free")',
  pg_temp.produzir('zero-0003', 'brig', 20) like 'VANT_RECEITA_INCOMPLETA|%');
select t.verdade('Z1 typed consumption cannot rescue it (nothing is invented over an empty recipe)',
  pg_temp.produzir('zero-0004', 'brig', 20, 'usei leite sim', null, jsonb_build_array(jsonb_build_object('ingrediente', pg_temp.id('lc'), 'quantidade', 1))) like 'VANT_RECEITA_INCOMPLETA|%');
select t.igual('Z1 no brigadeiro entered the stock', pg_temp.est('brig'), 20);
select t.igual('Z1 no ingredient moved', pg_temp.est('lc'), 99);
select t.verdade('Z1 the history of the reduction is kept', exists (select 1 from public.receita_alteracoes where product_id = pg_temp.id('brig') and depois = '0' and reduz));

delete from public.product_recipes where product_id = pg_temp.id('beij');
update public.products set recipe_mode = 'none', origem = 'compra' where id = pg_temp.id('beij');
select t.verdade('Z2 every line deleted, mode and origin switched to "resale": still refused (its recipe history says it had one)',
  pg_temp.produzir('zero-0005', 'beij', 20, 'agora eu compro pronto') like 'VANT_RECEITA_INCOMPLETA|%Beijinho%');

update public.product_recipes set quantity = 0 where product_id = pg_temp.id('salg');
select t.verdade('Z3 per_unit with every ingredient zeroed: refused (the sale would take nothing either)',
  pg_temp.produzir('zero-0006', 'salg', 10, 'motivo qualquer') like 'VANT_RECEITA_INCOMPLETA|%Salgado%');

select t.verdade('Z4 a product the seller makes, recipe never filled in: refused, nothing invented',
  pg_temp.produzir('zero-0007', 'trufa', 10) like 'VANT_RECEITA_INCOMPLETA|%Trufa%');

-- ---------------------------------------------------------------- legitimate cases keep working
select t.verdade('L1 resale product that never had a recipe: allowed, zero consumption (nothing to invent)',
  pg_temp.produzir('zero-0008', 'agua', 12) = 'ok' and pg_temp.est('agua') = 12);
select t.verdade('L2 recipe that lives only in the flavour: producing that flavour is allowed and consumes',
  pg_temp.produzir('zero-0009', 'gel', 10, null, 'gel:choc') = 'ok' and pg_temp.est('choc') = 4850);  -- 5000 - 50 (setup) - 100
select t.verdade('L2 ...the same product without the flavour has no consumption: refused',
  pg_temp.produzir('zero-0010', 'gel', 10) like 'VANT_RECEITA_INCOMPLETA|%Geladinho%');
update public.product_recipes set quantity = 0.1 where product_id = pg_temp.id('salg');
select t.verdade('L3 per_unit filled again: allowed (it consumes at the sale, as today)',
  pg_temp.produzir('zero-0011', 'salg', 10, 'receita do salgado voltou') = 'ok');
update public.product_recipes set quantity = 1 where product_id = pg_temp.id('brig') and ingredient_id = pg_temp.id('lc');
select t.verdade('L4 draft completed (one ingredient back): allowed, the earlier reduction asks its reason once',
  pg_temp.produzir('zero-0012', 'brig', 20) like 'VANT_RECEITA_REDUZIDA|%'
  and pg_temp.produzir('zero-0013', 'brig', 20, 'tirei o chocolate da receita') = 'ok');
select t.igual('L4 ...and it consumes what the recipe now says (1 can)', pg_temp.est('lc'), 98);
select t.verdade('L4 the next production needs no reason', pg_temp.produzir('zero-0014', 'brig', 20) = 'ok' and pg_temp.est('lc') = 97);

-- ---------------------------------------------------------------- corrections, undo and history
select t.verdade('H1 a correction cannot move an existing production onto an empty recipe',
  (select t.erro(format($q$select public.producao_corrigir(%L, 'zero-cor-01', jsonb_build_array(jsonb_build_object('produto', %L::uuid, 'unidades', 10)), null, 'era trufa')$q$,
     (select registro_id from public.producao_eventos where chave = 'zero-0014'), pg_temp.id('trufa')))) like 'VANT_RECEITA_INCOMPLETA|%');
update public.product_recipes set quantity = 0 where product_id = pg_temp.id('brig');
select t.verdade('H2 undoing an earlier production still works on an emptied recipe (it returns what was STORED)',
  t.erro(format($q$select public.producao_desfazer(%L, 'zero-des-01', 'produção duplicada')$q$, (select registro_id from public.producao_eventos where chave = 'zero-0014'))) = 'ok');
select t.igual('H2 ...the can of that production came back', pg_temp.est('lc'), 98);
select t.verdade('H3 every stored production kept its real consumption (versions untouched)',
  (select count(*) = 4 from public.producao_consumos c join public.producao_eventos e on e.id = c.evento_id
    where e.chave in ('zero-0001', 'zero-0013', 'zero-0014') and c.quantidade_real > 0));
select t.verdade('H4 no production in the whole history entered units of a recipe-based product with zero consumption',
  not exists (select 1 from public.producao_eventos e join public.producao_itens i on i.evento_id = e.id
               join public.products p on p.id = i.product_id
              where p.origem = 'faz' and p.recipe_mode = 'batch'
                and not exists (select 1 from public.producao_consumos c where c.evento_id = e.id)));
