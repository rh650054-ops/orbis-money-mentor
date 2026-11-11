-- Module A · A-PR1. Two promises that are not about data:
--   1) the rollback removes exactly what the migration created and leaves everything else as it was;
--   2) under Supabase's default grants (every new public table is granted to anon/authenticated),
--      no vendor, logged in or not, can read, write or run any of the new objects.
create function pg_temp.objetos_antigos() returns text language sql as $$
  select md5(coalesce(string_agg(o, ';' order by o), '')) from (
    select 'T:' || c.relname || ':' || c.relrowsecurity || ':' || coalesce((select string_agg(a.attname || a.atttypid::regtype::text, ',' order by a.attnum)
              from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '') as o
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not like 'of\_%'
    union all
    select 'F:' || p.proname || ':' || md5(pg_get_functiondef(p.oid)) from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname not like 'of\_%'
    union all
    select 'G:' || t.tgname || ':' || t.tgrelid::regclass::text from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relnamespace = 'public'::regnamespace and c.relname not like 'of\_%'
    union all
    select 'P:' || tablename || ':' || policyname from pg_policies where schemaname = 'public' and tablename not like 'of\_%'
  ) z $$;
create function pg_temp.dados_antigos() returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename not like 'of\_%' order by 1 loop
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.tablename) into h;
    tudo := tudo || r.tablename || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
create function pg_temp.objetos_of() returns integer language sql as $$
  select (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname like 'of\_%')::int
       + (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'of\_%')::int $$;
-- true when p_role is refused (permission denied) running p_sql
create function pg_temp.barrado(p_role text, p_sql text) returns boolean language plpgsql as $$
declare ok boolean := false;
begin
  execute format('set local role %I', p_role);
  begin execute p_sql; exception when insufficient_privilege then ok := true; end;
  reset role;
  return ok;
end $$;

begin;
select t.vendedor('Vendedora R') as u \gset
select t.conexao(:'u', 'Nubank', t.hora(20, '09:00')) as c1 \gset
select t.conexao(:'u', 'Itau', t.hora(10, '09:00')) as c2 \gset
insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo) values ('acc-r1', :'u', :'c1', 'Nubank', 'Conta corrente', 0), ('acc-r2', :'u', :'c2', 'Itau', 'Conta corrente', 0);
commit;
select public.of_espelho_atualizar();
select pg_temp.objetos_antigos() as objetos \gset
select pg_temp.dados_antigos() as dados \gset
select public.banco_conta_de_venda(:'c1', now()) as resposta_antes \gset

-- ---------------------------------------------------------------- 1) rollback rehearsal
select t.igual('antes do rollback: 11 tabelas of_ existem', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'of\_%')::numeric, 11);
select t.igual('...e 9 funcoes', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'of\_%')::numeric, 9);
select t.igual('...com chaves para o cadastro do usuario, todas em cascata', (select count(*) from pg_constraint where contype = 'f' and confrelid = 'auth.users'::regclass and confdeltype = 'c' and conrelid::regclass::text like '%of\_%')::numeric, 7);
\ir ../../modulo-a/rollback-a-pr1.sql
select t.igual('rollback: nao sobra nenhum objeto of_', pg_temp.objetos_of()::numeric, 0);
select t.igual('rollback: o cadastro de usuarios fica sem nenhuma chave ou gatilho apontando para ele', (select count(*) from pg_constraint where confrelid = 'auth.users'::regclass)::numeric + (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass)::numeric, 0);
select t.verdade('rollback: tabelas, funcoes, gatilhos e policies que ja existiam ficam identicos', pg_temp.objetos_antigos() = :'objetos');
select t.verdade('rollback: nenhum dado que ja existia mudou', pg_temp.dados_antigos() = :'dados');
select t.verdade('rollback: a regra atual continua respondendo igual', public.banco_conta_de_venda(:'c1', now()) = :'resposta_antes'::boolean);

-- ---------------------------------------------------------------- 2) apply again, the Supabase way
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
\ir ../../migrations/20261111170000_modulo_a_conexoes_espelho.sql
select t.verdade('reaplicar: nada do que ja existia mudou', pg_temp.objetos_antigos() = :'objetos');
select t.igual('reaplicar: nenhum gatilho de usuario e criado no cadastro (so os internos das chaves)', (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal)::numeric, 0);
select public.of_espelho_atualizar() as r \gset
select t.igual('o espelho e reconstruido do zero a partir da origem', (select count(*) from public.of_vinculos)::numeric, 2);
select t.igual('...com divergencia zero', (:'r'::jsonb ->> 'divergencias')::numeric, 0);
select t.verdade('...sem tocar no que ja existia', pg_temp.dados_antigos() = :'dados');

select t.igual('toda tabela nova tem RLS ligado', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'of\_%' and relrowsecurity)::numeric, 11);
select t.igual('nenhuma tabela nova tem policy', (select count(*) from pg_policies where schemaname = 'public' and tablename like 'of\_%')::numeric, 0);
select t.igual('anon e authenticated: nenhum privilegio em nenhuma tabela nova',
  (select count(*) from pg_class c cross join (values ('anon'), ('authenticated')) r(papel) cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate')) p(priv)
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'of\_%' and has_table_privilege(r.papel, c.oid, p.priv))::numeric, 0);
select t.igual('...nem nas sequencias',
  (select count(*) from pg_class c cross join (values ('anon'), ('authenticated')) r(papel)
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S' and c.relname like 'of\_%' and has_sequence_privilege(r.papel, c.oid, 'usage'))::numeric, 0);
select t.igual('...nem para executar as funcoes novas',
  (select count(*) from pg_proc p cross join (values ('anon'), ('authenticated')) r(papel)
    where p.pronamespace = 'public'::regnamespace and p.proname like 'of\_%' and has_function_privilege(r.papel, p.oid, 'execute'))::numeric, 0);
select t.igual('service_role executa as nove',
  (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'of\_%' and has_function_privilege('service_role', p.oid, 'execute'))::numeric, 9);

select t.logar(:'u');
select t.igual('vendedor logado tenta ler os proprios vinculos: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_vinculos')::numeric, -1);
select t.igual('...as proprias contas: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_contas')::numeric, -1);
select t.igual('...finalidades: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_finalidades')::numeric, -1);
select t.igual('...consentimentos: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_consentimentos')::numeric, -1);
select t.igual('...eventos: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_eventos')::numeric, -1);
select t.igual('...mudancas: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_mudancas')::numeric, -1);
select t.igual('...retencoes: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_retencoes')::numeric, -1);
select t.igual('...registros retidos: recusado', t.linhas_como('authenticated', :'u', 'select * from public.of_retidos')::numeric, -1);
select t.verdade('...nao consegue registrar nem encerrar uma retencao', pg_temp.barrado('authenticated', format('select public.of_retencao_registrar(%L, ''motivo de teste longo'', ''base de teste'', now() + interval ''1 day'', ''alguem'')', :'u')) and pg_temp.barrado('authenticated', 'select public.of_retencao_encerrar(1, ''motivo'')'));
select t.igual('visitante sem login: recusado', t.linhas_como('anon', :'u', 'select * from public.of_vinculos')::numeric, -1);
select t.verdade('vendedor logado nao consegue gravar', pg_temp.barrado('authenticated', 'update public.of_finalidades set finalidade = ''trabalho'''));
select t.verdade('...nem rodar o espelho', pg_temp.barrado('authenticated', 'select public.of_espelho_atualizar()'));
select t.verdade('...nem ver o relatorio de duplicadas', pg_temp.barrado('authenticated', 'select * from public.of_espelho_duplicadas()'));
select t.verdade('...nem perguntar pela conta de venda de um vinculo', pg_temp.barrado('authenticated', format('select public.of_vinculo_conta_de_venda(%L, now())', (select id from public.of_vinculos limit 1))));
select t.igual('o servidor le normalmente', t.linhas_como('service_role', :'u', 'select * from public.of_vinculos')::numeric, 2);
