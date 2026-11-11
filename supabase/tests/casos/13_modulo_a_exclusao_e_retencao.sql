-- Module A · A-PR1. When a vendor's account is deleted, nothing of theirs may stay in the new
-- records: no row, and no bank identifier (vendor id, connection id, Item id, provider account
-- id) anywhere, logs included. Checked for the two routines that delete accounts today:
--   * self-service: apagar_dados_do_usuario (sweeps every table with user_id), then the login;
--   * admin: a fixed list of tables that does NOT include the new ones, then the login.
-- The only exception is a retention registered beforehand, with a reason, a legal basis and an
-- end date: then a copy is kept apart, for that vendor only, until the retention ends.

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
create function pg_temp.restos(p_agulhas text[], p_com_retencao boolean default false) returns bigint language plpgsql as $$
declare r record; a text; n bigint; total bigint := 0;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'of\_%'
              and (p_com_retencao or tablename not in ('of_retencoes', 'of_retidos')) loop
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
create function pg_temp.linhas_de(p_user uuid) returns bigint language plpgsql as $$
declare r record; n bigint; total bigint := 0;
begin
  for r in select c.table_name from information_schema.columns c
            where c.table_schema = 'public' and c.column_name = 'user_id' and c.table_name like 'of\_%' loop
    execute format('select count(*) from public.%I x where x.user_id = $1', r.table_name) into n using p_user;
    total := total + n;
  end loop;
  return total;
end $$;
create function pg_temp.recusa(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

begin;
select t.vendedor('Sai pelo app') as a \gset
select t.vendedor('Fica') as b \gset
select t.vendedor('Sai com retencao') as c \gset
select t.vendedor('Sai com retencao vencida') as d \gset
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
select pg_temp.agulhas(:'c') as ag_c \gset
select pg_temp.agulhas(:'d') as ag_d \gset
select pg_temp.agulhas(:'e') as ag_e \gset
select array_agg(x) as ag_bancarias_c from unnest(:'ag_c'::text[]) x where x <> :'c' \gset
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
select t.igual('...e depois de remover o login nao sobra nenhum identificador', pg_temp.restos(:'ag_a'::text[], true)::numeric, 0);
select t.igual('...nada foi retido (nao havia retencao)', (select count(*) from public.of_retidos)::numeric, 0);
select t.verdade('isolamento: os registros do outro vendedor ficam identicos', pg_temp.foto_de(:'b') = :'foto_b');

-- ---------------------------------------------------------------- 2) admin deletion
-- the admin routine deletes a fixed list of tables (none of the new ones) and then the login
delete from public.bank_saldos where user_id = :'e';
delete from public.bank_connections where user_id = :'e';
delete from public.profiles where user_id = :'e';
select t.verdade('exclusao pelo admin: antes de remover o login as tabelas novas ainda tem os registros', pg_temp.restos(:'ag_e'::text[]) > 0);
delete from auth.users where id = :'e';
select t.igual('...ao remover o login, somem todos, sem a rotina conhecer as tabelas novas', pg_temp.restos(:'ag_e'::text[], true)::numeric, 0);
select t.verdade('isolamento de novo', pg_temp.foto_de(:'b') = :'foto_b');

-- ---------------------------------------------------------------- 3) retention in force
select t.verdade('retencao sem data de fim e recusada', pg_temp.recusa(format('select public.of_retencao_registrar(%L, ''motivo de teste bem descrito'', ''base de teste'', null, ''servidor'')', :'c')));
select t.verdade('retencao sem motivo de verdade e recusada', pg_temp.recusa(format('select public.of_retencao_registrar(%L, ''x'', ''base de teste'', now() + interval ''30 days'', ''servidor'')', :'c')));
select t.verdade('retencao com fim no passado e recusada', pg_temp.recusa(format('select public.of_retencao_registrar(%L, ''motivo de teste bem descrito'', ''base de teste'', now() - interval ''1 day'', ''servidor'')', :'c')));
select public.of_retencao_registrar(:'c', 'Contestacao de resultado em analise (dado de teste)', 'Base legal informada pelo responsavel (dado de teste)', now() + interval '90 days', 'servidor') as ret_c \gset
select pg_temp.linhas_de(:'c') as linhas_c \gset
select public.apagar_dados_do_usuario(:'c');
delete from auth.users where id = :'c';
select t.igual('com retencao: os registros vivos somem do mesmo jeito', pg_temp.restos(:'ag_c'::text[])::numeric, 0);
select t.igual('...e uma copia de cada um fica guardada a parte', (select count(*) from public.of_retidos where retencao_id = :ret_c)::numeric, :linhas_c);
select t.igual('...so desse vendedor', (select count(*) from public.of_retidos where titular_id <> :'c')::numeric, 0);
select t.igual('...a rotina de exclusao nao apaga a retencao nem o que ela guarda', (select count(*) from public.of_retencoes where id = :ret_c and encerrada_em is null)::numeric, 1);
select t.verdade('...a copia guarda o registro inteiro, de qual tabela veio e quando',
  (select count(distinct tabela) >= 6 and bool_and(registro ? 'user_id') and bool_and(guardado_em is not null) from public.of_retidos where retencao_id = :ret_c));
select t.verdade('isolamento: a retencao de um vendedor nao segura nada de outro', pg_temp.foto_de(:'b') = :'foto_b' and pg_temp.restos(pg_temp.agulhas(:'b'), true) = pg_temp.restos(pg_temp.agulhas(:'b')));
select t.igual('relatorio: uma retencao em vigor', (public.of_espelho_relatorio() ->> 'retencoes_em_vigor')::numeric, 1);
select public.of_retencao_encerrar(:ret_c, 'analise concluida') as apagados_c \gset
select t.igual('encerrar a retencao apaga tudo o que ela guardava', :apagados_c::numeric, :linhas_c);
select t.igual('...nenhum identificador bancario do vendedor sobra em lugar nenhum', pg_temp.restos(:'ag_bancarias_c'::text[], true)::numeric, 0);
select t.verdade('...e fica so o registro de que a retencao existiu, com motivo e encerramento',
  (select encerrada_em is not null and encerrada_motivo = 'analise concluida' from public.of_retencoes where id = :ret_c));

-- ---------------------------------------------------------------- 4) retention that already expired
select public.of_retencao_registrar(:'d', 'Retencao antiga ja vencida (dado de teste)', 'Base legal informada pelo responsavel (dado de teste)', now() + interval '1 day', 'servidor') as ret_d \gset
update public.of_retencoes set registrada_em = now() - interval '40 days', valida_ate = now() - interval '10 days' where id = :ret_d;
select public.apagar_dados_do_usuario(:'d');
delete from auth.users where id = :'d';
select t.igual('retencao vencida nao segura nada: exclusao completa', pg_temp.restos(:'ag_d'::text[])::numeric + (select count(*) from public.of_retidos)::numeric, 0);
select t.igual('relatorio aponta a retencao vencida que falta fechar', (public.of_espelho_relatorio() ->> 'retencoes_vencidas_a_expurgar')::numeric, 1);
select public.of_retencao_expurgar_vencidas();
select t.verdade('o expurgo fecha a retencao vencida', (select encerrada_motivo = 'prazo_vencido' from public.of_retencoes where id = :ret_d));

-- ---------------------------------------------------------------- 5) retention that expires AFTER the deletion
select t.vendedor('Retencao vence depois') as f \gset
select pg_temp.con(:'f', 'Santander') as cf \gset
select pg_temp.conta(:'cf', 'Conta corrente');
select public.of_espelho_atualizar();
select pg_temp.agulhas(:'f') as ag_f \gset
select array_agg(x) as ag_bancarias_f from unnest(:'ag_f'::text[]) x where x <> :'f' \gset
select public.of_retencao_registrar(:'f', 'Prazo curto de conservacao (dado de teste)', 'Base legal informada pelo responsavel (dado de teste)', now() + interval '1 day', 'servidor') as ret_f \gset
select public.apagar_dados_do_usuario(:'f');
delete from auth.users where id = :'f';
select t.verdade('retido enquanto a retencao vale', (select count(*) > 0 from public.of_retidos where retencao_id = :ret_f));
update public.of_retencoes set registrada_em = now() - interval '40 days', valida_ate = now() - interval '1 minute' where id = :ret_f;
select t.verdade('o expurgo apaga o que ficou retido alem do prazo', public.of_retencao_expurgar_vencidas() > 0);
select t.igual('...sem sobrar identificador bancario', pg_temp.restos(:'ag_bancarias_f'::text[], true)::numeric + (select count(*) from public.of_retidos)::numeric, 0);

-- ---------------------------------------------------------------- 6) afterwards
select public.of_espelho_atualizar() as rf \gset
select t.igual('rodar o espelho depois nao ressuscita ninguem: so o vendedor que ficou', (select count(distinct user_id) from public.of_vinculos)::numeric, 1);
select t.verdade('...com os registros dele intactos', pg_temp.foto_de(:'b') = :'foto_b');
select t.igual('...e divergencia zero', (:'rf'::jsonb ->> 'divergencias')::numeric, 0);
