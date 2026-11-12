-- Module A · A-PR3. The consent state of each link is calculated from the provider events the
-- webhook records (A-PR2), next to bank_connections.status and without touching it:
--   * same rules as the app (one list of cases for both implementations);
--   * a consulted state is applied only when the provider's date for it is not older than the one
--     already applied (A14); a failed consultation changes nothing; unknown values stay raw (A13);
--     UPDATED proves no consent (A12); link, consent and data are independent (A11); every change
--     keeps what the provider said, its date and the event it came from (A15);
--   * nothing that existed before changes; no vendor can run or read any of it.
\ir ../../migrations/20261112230000_modulo_a_estados_em_paralelo.sql
\set casos `cat supabase/modulo-a/estados-casos.json`

-- An event as pluggy-webhook stores it (A-PR2): chosen fields only, closed with what was consulted.
create function pg_temp.evento(
  p_user uuid, p_con uuid, p_status text, p_execucao text, p_data timestamptz,
  p_consulta text default 'ok', p_resultado text default 'lido', p_expira timestamptz default null,
  p_erro text default null, p_tipo text default 'item/updated')
returns bigint language sql as $$
  insert into public.of_eventos (provedor, user_id, evento_id, item_id, tipo, bruto, resultado)
  select 'pluggy', p_user, gen_random_uuid()::text, b.item_id, p_tipo,
         jsonb_build_object('evento', jsonb_build_object('event', p_tipo, 'itemId', b.item_id),
                            'consulta', p_consulta,
                            'consultado', case when p_consulta = 'ok' then jsonb_build_object(
                              'status', p_status, 'executionStatus', p_execucao, 'erro', p_erro,
                              'updatedAt', to_char(p_data at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                              'consentExpiresAt', case when p_expira is null then null
                                 else to_char(p_expira at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end) end),
         p_resultado
    from public.bank_connections b where b.id = p_con
  returning id $$;
create function pg_temp.cons(p_con uuid) returns text language sql as $$
  select c.estado from public.of_consentimentos c join public.of_vinculos v on v.id = c.vinculo_id where v.origem_conexao_id = p_con $$;
create function pg_temp.foto() returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename not like 'of\_%' order by 1 loop
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.tablename) into h;
    tudo := tudo || r.tablename || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
create function pg_temp.objetos_antigos() returns text language sql as $$
  select md5(coalesce(string_agg(o, ';' order by o), '')) from (
    select 'F:' || p.proname || ':' || md5(pg_get_functiondef(p.oid)) as o from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and p.proname not in ('of_consentimento_do_motivo', 'of_grupo_do_status', 'of_consentimento_do_estado',
                             'of_consentimento_pede_vendedor', 'of_estados_atualizar', 'of_estados_conferir', 'of_estados_relatorio')
    union all
    select 'T:' || c.relname || ':' || coalesce((select string_agg(a.attname || a.atttypid::regtype::text, ',' order by a.attnum)
              from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '')
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    union all
    select 'G:' || t.tgname || ':' || t.tgrelid::regclass::text from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  ) z $$;
create function pg_temp.barrado(p_role text, p_sql text) returns boolean language plpgsql as $$
declare ok boolean := false;
begin
  execute format('set local role %I', p_role);
  begin execute p_sql; exception when insufficient_privilege then ok := true; end;
  reset role;
  return ok;
end $$;

-- ---------------------------------------------------------------- 1) same rules as the app
select t.verdade('gemeos: a lista de casos foi carregada', jsonb_array_length(:'casos'::jsonb -> 'grupos') >= 20 and jsonb_array_length(:'casos'::jsonb -> 'consentimentos') >= 30);
select t.igual('gemeos: todo status cai no mesmo grupo que no app',
  (select count(*) from jsonb_array_elements(:'casos'::jsonb -> 'grupos') g
    where public.of_grupo_do_status(g ->> 'status') is distinct from g ->> 'grupo')::numeric, 0);
select t.igual('gemeos: todo estado consultado da o mesmo consentimento que no app',
  (select count(*) from jsonb_array_elements(:'casos'::jsonb -> 'consentimentos') c
    where public.of_consentimento_do_estado(c ->> 'status', c ->> 'execucao', c ->> 'erro', (c ->> 'expira')::timestamptz, (c ->> 'quando')::timestamptz)
          is distinct from c ->> 'consentimento')::numeric, 0);
select t.igual('gemeos: pede o vendedor exatamente nos mesmos consentimentos que o app',
  (select count(*) from jsonb_array_elements(:'casos'::jsonb -> 'consentimentos') c
    where public.of_consentimento_pede_vendedor(c ->> 'consentimento') is distinct from (c ->> 'pede_vendedor')::boolean)::numeric, 0);
select t.verdade('sem hora de referencia nao se conclui validade nenhuma', public.of_consentimento_do_estado('UPDATED', 'SUCCESS', null, now() + interval '1 day', null) = 'nao_informado');

-- ---------------------------------------------------------------- 2) scenario
begin;
select t.vendedor('Em dia') as a \gset
select t.vendedor('Nao terminou de autorizar') as b \gset
select t.vendedor('Evento atrasado') as c \gset
select t.vendedor('Consulta falhou') as d \gset
select t.vendedor('Status desconhecido') as e \gset
select t.vendedor('Validade explicita') as f \gset
select t.vendedor('Conexao nova, espelho velho') as g \gset
select t.vendedor('Removeu o banco') as h \gset
select t.vendedor('Tela pede, sem evento') as i \gset
select t.vendedor('Pausado') as j \gset
select t.vendedor('Outro vendedor') as z \gset

select t.conexao(:'a', 'Nubank', t.hora(20, '09:00')) as ca \gset
select t.conexao(:'b', 'Itau', t.hora(20, '09:00')) as cb \gset
select t.conexao(:'c', 'Inter', t.hora(20, '09:00')) as cc \gset
select t.conexao(:'d', 'Bradesco', t.hora(20, '09:00')) as cd \gset
select t.conexao(:'e', 'C6', t.hora(20, '09:00')) as ce \gset
select t.conexao(:'f', 'Santander', t.hora(20, '09:00')) as cf \gset
select t.conexao(:'h', 'Caixa', t.hora(20, '09:00'), 'deleted') as ch \gset
select t.conexao(:'i', 'PagBank', t.hora(20, '09:00'), 'USER_INPUT_TIMEOUT') as ci \gset
select t.conexao(:'j', 'Mercado Pago', t.hora(20, '09:00')) as cj \gset
update public.bank_connections set pausado_em = now() where id = :'cj';
commit;
select public.of_espelho_atualizar();
-- g: a connection made after the mirror ran (the mirror has not seen it yet)
select t.conexao(:'g', 'Sicoob', now()) as cg \gset
select pg_temp.foto() as antes \gset
select pg_temp.objetos_antigos() as objetos \gset

-- a: three healthy events
select pg_temp.evento(:'a', :'ca', 'UPDATED', 'SUCCESS', t.hora(0, '08:00')) as ea1 \gset
select pg_temp.evento(:'a', :'ca', 'UPDATING', 'TRANSACTIONS_IN_PROGRESS', t.hora(0, '08:05'));
select pg_temp.evento(:'a', :'ca', 'UPDATED', 'SUCCESS', t.hora(0, '08:06'));
-- b: healthy, then the authorisation times out
select pg_temp.evento(:'b', :'cb', 'UPDATED', 'SUCCESS', t.hora(1, '08:00'));
select pg_temp.evento(:'b', :'cb', 'OUTDATED', 'USER_INPUT_TIMEOUT', t.hora(0, '09:00'), p_resultado => 'sem_extrato', p_tipo => 'item/error') as eb2 \gset
-- c: the newer state arrives first; the older one arrives late
select pg_temp.evento(:'c', :'cc', 'OUTDATED', 'USER_AUTHORIZATION_REVOKED', t.hora(0, '10:00'), p_resultado => 'sem_extrato') as ec1 \gset
select pg_temp.evento(:'c', :'cc', 'UPDATED', 'SUCCESS', t.hora(0, '09:59')) as ec2 \gset
-- d: a vendor state, then a consultation that failed, then one for an Item that is gone
select pg_temp.evento(:'d', :'cd', 'LOGIN_ERROR', 'INVALID_CREDENTIALS', t.hora(0, '07:00'), p_resultado => 'sem_extrato');
select pg_temp.evento(:'d', :'cd', null, null, null, p_consulta => 'falhou', p_resultado => 'erro') as ed2 \gset
select pg_temp.evento(:'d', :'cd', null, null, null, p_consulta => 'item_nao_existe', p_resultado => 'sem_extrato', p_tipo => 'item/deleted') as ed3 \gset
-- e: a status nobody knows
select pg_temp.evento(:'e', :'ce', 'ALGO_NOVO', 'OUTRA_COISA', t.hora(0, '07:00'), p_resultado => 'sem_extrato');
-- f: explicit expiry in 30 days
select pg_temp.evento(:'f', :'cf', 'UPDATED', 'SUCCESS', t.hora(0, '07:00'), p_expira => now() + interval '30 days');
-- g: an event for the connection the mirror has not seen yet
select pg_temp.evento(:'g', :'cg', 'OUTDATED', 'USER_INPUT_TIMEOUT', t.hora(0, '07:00'), p_resultado => 'sem_extrato') as eg1 \gset
-- h: an event for a removed connection
select pg_temp.evento(:'h', :'ch', 'OUTDATED', 'USER_INPUT_TIMEOUT', t.hora(0, '07:00'), p_resultado => 'conexao_removida') as eh1 \gset
-- j: paused link, the provider asks for the vendor
select pg_temp.evento(:'j', :'cj', 'WAITING_USER_ACTION', null, t.hora(0, '07:00'), p_resultado => 'sem_extrato');
-- events that belong to nobody, to another vendor, or that the webhook never completed
insert into public.of_eventos (provedor, evento_id, tipo, bruto, resultado) values ('pluggy', gen_random_uuid()::text, 'connector/status_updated', '{"evento":{"event":"connector/status_updated","connectorId":"218","statusDoConector":"UNSTABLE"},"consulta":"nao_feita","consultado":null}', 'ignorado') returning id as esem \gset
select pg_temp.evento(:'z', :'ca', 'OUTDATED', 'USER_AUTHORIZATION_REVOKED', t.hora(0, '11:00')) as ez \gset
insert into public.of_eventos (provedor, evento_id, item_id, tipo, bruto) select 'pluggy', gen_random_uuid()::text, item_id, 'item/updated', '{"evento":{"event":"item/updated"}}' from public.bank_connections where id = :'ca' returning id as eaberto_novo \gset
insert into public.of_eventos (provedor, evento_id, item_id, tipo, bruto, chegou_em) select 'pluggy', gen_random_uuid()::text, item_id, 'item/updated', '{"evento":{"event":"item/updated"}}', now() - interval '1 hour' from public.bank_connections where id = :'ca' returning id as eaberto_velho \gset

select public.of_estados_atualizar() as r1 \gset

-- ---- A12: UPDATED proves nothing
select t.verdade('em dia: tres eventos saudaveis nao viram consentimento autorizado', pg_temp.cons(:'ca') = 'nao_informado');
select t.igual('...os tres foram aplicados', (select count(*) from public.of_eventos x join public.bank_connections b on b.item_id = x.item_id where b.id = :'ca' and x.aplicado and x.user_id = :'a')::numeric, 3);
select t.igual('...sem criar nenhuma mudanca (o estado nao mudou)', (select count(*) from public.of_mudancas m join public.of_vinculos v on v.id = m.vinculo_id where v.origem_conexao_id = :'ca' and m.campo = 'consentimento')::numeric, 0);
select t.verdade('...e o consentimento guarda a data do provedor do ultimo estado aplicado',
  (select c.confirmado_em = t.hora(0, '08:06') from public.of_consentimentos c join public.of_vinculos v on v.id = c.vinculo_id where v.origem_conexao_id = :'ca'));

-- ---- a vendor state, with its history (A15)
select t.verdade('nao terminou de autorizar: aguardando_vendedor', pg_temp.cons(:'cb') = 'aguardando_vendedor');
select t.igual('...uma mudanca registrada', (select count(*) from public.of_mudancas m join public.of_vinculos v on v.id = m.vinculo_id where v.origem_conexao_id = :'cb' and m.campo = 'consentimento')::numeric, 1);
select t.verdade('...com de/para, o que o provedor disse, a data do provedor, a fonte e o evento de origem',
  (select m.de = 'nao_informado' and m.para = 'aguardando_vendedor' and m.motivo = 'status=OUTDATED execucao=USER_INPUT_TIMEOUT'
          and m.provedor_em = t.hora(0, '09:00') and m.fonte = 'provedor' and m.evento_id = :eb2
     from public.of_mudancas m join public.of_vinculos v on v.id = m.vinculo_id where v.origem_conexao_id = :'cb' and m.campo = 'consentimento'));
select t.verdade('...a hora de chegada e a do evento ligado a mudanca',
  (select x.chegou_em is not null from public.of_mudancas m join public.of_eventos x on x.id = m.evento_id where m.evento_id = :eb2));
select t.verdade('...e o valor bruto fica no consentimento',
  (select c.estado_bruto = 'status=OUTDATED execucao=USER_INPUT_TIMEOUT' from public.of_consentimentos c join public.of_vinculos v on v.id = c.vinculo_id where v.origem_conexao_id = :'cb'));

-- ---- A14: a late event never takes the state back
select t.verdade('evento atrasado: o estado mais novo (revogado) fica', pg_temp.cons(:'cc') = 'revogado');
select t.verdade('...o evento mais novo foi aplicado', (select aplicado from public.of_eventos where id = :ec1));
select t.verdade('...o atrasado foi avaliado e nao aplicado', (select aplicado = false from public.of_eventos where id = :ec2));
select t.igual('...a execucao conta um estado mais antigo recusado', (:'r1'::jsonb ->> 'nao_aplicados_estado_mais_antigo')::numeric, 1);

-- ---- a failed consultation changes nothing
select t.verdade('consulta falhou: o estado anterior fica (credencial_invalida)', pg_temp.cons(:'cd') = 'credencial_invalida');
select t.verdade('...a tentativa fica registrada e nao aplicada', (select aplicado = false and bruto ->> 'consulta' = 'falhou' from public.of_eventos where id = :ed2));
select t.verdade('...Item que nao existe mais no provedor tambem nao muda o estado', (select aplicado = false from public.of_eventos where id = :ed3));

-- ---- A13: unknown stays raw, never a success
select t.verdade('status desconhecido: consentimento desconhecido', pg_temp.cons(:'ce') = 'desconhecido');
select t.verdade('...com o valor bruto guardado', (select c.estado_bruto = 'status=ALGO_NOVO execucao=OUTRA_COISA' from public.of_consentimentos c join public.of_vinculos v on v.id = c.vinculo_id where v.origem_conexao_id = :'ce'));

-- ---- explicit expiry
select t.verdade('validade explicita a 30 dias: autorizado', pg_temp.cons(:'cf') = 'autorizado');
select t.verdade('...com a validade guardada', (select c.valido_ate > now() + interval '29 days' from public.of_consentimentos c join public.of_vinculos v on v.id = c.vinculo_id where v.origem_conexao_id = :'cf'));

-- ---- events with nowhere to go
select t.verdade('conexao que o espelho ainda nao viu: o evento fica para a proxima execucao', (select aplicado is null from public.of_eventos where id = :eg1));
select t.igual('...e a execucao diz que esta aguardando o espelho', (:'r1'::jsonb ->> 'aguardando_o_espelho')::numeric, 1);
select t.verdade('conexao removida: o evento nao muda nada', (select aplicado = false from public.of_eventos where id = :eh1) and pg_temp.cons(:'ch') = 'nao_informado');
select t.verdade('evento sem vendedor nem Item: avaliado, nao aplicado', (select aplicado = false from public.of_eventos where id = :esem));
select t.verdade('evento com vendedor diferente do dono do vinculo: recusado, e o estado do dono nao muda', (select aplicado = false from public.of_eventos where id = :ez) and pg_temp.cons(:'ca') = 'nao_informado');
select t.igual('...contado como conflito, so com o tipo do problema', (:'r1'::jsonb ->> 'conflitos')::numeric, 1);
select t.verdade('registro que o webhook acabou de abrir: nao e tocado', (select aplicado is null from public.of_eventos where id = :eaberto_novo));
select t.verdade('registro aberto ha uma hora e nunca completado: dado como nao aplicado', (select aplicado = false from public.of_eventos where id = :eaberto_velho));

-- ---- A11: link and consent are independent
select t.verdade('vinculo pausado continua pausado, e o consentimento muda sozinho',
  (select v.estado = 'pausado' from public.of_vinculos v where v.origem_conexao_id = :'cj') and pg_temp.cons(:'cj') = 'aguardando_vendedor');
select t.igual('nenhum estado de vinculo foi escrito por esta rotina', (select count(*) from public.of_mudancas where campo = 'estado' and motivo <> 'espelho_inicial')::numeric, 0);

-- ---- nothing that existed before changed
select t.verdade('nenhuma tabela que ja existia mudou (status, vendas, ranking, tudo)', pg_temp.foto() = :'antes');
select t.verdade('nenhuma funcao, tabela ou gatilho que ja existia mudou', pg_temp.objetos_antigos() = :'objetos');
select t.verdade('o resumo da execucao nao carrega nenhum identificador', :'r1' !~ '[0-9a-f]{8}-[0-9a-f]{4}-');

-- ---- idempotent
select (select count(*) from public.of_mudancas) as mud_antes \gset
select (select md5(string_agg(c.vinculo_id::text || c.estado || coalesce(c.estado_bruto, '') || coalesce(c.confirmado_em::text, ''), '|' order by c.vinculo_id)) from public.of_consentimentos c) as cons_antes \gset
select public.of_estados_atualizar() as r2 \gset
select t.igual('rodar de novo: nenhum evento aplicado outra vez', (:'r2'::jsonb ->> 'eventos_aplicados')::numeric, 0);
select t.igual('...nenhuma mudanca nova', (select count(*) from public.of_mudancas)::numeric, :mud_antes);
select t.verdade('...nenhum consentimento alterado',
  (select md5(string_agg(c.vinculo_id::text || c.estado || coalesce(c.estado_bruto, '') || coalesce(c.confirmado_em::text, ''), '|' order by c.vinculo_id)) from public.of_consentimentos c) = :'cons_antes');

-- ---- the mirror catches up: the waiting event is applied
select public.of_espelho_atualizar();
select public.of_estados_atualizar() as r3 \gset
select t.verdade('depois do espelho, o evento que esperava e aplicado', (select aplicado from public.of_eventos where id = :eg1) and pg_temp.cons(:'cg') = 'aguardando_vendedor');
select t.igual('o espelho continua com divergencia zero contra a regra atual (conta de venda)', (select count(*) from public.of_espelho_conferir())::numeric, 0);

-- ---- time alone changes a consent with an explicit expiry
update public.of_consentimentos c set valido_ate = now() + interval '3 days' from public.of_vinculos v where v.id = c.vinculo_id and v.origem_conexao_id = :'cf';
select public.of_estados_atualizar();
select t.verdade('faltando 3 dias: expirando, sem evento nenhum', pg_temp.cons(:'cf') = 'expirando');
update public.of_consentimentos c set valido_ate = now() - interval '1 minute' from public.of_vinculos v where v.id = c.vinculo_id and v.origem_conexao_id = :'cf';
select public.of_estados_atualizar();
select t.verdade('passou da validade: expirado', pg_temp.cons(:'cf') = 'expirado');
select t.igual('...as duas mudancas ficam no historico, com a fonte "sistema"',
  (select count(*) from public.of_mudancas m join public.of_vinculos v on v.id = m.vinculo_id where v.origem_conexao_id = :'cf' and m.fonte = 'sistema' and m.motivo = 'validade_do_consentimento')::numeric, 2);
select t.verdade('um estado que depende do vendedor nao e trocado pela validade', pg_temp.cons(:'cb') = 'aguardando_vendedor');

-- ---------------------------------------------------------------- 3) the list of differences
create temp table div as select * from public.of_estados_conferir();
select t.igual('divergencia: o novo pede o vendedor e a tela nao (status ainda UPDATED)',
  (select count(*) from div where problema = 'novo_pede_o_vendedor_e_a_tela_nao' and conexao_id in (:'cb', :'cc', :'cd', :'cf', :'cg', :'cj'))::numeric, 6);
select t.verdade('...a linha traz o status da tela, o grupo dele e o consentimento novo',
  (select status_atual = 'UPDATED' and grupo_atual = 'em_dia' and consentimento = 'aguardando_vendedor' and com_evento from div where problema = 'novo_pede_o_vendedor_e_a_tela_nao' and conexao_id = :'cb'));
select t.verdade('divergencia: a tela pede o vendedor e o novo nao — marcada como "sem evento"',
  (select not com_evento and consentimento = 'nao_informado' and status_atual = 'USER_INPUT_TIMEOUT' from div where problema = 'tela_pede_o_vendedor_e_o_novo_nao' and conexao_id = :'ci'));
select t.igual('divergencia: consentimento desconhecido aparece (alarme do A13)', (select count(*) from div where problema = 'consentimento_desconhecido' and conexao_id = :'ce')::numeric, 1);
select t.igual('divergencia: o Item nao existe mais no provedor e a conexao segue viva', (select count(*) from div where problema = 'item_nao_existe_no_provedor' and conexao_id = :'cd')::numeric, 1);
select t.igual('quem esta em dia nos dois lados nao aparece', (select count(*) from div where conexao_id = :'ca')::numeric, 0);
select t.igual('conexao removida nao entra na lista', (select count(*) from div where conexao_id = :'ch')::numeric, 0);
-- when the screen catches up, the difference goes away
update public.bank_connections set status = 'USER_INPUT_TIMEOUT' where id = :'cb';
select t.igual('quando a tela passa a pedir o vendedor tambem, a divergencia some', (select count(*) from public.of_estados_conferir() where conexao_id = :'cb')::numeric, 0);
select t.verdade('o relatorio traz so numeros', (select public.of_estados_relatorio()::text !~ '[0-9a-f]{8}-[0-9a-f]{4}-'));
select t.igual('...e conta as mesmas divergencias da lista', (public.of_estados_relatorio() ->> 'divergencias')::numeric, (select count(*) from public.of_estados_conferir())::numeric);

-- ---------------------------------------------------------------- 4) access and deletion
select t.igual('anon e authenticated nao executam nenhuma das sete funcoes',
  (select count(*) from pg_proc p cross join (values ('anon'), ('authenticated')) r(papel)
    where p.pronamespace = 'public'::regnamespace and has_function_privilege(r.papel, p.oid, 'execute')
      and p.proname in ('of_consentimento_do_motivo', 'of_grupo_do_status', 'of_consentimento_do_estado', 'of_consentimento_pede_vendedor', 'of_estados_atualizar', 'of_estados_conferir', 'of_estados_relatorio'))::numeric, 0);
select t.igual('service_role executa as sete',
  (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('service_role', p.oid, 'execute')
      and p.proname in ('of_consentimento_do_motivo', 'of_grupo_do_status', 'of_consentimento_do_estado', 'of_consentimento_pede_vendedor', 'of_estados_atualizar', 'of_estados_conferir', 'of_estados_relatorio'))::numeric, 7);
select t.igual('nenhuma e security definer', (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.proname like 'of\_%')::numeric, 0);
select t.verdade('vendedor logado nao roda o calculo', pg_temp.barrado('authenticated', 'select public.of_estados_atualizar()'));
select t.verdade('...nem le a lista de divergencias', pg_temp.barrado('authenticated', 'select * from public.of_estados_conferir()'));
select t.verdade('...nem o relatorio', pg_temp.barrado('anon', 'select public.of_estados_relatorio()'));

-- (in production the connection goes with the account too; this test schema has no such key)
delete from public.bank_connections where user_id = :'b';
delete from auth.users where id = :'b';
select t.igual('excluir a conta leva o consentimento, o historico e os eventos do vendedor',
  (select count(*) from public.of_consentimentos where user_id = :'b')::numeric + (select count(*) from public.of_mudancas where user_id = :'b')::numeric
  + (select count(*) from public.of_eventos where user_id = :'b')::numeric, 0);

-- ---------------------------------------------------------------- 5) rollback rehearsal
select (select count(*) from public.of_consentimentos) as cons_n \gset
\ir ../../modulo-a/rollback-a-pr3.sql
select t.igual('rollback: as sete funcoes saem', (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('of_consentimento_do_motivo', 'of_grupo_do_status', 'of_consentimento_do_estado', 'of_consentimento_pede_vendedor', 'of_estados_atualizar', 'of_estados_conferir', 'of_estados_relatorio'))::numeric, 0);
select t.igual('rollback: as cinco funcoes do A-PR1 ficam', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'of\_%')::numeric, 5);
select t.verdade('rollback: nada do que ja existia muda', pg_temp.objetos_antigos() = :'objetos');
select t.igual('rollback: os registros gravados ficam onde estao', (select count(*) from public.of_consentimentos)::numeric, :cons_n);
select t.igual('rollback: o espelho continua funcionando', (public.of_espelho_atualizar() ->> 'problemas')::numeric, 0);
\ir ../../migrations/20261112230000_modulo_a_estados_em_paralelo.sql
select t.igual('reaplicar e rodar: nada e aplicado de novo (tudo ja estava avaliado)', (public.of_estados_atualizar() ->> 'eventos_aplicados')::numeric, 0);
