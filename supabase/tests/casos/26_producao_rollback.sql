-- Etapa 1 (22/11/2026): rollback rehearsal of BOTH migrations.
--   * "before" = the database after a rollback on an empty history (conta_teste_zerar must then
--     be exactly production's: body fingerprint 189d472f…, read on 22/11);
--   * the rollback refuses while production history exists;
--   * with recipe changes already logged, it stops logging but KEEPS receita_alteracoes (data);
--   * with nothing logged, everything goes and the database is identical to "before";
--   * both migrations apply again afterwards.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.objetos() returns text language sql as $$
  select md5(coalesce(string_agg(o, ';' order by o), '')) from (
    select 'T:' || c.relname || ':' || c.relrowsecurity as o from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not like 'producao\_%'
    union all select 'F:' || p.proname || ':' || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname not like 'producao\_%'
    union all select 'G:' || t.tgname || ':' || t.tgrelid::regclass::text from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and c.relname not like 'producao\_%' and not t.tgisinternal
  ) z $$;
create or replace function pg_temp.dados() returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename not like 'producao\_%' order by 1 loop
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.tablename) into h;
    tudo := tudo || r.tablename || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
create or replace function pg_temp.zerar_de_producao() returns boolean language sql as $$
  select md5(regexp_replace(prosrc, '\s', '', 'g')) = '189d472f887668e80f82fd229e710a86' from pg_proc where proname = 'conta_teste_zerar'
$$;
create or replace function pg_temp.novos() returns numeric language sql as $$
  select (select count(*) from pg_class where relnamespace = 'public'::regnamespace and (relname like 'producao\_%' or relname = 'receita_alteracoes'))
       + (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'producao\_%' or proname = 'receita_registrar'))
       + (select count(*) from pg_trigger where tgname = 'receita_alteracoes_registrar')
$$;

-- ---------------------------------------------------------------- "before"
-- 23/11: the test database also has the yield-per-flavour migration on top of Etapa 1; it is rolled
-- back first (its own rehearsal is case 29), as it must be in production.
\ir ../../rendimento-por-sabor/rollback.sql
\ir ../../producao-integridade/rollback-etapa1.sql
select t.igual('before: no object of Etapa 1 exists', pg_temp.novos(), 0);
select t.verdade('before: conta_teste_zerar is exactly the production function', pg_temp.zerar_de_producao());
select pg_temp.objetos() as antes \gset
\ir ../../migrations/20261122120000_producao_integridade.sql
\ir ../../migrations/20261122130000_receita_historico_e_conta_teste.sql
select t.verdade('applied: conta_teste_zerar is the extended one', not pg_temp.zerar_de_producao());

-- ---------------------------------------------------------------- history exists: refused
do $$
declare u uuid := t.vendedor('Rollback A'); p uuid; g uuid;
begin
  insert into f values ('a', u);
  perform t.logar(u);
  insert into public.ingredients (user_id, name, stock_quantity) values (u, 'Farinha', 10) returning id into g;
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Pão', 'batch', 10) returning id into p;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
  perform public.producao_registrar('rollback-0001', jsonb_build_array(jsonb_build_object('produto', p, 'unidades', 10)));
end $$;
select t.verdade('history exists: the rollback guard refuses',
  t.erro($q$do $$ begin
    if to_regclass('public.producao_eventos') is not null and exists (select 1 from public.producao_eventos) then
      raise exception 'Rollback recusado: já existe produção registrada pelo novo fluxo. Peça autorização antes de apagar esse histórico.';
    end if; end $$$q$) like 'P0001|Rollback recusado%');
delete from auth.users where id = pg_temp.id('a');   -- the only way history goes: with its account

-- ---------------------------------------------------------------- recipe log exists: kept
do $$
declare u uuid := t.vendedor('Rollback B'); p uuid;
begin
  insert into f values ('b', u);
  perform t.logar(u);
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Bolo', 'batch', 8) returning id into p;
  insert into f values ('bolo', p);
  update public.products set batch_yield = 10 where id = p;
end $$;
select count(*) as log_antes from public.receita_alteracoes \gset
select pg_temp.dados() as dados_antes \gset
\ir ../../producao-integridade/rollback-etapa1.sql
select t.verdade('log kept: receita_alteracoes still there with its rows', (select count(*) from public.receita_alteracoes) = :log_antes and :log_antes > 0);
select t.verdade('log kept: no existing data changed (products, recipes, the log itself)', pg_temp.dados() = :'dados_antes');
select t.verdade('log kept: production functions and tables are gone', not exists (select 1 from pg_proc where proname = 'producao_registrar') and to_regclass('public.producao_eventos') is null);
select t.verdade('log kept: the recipe triggers are gone, editing logs nothing more',
  (select count(*) from pg_trigger where tgname = 'receita_alteracoes_registrar') = 0
  and t.erro(format('update public.products set batch_yield = 12 where id = %L', pg_temp.id('bolo'))) = 'ok'
  and (select count(*) from public.receita_alteracoes) = :log_antes);
select t.verdade('log kept: conta_teste_zerar is the production function again', pg_temp.zerar_de_producao());
select t.verdade('log kept: it is still immutable', t.erro('delete from public.receita_alteracoes') like 'VANT_HISTORICO_IMUTAVEL|%');

-- ---------------------------------------------------------------- nothing logged: everything goes
delete from auth.users where id = pg_temp.id('b');
select t.igual('the account took its log rows with it', (select count(*) from public.receita_alteracoes), 0);
\ir ../../producao-integridade/rollback-etapa1.sql
select t.igual('empty: no object of Etapa 1 is left', pg_temp.novos(), 0);
select t.verdade('empty: every table, function and trigger is identical to "before"', pg_temp.objetos() = :'antes');

-- ---------------------------------------------------------------- applies again
\ir ../../migrations/20261122120000_producao_integridade.sql
\ir ../../migrations/20261122130000_receita_historico_e_conta_teste.sql
do $$
declare u uuid := t.vendedor('Rollback C'); p uuid; g uuid;
begin
  insert into f values ('c', u);
  perform t.logar(u);
  insert into public.ingredients (user_id, name, stock_quantity) values (u, 'Farinha', 10) returning id into g;
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Pão', 'batch', 10) returning id into p;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
  perform public.producao_registrar('rollback-0002', jsonb_build_array(jsonb_build_object('produto', p, 'unidades', 10)));
end $$;
select t.verdade('re-applied: production and recipe log work again',
  exists (select 1 from public.producao_eventos where chave = 'rollback-0002') and exists (select 1 from public.receita_alteracoes where user_id = pg_temp.id('c')));
select t.igual('re-applied: the flour went 10 -> 9', (select stock_quantity from public.ingredients where user_id = pg_temp.id('c')), 9);
