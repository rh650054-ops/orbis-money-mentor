-- Yield per flavour (23/11/2026): equivalence and rollback rehearsal.
--   E) For products WITHOUT per-flavour data and with complete recipes, the new flow computes
--      exactly what Etapa 1 computed (same JSON, same refusals), and the old functions do exactly
--      what production does (same stock, same batches, same answer). Randomised, fixed seed.
--   R) The rollback puts back every object exactly (the four old functions match the md5 of their
--      production body read on 23/11), refuses while per-flavour data or shared ingredients exist,
--      and never deletes data. The migration applies again afterwards.
-- Fictional data only.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.objetos() returns text language sql as $$
  select md5(coalesce(string_agg(o, ';' order by o), '')) from (
    select 'T:' || c.relname || ':' || c.relrowsecurity as o from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'i')
    union all select 'C:' || conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid) from pg_constraint where connamespace = 'public'::regnamespace
    union all select 'A:' || table_name || ':' || column_name || ':' || data_type || ':' || coalesce(column_default, '') from information_schema.columns where table_schema = 'public'
    union all select 'F:' || p.proname || ':' || md5(pg_get_functiondef(p.oid)) || ':' || coalesce(p.proacl::text, '') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    union all select 'G:' || t.tgname || ':' || t.tgrelid::regclass::text from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  ) z $$;
create or replace function pg_temp.dados() returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    -- the two new columns of product_variants are left out, so "before" and "after" compare the data both have
    execute format('select md5(coalesce(string_agg(j, ''|'' order by j), '''')) from (select (case when %L = ''product_variants'' then to_jsonb(x) - ''batch_yield'' - ''usa_base'' else to_jsonb(x) end)::text as j from public.%I x) z',
                   r.tablename, r.tablename) into h;
    tudo := tudo || r.tablename || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
-- the bodies production runs today (md5 of prosrc, read on 23/11/2026)
create or replace function pg_temp.legado_de_producao() returns boolean language sql as $$
  select count(*) = 4 from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.proname, md5(p.prosrc)) in (('produto_produzir', '1272f481bb43e3b57212dc661b6e6d84'), ('produto_produzir_sabores', '43c1fb25f53cbeb252d8ea91d3f3bece'),
                                        ('produto_sabores_distribuir', '7812b62772bd28b26187107857952986'), ('produto_sabores_salvar', 'b1184ff8663867af68d196aa183ef029'))
$$;
-- estado_alvo, with a refusal turned into data
create or replace function pg_temp.alvo(p_user uuid, p_itens jsonb) returns jsonb language plpgsql as $$
declare m text; h text;
begin
  return public.producao_estado_alvo(p_user, p_itens, null, null);
exception when others then
  get stacked diagnostics m = message_text, h = pg_exception_hint;
  return jsonb_build_object('erro', h, 'msg', m);
end $$;
-- an old function, run and then UNDONE: returns its answer + the state it left (stocks, batches)
create or replace function pg_temp.medir(p_sql text, p_user uuid) returns jsonb language plpgsql as $$
declare r jsonb; e jsonb; m text; h text;
begin
  begin
    execute p_sql into r;
    select jsonb_build_object('res', r,
      'ing', (select jsonb_object_agg(id, stock_quantity) from public.ingredients where user_id = p_user),
      'prod', (select jsonb_object_agg(id, stock_quantity) from public.products where user_id = p_user),
      'var', (select jsonb_object_agg(id, stock_quantity) from public.product_variants where user_id = p_user),
      'lotes', (select jsonb_agg(jsonb_build_array(product_id, batches_count, units_produced, notes) order by product_id, units_produced) from public.production_batches where user_id = p_user))
      into e;
    raise exception using errcode = 'VT001', message = e::text;
  exception
    when sqlstate 'VT001' then get stacked diagnostics m = message_text; return m::jsonb;
    when others then get stacked diagnostics m = message_text, h = pg_exception_hint; return jsonb_build_object('erro', m, 'hint', h);
  end;
end $$;

-- ---------------------------------------------------------------- random old-style catalogue (complete recipes)
select setseed(0.23);
do $$
declare u uuid := t.vendedor('Equivalencia'); p uuid; v uuid; i int; j int; k int; g uuid[] := '{}'; x uuid; modo text; rende numeric;
begin
  insert into f values ('u', u);
  perform t.logar(u);
  for i in 1 .. 25 loop
    insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Ingrediente ' || i, 'g', round((random() * 100000)::numeric, 3)) returning id into x;
    g := g || x;
  end loop;
  for i in 1 .. 60 loop
    modo := case when random() < 0.12 then 'per_unit' when random() < 0.05 then 'none' else 'batch' end;
    rende := case when random() < 0.06 then 0 when random() < 0.3 then round((random() * 40 + 0.5)::numeric, 2) else floor(random() * 50 + 1) end;
    insert into public.products (user_id, name, recipe_mode, batch_yield, origem) values (u, 'Produto ' || i, modo, rende, 'faz') returning id into p;
    insert into f values ('p' || i, p);
    -- base: 0..4 distinct ingredients, all with quantity (some products have no base at all)
    for j in 1 .. floor(random() * 5)::int loop
      insert into public.product_recipes (user_id, product_id, ingredient_id, quantity)
      values (u, p, g[1 + ((i * 7 + j * 3) % 25)], round((random() * 500 + 0.001)::numeric, 3)) on conflict do nothing;
    end loop;
    -- 0..3 flavours with 0..2 extras that are NOT in the base (the old UNIQUE rule)
    for k in 1 .. floor(random() * 4)::int loop
      insert into public.product_variants (user_id, product_id, name, posicao) values (u, p, 'Sabor ' || k, k) returning id into v;
      insert into f values ('p' || i || ':' || k, v);
      for j in 1 .. floor(random() * 3)::int loop
        x := g[1 + ((i * 11 + k * 5 + j) % 25)];
        continue when exists (select 1 from public.product_recipes r where r.product_id = p and r.ingredient_id = x);
        insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p, x, round((random() * 300 + 0.001)::numeric, 3), v);
      end loop;
    end loop;
  end loop;
end $$;
select t.logar(pg_temp.id('u'));
-- a flavour whose product has a base recipe, for the refusal tests at the end
insert into f select 'v1', v.id from public.product_variants v
  where exists (select 1 from public.product_recipes r where r.product_id = v.product_id and r.variant_id is null) order by v.name, v.id limit 1;
insert into f select 'pv1', product_id from public.product_variants where id = pg_temp.id('v1');
select t.verdade('setup: the catalogue has flavours, extras and a flavour on a product with base',
  pg_temp.id('v1') is not null and (select count(*) from public.product_variants) > 30 and (select count(*) from public.product_recipes where variant_id is not null) > 20);
-- 400 random calls of the new flow (1..4 items, with or without flavour)
create temp table chamadas as
select n, (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('produto', it.produto, 'sabor', it.sabor, 'unidades', it.unidades)))
             from (select pp.id as produto,
                          (select v.id from public.product_variants v where v.product_id = pp.id and random() < 0.6 order by random() limit 1) as sabor,
                          1 + floor(random() * 500)::int as unidades
                     from generate_series(1, 1 + floor(random() * 4)::int) s
                     cross join lateral (select id from public.products where user_id = pg_temp.id('u') and s > -n order by random() limit 1) pp) it) as itens
  from generate_series(1, 400) n;
-- 120 random calls of the old functions
create temp table antigas as
select n, case n % 3
  when 0 then format('select public.produto_produzir(%L, %s)', p.id, 1 + floor(random() * 300)::int)
  when 1 then format('select public.produto_produzir_sabores(%L, %L::jsonb)', p.id,
                (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'unidades', 1 + floor(random() * 100)::int)), '[]') from public.product_variants v where v.product_id = p.id))
  else format('select public.produto_sabores_distribuir(%L, %L::jsonb)', p.id,
                (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'unidades', floor(random() * 3)::int)), '[]') from public.product_variants v where v.product_id = p.id))
  end as sql
  from generate_series(1, 120) n
  cross join lateral (select id from public.products where user_id = pg_temp.id('u') and n > 0 order by random() limit 1) p;
update public.products set stock_quantity = 50 where user_id = pg_temp.id('u');   -- room for "distribuir"
create temp table novo as select c.n, pg_temp.alvo(pg_temp.id('u'), c.itens) as r from chamadas c;
create temp table novo_leg as select a.n, pg_temp.medir(a.sql, pg_temp.id('u')) as r from antigas a;
select pg_temp.dados() as dados_novo \gset

-- ---------------------------------------------------------------- back to Etapa 1 + production bodies
select pg_temp.objetos() as obj_novo \gset
\ir ../../rendimento-por-sabor/rollback.sql
select t.verdade('R1 rollback: the four old functions are byte for byte what production runs (md5 of 23/11)', pg_temp.legado_de_producao());
select t.verdade('R2 rollback: the old UNIQUE is back, the partial indexes and the new columns are gone',
  exists (select 1 from pg_constraint where conname = 'product_recipes_product_id_ingredient_id_key')
  and to_regclass('public.product_recipes_base_ingrediente_key') is null
  and not exists (select 1 from information_schema.columns where table_name = 'product_variants' and column_name in ('batch_yield', 'usa_base'))
  and to_regprocedure('public.produto_receita_por_sabor(uuid)') is null
  and not exists (select 1 from pg_trigger where tgrelid = 'public.product_variants'::regclass and not tgisinternal));
select t.verdade('R3 rollback: no data changed', pg_temp.dados() = :'dados_novo');
select pg_temp.objetos() as obj_antes \gset
create temp table antigo as select c.n, pg_temp.alvo(pg_temp.id('u'), c.itens) as r from chamadas c;
create temp table antigo_leg as select a.n, pg_temp.medir(a.sql, pg_temp.id('u')) as r from antigas a;

select t.igual('E1 new flow = Etapa 1 on every random call (same JSON, same refusals)',
  (select count(*) from novo join antigo using (n) where novo.r is distinct from antigo.r), 0);
select t.verdade('E2 ...the sample covers productions AND refusals',
  (select count(*) filter (where r ? 'consumo') > 100 and count(*) filter (where r ? 'erro') > 20 from novo));
select t.verdade('E3 ...refusals of every kind kept (no recipe, no yield, per_unit warning)',
  (select count(distinct r->>'erro') >= 2 from novo where r ? 'erro')
  and exists (select 1 from novo where jsonb_array_length(r->'avisos') > 0));
select t.igual('E4 old functions with the migration = production bodies (stock, batches, answer)',
  (select count(*) from novo_leg join antigo_leg using (n) where novo_leg.r is distinct from antigo_leg.r), 0);
select t.verdade('E5 ...the sample covers the three old functions working',
  (select count(*) filter (where r ? 'res') > 60 from novo_leg));

-- ---------------------------------------------------------------- applies again; identical objects
\ir ../../migrations/20261123120000_rendimento_por_sabor.sql
-- 25/11: the per-unit migration patches producao_estado_alvo after this one; re-apply it too
\ir ../../migrations/20261125120000_receita_por_unidade.sql
select t.verdade('R4 re-applied: same objects as the first application', pg_temp.objetos() = :'obj_novo');

-- ---------------------------------------------------------------- the rollback refuses instead of deleting
update public.product_variants set batch_yield = 12 where id = pg_temp.id('v1');
select pg_temp.dados() as dados_sabor \gset
\set ON_ERROR_STOP off
\ir ../../rendimento-por-sabor/rollback.sql
\set ON_ERROR_STOP on
select t.verdade('R5 a flavour with its own yield: rollback refused, nothing changed',
  pg_temp.objetos() is distinct from :'obj_antes' and pg_temp.dados() = :'dados_sabor'
  and (select batch_yield from public.product_variants where id = pg_temp.id('v1')) = 12);
update public.product_variants set batch_yield = null where id = pg_temp.id('v1');
insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id)
select pg_temp.id('u'), r.product_id, r.ingredient_id, 1, pg_temp.id('v1')
  from public.product_recipes r where r.product_id = pg_temp.id('pv1') and r.variant_id is null limit 1;
select t.verdade('R6 setup: an ingredient shared by the base and a flavour',
  exists (select 1 from public.product_recipes group by product_id, ingredient_id having count(*) > 1));
select pg_temp.dados() as dados_dup \gset
\set ON_ERROR_STOP off
\ir ../../rendimento-por-sabor/rollback.sql
\set ON_ERROR_STOP on
select t.verdade('R6 a shared ingredient: rollback refused, no recipe row deleted',
  pg_temp.dados() = :'dados_dup' and to_regclass('public.product_recipes_base_ingrediente_key') is not null);
delete from public.product_recipes where variant_id = pg_temp.id('v1') and quantity = 1
   and ingredient_id in (select ingredient_id from public.product_recipes where product_id = pg_temp.id('pv1') and variant_id is null);
\ir ../../rendimento-por-sabor/rollback.sql
select t.verdade('R7 once back to the default, the rollback runs and leaves the same objects as the first time', pg_temp.objetos() = :'obj_antes');
\ir ../../rendimento-por-sabor/rollback.sql
select t.verdade('R8 a second rollback is harmless', pg_temp.objetos() = :'obj_antes');
