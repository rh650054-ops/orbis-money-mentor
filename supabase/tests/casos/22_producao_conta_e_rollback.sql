-- Etapa 1 (22/11/2026): what must keep working around the new immutable history.
--   1) deleting an account (delete-my-account -> apagar_dados_do_usuario, admin -> service role)
--      still removes the production history, instead of failing on the immutability triggers;
--   2) the rollback removes exactly what the migration created, refuses while history exists,
--      and the migration can be applied again afterwards.

-- Copy of apagar_dados_do_usuario as production runs it (read on 22/11/2026).
create or replace function public.apagar_dados_do_usuario(p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare r record; v_tabelas int := 0; v_linhas bigint := 0; v_del bigint;
begin
  if p_user is null then raise exception 'usuário nulo'; end if;
  for r in
    select c.table_name from information_schema.columns c
      join information_schema.tables t on t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'user_id' and c.table_name <> 'profiles'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', r.table_name) using p_user;
      get diagnostics v_del = row_count;
      v_tabelas := v_tabelas + 1; v_linhas := v_linhas + v_del;
    exception when others then
      raise warning 'falha ao limpar %: %', r.table_name, sqlerrm;
    end;
  end loop;
  delete from public.profiles where user_id = p_user;
  return jsonb_build_object('tabelas_varridas', v_tabelas, 'linhas_apagadas', v_linhas);
end $function$;
-- Supabase gives the service role every table; the migration does not take that away.
grant all on public.producao_registros, public.producao_eventos, public.producao_itens, public.producao_consumos, public.producao_movimentos to service_role;

create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.historico(p_user uuid) returns numeric language sql as $$
  select (select count(*) from public.producao_registros where user_id = p_user) + (select count(*) from public.producao_eventos where user_id = p_user)
       + (select count(*) from public.producao_itens where user_id = p_user) + (select count(*) from public.producao_consumos where user_id = p_user)
       + (select count(*) from public.producao_movimentos where user_id = p_user)
$$;
do $$
declare u uuid; o uuid; p uuid; g uuid;
begin
  foreach u in array array[t.vendedor('Conta Apagada'), t.vendedor('Conta Mantida')] loop
    insert into f values (case when not exists (select 1 from f) then 'u' else 'o' end, u);
    insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Farinha', 'kg', 10) returning id into g;
    insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Pão', 'batch', 10) returning id into p;
    insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
    perform t.logar(u);
    perform public.producao_registrar('conta-' || left(u::text, 8), jsonb_build_array(jsonb_build_object('produto', p, 'unidades', 10)));
  end loop;
end $$;

-- ---------------------------------------------------------------- 1. account deletion
select t.igual('setup: each account has history (registro + event + item + consumption + 2 movements)', pg_temp.historico(pg_temp.id('u')), 6);
select public.apagar_dados_do_usuario(pg_temp.id('u'));
select t.igual('delete-my-account: the production history of that account is gone', pg_temp.historico(pg_temp.id('u')), 0);
select t.igual('delete-my-account: the other account keeps all its history', pg_temp.historico(pg_temp.id('o')), 6);
select t.verdade('delete-my-account: a plain delete is still refused afterwards',
  t.erro(format('delete from public.producao_eventos where user_id = %L', pg_temp.id('o'))) like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('rollback with history: refused, nothing dropped',
  t.erro($q$do $$ begin
    if to_regclass('public.producao_eventos') is not null and exists (select 1 from public.producao_eventos) then
      raise exception 'Rollback recusado: já existe produção registrada pelo novo fluxo. Peça autorização antes de apagar esse histórico.';
    end if; end $$$q$) like 'P0001|Rollback recusado%');
select t.verdade('admin (service role): can delete an account''s history',
  t.erro(format('delete from public.producao_registros where user_id = %L', pg_temp.id('o')), 'service_role') = 'ok');
select t.igual('admin (service role): cascade removed every row of that account', pg_temp.historico(pg_temp.id('o')), 0);

-- ---------------------------------------------------------------- 2. rollback rehearsal
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
select pg_temp.objetos() as objetos \gset
select pg_temp.dados() as dados \gset
\ir ../../producao-integridade/rollback-etapa1.sql
select t.igual('rollback: no producao_* table or function is left',
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname like 'producao\_%') + (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'producao\_%'), 0);
select t.verdade('rollback: every other table, function and trigger is identical', pg_temp.objetos() = :'objetos');
select t.verdade('rollback: no existing data changed (products, ingredients, recipes...)', pg_temp.dados() = :'dados');
\ir ../../migrations/20261122120000_producao_integridade.sql
select t.logar(pg_temp.id('o'));
select t.verdade('re-apply: the migration runs again on top of the rollback and works',
  (select (public.producao_registrar('reaplicar-0001', jsonb_build_array(jsonb_build_object('produto', p.id, 'unidades', 10)))->>'repetido') = 'false'
     from public.products p where p.user_id = pg_temp.id('o')));
select t.igual('re-apply: the flour of the kept account went 9 -> 8', (select stock_quantity from public.ingredients where user_id = pg_temp.id('o')), 8);
