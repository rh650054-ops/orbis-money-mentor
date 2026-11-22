-- Etapa 1 (22/11/2026): what must keep working around the new immutable history.
--   1) deleting an account still removes the production history, with no orphan left, in both
--      flows as production runs them: delete-my-account (apagar_dados_do_usuario, then
--      auth.admin.deleteUser) and admin-delete-user (service-role deletes of a fixed table list,
--      the profile, then auth.admin.deleteUser). Nobody can delete history row by row;
--   2) the rollback refuses while production history exists (the full rehearsal is case 26).

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
grant all on public.products, public.ingredients, public.product_recipes, public.profiles to service_role;
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
  foreach u in array array[t.vendedor('Conta Apagada'), t.vendedor('Conta Admin'), t.vendedor('Conta Mantida')] loop
    insert into f values ((array['u', 'o', 'k'])[(select count(*) from f) + 1], u);
    insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Farinha', 'kg', 10) returning id into g;
    insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Pão', 'batch', 10) returning id into p;
    insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
    perform t.logar(u);
    perform public.producao_registrar('conta-' || left(u::text, 8), jsonb_build_array(jsonb_build_object('produto', p, 'unidades', 10)));
  end loop;
end $$;

-- ---------------------------------------------------------------- 1. account deletion
select t.igual('setup: each account has history (registro + event + item + consumption + 2 movements)', pg_temp.historico(pg_temp.id('u')), 6);
-- nobody deletes history row by row, not even the service role or the owner
select t.verdade('service role: a direct delete of history is refused',
  t.erro(format('delete from public.producao_registros where user_id = %L', pg_temp.id('o')), 'service_role') like 'VANT_HISTORICO_IMUTAVEL|%');
select t.verdade('owner: a direct delete is refused (no grant)',
  t.erro(format('delete from public.producao_eventos where user_id = %L', pg_temp.id('o')), 'authenticated', pg_temp.id('o')) like '42501|%');
select t.verdade('postgres: a plain delete is refused',
  t.erro(format('delete from public.producao_eventos where user_id = %L', pg_temp.id('o'))) like 'VANT_HISTORICO_IMUTAVEL|%');

-- delete-my-account: apagar_dados_do_usuario, then auth.admin.deleteUser
select public.apagar_dados_do_usuario(pg_temp.id('u'));
select t.igual('delete-my-account: the sweep already removes the history', pg_temp.historico(pg_temp.id('u')), 0);
delete from auth.users where id = pg_temp.id('u');
select t.verdade('delete-my-account: the account itself is gone', not exists (select 1 from auth.users where id = pg_temp.id('u')));

-- admin-delete-user: service-role deletes of its fixed list (producao_* not in it), the profile, then deleteUser
select t.erro(format('delete from public.%I where user_id = %L', x, pg_temp.id('o')), 'service_role') from unnest(array['product_recipes', 'products', 'ingredients', 'profiles']) x;
select t.igual('admin: after the table list and the profile, the history is still there (not in the list)', pg_temp.historico(pg_temp.id('o')), 6);
select t.verdade('admin: deleteUser (auth.users) goes through', t.erro(format('delete from auth.users where id = %L', pg_temp.id('o'))) = 'ok');
select t.igual('admin: the account''s history went with it (FK cascade)', pg_temp.historico(pg_temp.id('o')), 0);
select t.verdade('no orphan: every history row belongs to an existing account',
  not exists (select 1 from (select user_id from public.producao_registros union all select user_id from public.producao_eventos
     union all select user_id from public.producao_itens union all select user_id from public.producao_consumos
     union all select user_id from public.producao_movimentos) h where not exists (select 1 from auth.users a where a.id = h.user_id)));
select t.igual('the account that was kept has all its history', pg_temp.historico(pg_temp.id('k')), 6);
select t.verdade('rollback with history: refused, nothing dropped',
  t.erro($q$do $$ begin
    if to_regclass('public.producao_eventos') is not null and exists (select 1 from public.producao_eventos) then
      raise exception 'Rollback recusado: já existe produção registrada pelo novo fluxo. Peça autorização antes de apagar esse histórico.';
    end if; end $$$q$) like 'P0001|Rollback recusado%');
