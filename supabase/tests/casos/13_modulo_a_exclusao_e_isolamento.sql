-- Module A · A-PR1. When a vendor's account is deleted, nothing of theirs may stay in the new
-- records: no row, and no bank identifier (vendor id, connection id, Item id, provider account
-- id) anywhere, logs included. Checked for the two routines that delete accounts today:
--   * self-service: apagar_dados_do_usuario (sweeps every table with user_id), then the login;
--   * admin: a fixed list of tables that does NOT include the new ones, then the login.
-- There is no exception: A-PR1 has no retention mechanism. And the database itself must keep
-- vendors apart, so deleting one can never touch another.

-- Verbatim copy of the production function (read on 11/11/2026). It exists only in production.
create or replace function public.apagar_dados_do_usuario(p_user uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_tabelas int := 0;
  v_linhas bigint := 0;
  v_del bigint;
begin
  if p_user is null then
    raise exception 'usuário nulo';
  end if;

  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
      and c.table_name <> 'profiles'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', r.table_name) using p_user;
      get diagnostics v_del = row_count;
      v_tabelas := v_tabelas + 1;
      v_linhas := v_linhas + v_del;
    exception when others then
      raise warning 'falha ao limpar %: %', r.table_name, sqlerrm;
    end;
  end loop;

  delete from public.profiles where user_id = p_user;
  get diagnostics v_del = row_count;
  v_linhas := v_linhas + v_del;

  return jsonb_build_object('tabelas_varridas', v_tabelas, 'linhas_apagadas', v_linhas);
end $function$;
select md5(pg_get_functiondef('public.apagar_dados_do_usuario(uuid)'::regprocedure)) as md5_da_copia \gset
select t.verdade('a copia da rotina de exclusao e identica a de producao (md5)', :'md5_da_copia' = '45ac84884d644f8f9d5c932385299989');

create function pg_temp.con(p_user uuid, p_banco text) returns uuid language sql as $$
  insert into public.bank_connections (user_id, item_id, institution_name, status, papel, papel_desde, dono_nome)
  values (p_user, 'item-' || gen_random_uuid(), p_banco, 'UPDATED', 'trabalho', now() - interval '5 days', 'TITULAR FICTICIA') returning id $$;
create function pg_temp.conta(p_con uuid, p_nome text) returns text language sql as $$
  insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo)
  select 'acc-' || gen_random_uuid(), b.user_id, b.id, b.institution_name, p_nome, 0
    from public.bank_connections b where b.id = p_con returning conta_id $$;
-- Every identifier that ties records to this vendor: the vendor id and the ids of their
-- connections, Items and provider accounts.
create function pg_temp.agulhas(p_user uuid) returns text[] language sql as $$
  select array_agg(x) from (
    select p_user::text union select id::text from public.bank_connections where user_id = p_user
    union select item_id from public.bank_connections where user_id = p_user
    union select conta_id from public.bank_saldos where user_id = p_user) z(x) $$;
-- How many rows of the of_* tables still mention any of those identifiers, in any column.
create function pg_temp.restos(p_agulhas text[]) returns bigint language plpgsql as $$
declare r record; a text; n bigint; total bigint := 0;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'of\_%' loop
    foreach a in array p_agulhas loop
      execute format('select count(*) from public.%I x where x::text like %L', r.tablename, '%' || a || '%') into n;
      total := total + n;
    end loop;
  end loop;
  return total;
end $$;
-- Fingerprint of everything a vendor has in the vendor-owned of_* tables.
create function pg_temp.foto_de(p_user uuid) returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select c.table_name from information_schema.columns c
            where c.table_schema = 'public' and c.column_name = 'user_id' and c.table_name like 'of\_%' order by 1 loop
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x where x.user_id = $1', r.table_name) into h using p_user;
    tudo := tudo || r.table_name || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
create function pg_temp.recusa(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

begin;
select t.vendedor('Sai pelo app') as a \gset
select t.vendedor('Fica') as b \gset
select t.vendedor('Dono de outra conta') as c \gset
select t.vendedor('Login some antes dos dados') as d \gset
select t.vendedor('Admin apaga') as e \gset
select pg_temp.con(:'a', 'Nubank') as ca1 \gset
select pg_temp.conta(:'ca1', 'Conta corrente');
select pg_temp.con(:'a', 'Itau') as ca2 \gset
select pg_temp.conta(:'ca2', 'Conta corrente');
select pg_temp.conta(:'ca2', 'Cartao de credito');
select pg_temp.con(:'b', 'Inter') as cb \gset
select pg_temp.conta(:'cb', 'Conta corrente');
select pg_temp.con(:'c', 'Cora') as cc \gset
select pg_temp.conta(:'cc', 'Conta PJ');
select pg_temp.con(:'d', 'C6') as cd \gset
select pg_temp.conta(:'cd', 'Conta corrente');
select pg_temp.con(:'e', 'Bradesco') as ce \gset
select pg_temp.conta(:'ce', 'Conta corrente');
-- an origin row that does not fit, so the run log has a problem to describe
insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo) values ('acc-torta-de-a', :'a', :'cb', 'Inter', 'Conta corrente', 0);
commit;
select public.of_espelho_atualizar() as r1 \gset
-- role change and a provider event, so history and events exist too (what A-PR2 will write)
update public.bank_connections set papel = 'pessoal', papel_desde = now() where id = :'ca2';
update public.bank_connections set status = 'deleted' where id = :'ca1';
select public.of_espelho_atualizar();
insert into public.of_eventos (provedor, user_id, evento_id, item_id, tipo, bruto)
select 'pluggy', b.user_id, 'ev-' || b.id, b.item_id, 'item/updated', jsonb_build_object('itemId', b.item_id) from public.bank_connections b;

select pg_temp.agulhas(:'a') as ag_a \gset
select pg_temp.agulhas(:'d') as ag_d \gset
select pg_temp.agulhas(:'e') as ag_e \gset
select pg_temp.foto_de(:'b') as foto_b \gset

select t.verdade('ponto de partida: o vendedor tem registros em todas as tabelas novas dele', pg_temp.restos(:'ag_a'::text[]) > 20);
select t.igual('o registro de execucoes nao guarda identificador de ninguem (mesmo descrevendo um problema)',
  (select count(*) from public.of_espelho_execucoes x cross join unnest(:'ag_a'::text[] || pg_temp.agulhas(:'b')) a where x::text like '%' || a || '%')::numeric, 0);
select t.verdade('...mas descreve o problema', (:'r1'::jsonb ->> 'conflitos')::int = 1 and (select problemas -> 0 ->> 'problema' from public.of_espelho_execucoes order by id limit 1) = 'conta_e_conexao_de_vendedores_diferentes');

-- ---------------------------------------------------------------- 0) the database itself keeps vendors apart
select id as vinc_b from public.of_vinculos where user_id = :'b' limit 1 \gset
select id as conta_c from public.of_contas where user_id = :'c' limit 1 \gset
select t.verdade('o banco recusa ligar o Item de um vendedor a conta de outro',
  pg_temp.recusa(format('insert into public.of_vinculo_contas (vinculo_id, conta_id, user_id) values (%L, %L, %L)', :'vinc_b', :'conta_c', :'b'))
  and pg_temp.recusa(format('insert into public.of_vinculo_contas (vinculo_id, conta_id, user_id) values (%L, %L, %L)', :'vinc_b', :'conta_c', :'c')));
select t.verdade('...nem gravar finalidade ou mudanca de um vendedor no Item de outro',
  pg_temp.recusa(format('insert into public.of_finalidades (user_id, vinculo_id, finalidade, origem, vale_ate) values (%L, %L, ''pessoal'', ''vendedor'', now())', :'c', :'vinc_b'))
  and pg_temp.recusa(format('insert into public.of_mudancas (user_id, vinculo_id, campo, motivo, fonte) values (%L, %L, ''estado'', ''teste'', ''sistema'')', :'c', :'vinc_b')));
select t.verdade('...nem registros de um vendedor que nao existe', pg_temp.recusa(format('insert into public.of_contas (user_id, instituicao) values (%L, ''Banco'')', gen_random_uuid())));

-- ---------------------------------------------------------------- 1) self-service deletion
select public.apagar_dados_do_usuario(:'a');
select t.igual('exclusao pelo app: a rotina atual ja limpa as tabelas novas, em qualquer ordem', pg_temp.restos(:'ag_a'::text[])::numeric, 0);
delete from auth.users where id = :'a';
select t.igual('...e depois de remover o login nao sobra nenhum identificador', pg_temp.restos(:'ag_a'::text[])::numeric, 0);
select t.verdade('isolamento: os registros do outro vendedor ficam identicos', pg_temp.foto_de(:'b') = :'foto_b');

-- ---------------------------------------------------------------- 2) admin deletion
-- the admin routine deletes a fixed list of tables (none of the new ones) and then the login
delete from public.bank_saldos where user_id = :'e';
delete from public.bank_connections where user_id = :'e';
delete from public.profiles where user_id = :'e';
select t.verdade('exclusao pelo admin: antes de remover o login as tabelas novas ainda tem os registros', pg_temp.restos(:'ag_e'::text[]) > 0);
delete from auth.users where id = :'e';
select t.igual('...ao remover o login, somem todos, sem a rotina conhecer as tabelas novas', pg_temp.restos(:'ag_e'::text[])::numeric, 0);
select t.verdade('isolamento de novo', pg_temp.foto_de(:'b') = :'foto_b');

-- ---------------------------------------------------------------- 3) the login goes first (dashboard)
-- nobody ran any routine: only the auth user is removed
select pg_temp.foto_de(:'c') as foto_c \gset
delete from auth.users where id = :'d';
select t.igual('exclusao so do login (painel): os registros novos somem pela cascata', pg_temp.restos(array[:'d'])::numeric, 0);
select t.igual('...junto com os identificadores de conexao, Item e conta', pg_temp.restos(:'ag_d'::text[])::numeric, 0);
select t.verdade('isolamento: os outros dois vendedores ficam identicos', pg_temp.foto_de(:'b') = :'foto_b' and pg_temp.foto_de(:'c') = :'foto_c');

-- The test schema has no foreign key on bank_connections, so that vendor's origin rows are still
-- here. That is exactly the race "the mirror runs while an account is being deleted".
select public.of_espelho_atualizar() as rd \gset
select t.igual('corrida com a exclusao: o espelho nao recria nada de quem ja nao existe', pg_temp.restos(:'ag_d'::text[])::numeric, 0);
select t.verdade('...e registra o problema so pelo codigo e pela restricao',
  (select jsonb_array_length(problemas) = 2 and problemas -> 0 ->> 'problema' = '23503' and problemas -> 0 ->> 'restricao' = 'of_vinculos_user_id_fkey'
          and problemas -> 1 ->> 'restricao' = 'of_contas_user_id_fkey' from public.of_espelho_execucoes order by id desc limit 1));
-- in production these two go by their own foreign keys, together with the login
delete from public.bank_saldos where user_id = :'d';
delete from public.bank_connections where user_id = :'d';

-- ---------------------------------------------------------------- 4) nothing is kept anywhere
select t.igual('nao existe tabela nem gatilho de retencao neste PR',
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname ~ '^of_(retenc|retid)')::numeric
  + (select count(*) from pg_trigger g join pg_class k on k.oid = g.tgrelid where k.relnamespace = 'public'::regnamespace and k.relname like 'of\_%' and not g.tgisinternal)::numeric, 0);

-- ---------------------------------------------------------------- 5) afterwards
select public.of_espelho_atualizar() as rf \gset
select t.igual('rodar o espelho depois nao ressuscita ninguem: so os dois vendedores que ficaram', (select count(distinct user_id) from public.of_vinculos)::numeric, 2);
select t.verdade('...com os registros deles intactos', pg_temp.foto_de(:'b') = :'foto_b' and pg_temp.foto_de(:'c') = :'foto_c');
select t.igual('...e divergencia zero', (:'rf'::jsonb ->> 'divergencias')::numeric, 0);
