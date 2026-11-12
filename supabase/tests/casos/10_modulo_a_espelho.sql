-- Module A · A-PR1. The mirror copies what bank_connections and bank_saldos say into the new
-- records (link, account, consent, purpose) without touching any table that already existed,
-- without merging accounts and without deleting anything. Then it must answer "is this a sales
-- account?" exactly like the rule in force (banco_conta_de_venda).
create function pg_temp.con(p_user uuid, p_banco text, p_papel text, p_desde timestamptz default null,
                            p_auto boolean default false, p_status text default 'UPDATED', p_dono text default 'TITULAR FICTICIA')
returns uuid language sql as $$
  insert into public.bank_connections (user_id, item_id, institution_name, status, papel, papel_desde, papel_auto, dono_nome)
  values (p_user, 'item-' || gen_random_uuid(), p_banco, p_status, p_papel, p_desde, p_auto, p_dono) returning id $$;
create function pg_temp.conta(p_con uuid, p_nome text) returns text language sql as $$
  insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo)
  select 'acc-' || gen_random_uuid(), b.user_id, b.id, b.institution_name, p_nome, 0
    from public.bank_connections b where b.id = p_con returning conta_id $$;
-- Fingerprint of every table that existed before this PR (everything in public not named of_*).
create function pg_temp.foto() returns text language plpgsql as $$
declare r record; h text; tudo text := '';
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename not like 'of\_%' order by 1 loop
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.tablename) into h;
    tudo := tudo || r.tablename || ':' || h || ';';
  end loop;
  return md5(tudo);
end $$;
create function pg_temp.linhas_of() returns bigint language sql as $$
  select (select count(*) from public.of_vinculos) + (select count(*) from public.of_contas)
       + (select count(*) from public.of_vinculo_contas) + (select count(*) from public.of_consentimentos)
       + (select count(*) from public.of_finalidades) + (select count(*) from public.of_mudancas) $$;

begin;
select t.vendedor('Um banco so') as a \gset
select t.vendedor('Dois bancos') as b \gset
select t.vendedor('Sem papel') as c \gset
select t.vendedor('Apagou um') as d \gset
select t.vendedor('Reconectou tres vezes') as e \gset
select t.vendedor('Item com duas contas') as f \gset
select t.vendedor('Trabalho comeca amanha') as h \gset

select pg_temp.con(:'a', 'Nubank', 'trabalho', t.hora(10, '14:30'), true) as ca \gset
select pg_temp.conta(:'ca', 'Conta corrente');
select pg_temp.con(:'b', 'Nubank', 'trabalho', t.hora(5, '10:00')) as cb1 \gset
select pg_temp.conta(:'cb1', 'Conta corrente');
select pg_temp.con(:'b', 'Itau', 'pessoal', t.hora(5, '10:00')) as cb2 \gset
select pg_temp.conta(:'cb2', 'Conta corrente');
select pg_temp.con(:'c', 'Inter', null) as cc \gset
select pg_temp.con(:'d', 'Cora', 'trabalho', t.hora(30, '09:00'), false, 'deleted') as cd1 \gset
select pg_temp.con(:'d', 'Bradesco', 'pessoal', t.hora(3, '09:00')) as cd2 \gset
select pg_temp.con(:'e', 'Mercado Pago', 'trabalho', t.hora(20, '08:00'), true) as ce1 \gset
select pg_temp.conta(:'ce1', 'Conta Mercado Pago') as se1 \gset
select pg_temp.con(:'e', 'Mercado Pago', 'trabalho', t.hora(20, '08:00'), true) as ce2 \gset
select pg_temp.conta(:'ce2', 'Conta Mercado Pago');
select pg_temp.con(:'e', 'Mercado Pago', 'trabalho', t.hora(20, '08:00'), true) as ce3 \gset
select pg_temp.conta(:'ce3', 'Conta Mercado Pago');
select pg_temp.con(:'f', 'Santander', 'trabalho', t.hora(8, '11:00')) as cf \gset
select pg_temp.conta(:'cf', 'Conta corrente') as sf1 \gset
select pg_temp.conta(:'cf', 'Cartao de credito') as sf2 \gset
select pg_temp.con(:'h', 'C6', 'trabalho', now() + interval '1 day') as ch1 \gset
select pg_temp.con(:'h', 'PicPay', 'pessoal', t.hora(2, '09:00')) as ch2 \gset
commit;

select pg_temp.foto() as antes \gset
select public.of_espelho_atualizar() as r1 \gset

-- ---- one link per connection, nothing merged
select t.igual('um vinculo por conexao', (select count(*) from public.of_vinculos)::numeric, (select count(*) from public.bank_connections)::numeric);
select t.igual('todo vinculo aponta para a conexao de origem, com o mesmo vendedor e o mesmo Item',
  (select count(*) from public.of_vinculos v join public.bank_connections b on b.id = v.origem_conexao_id and b.user_id = v.user_id and b.item_id = v.item_id)::numeric,
  (select count(*) from public.bank_connections)::numeric);
select t.igual('conexao apagada vira vinculo removido (e continua guardada)', (select count(*) from public.of_vinculos where estado = 'removido')::numeric, 1);
select t.igual('as demais ficam ativas', (select count(*) from public.of_vinculos where estado = 'ativo')::numeric, 11);
select t.igual('uma conta por linha de saldo', (select count(*) from public.of_contas)::numeric, (select count(*) from public.bank_saldos)::numeric);
select t.igual('nenhuma conta e dada como identificada', (select count(*) from public.of_contas where identidade <> 'nao_identificada' or identidade_chave is not null)::numeric, 0);
select t.igual('nenhum tipo de conta e inventado', (select count(*) from public.of_contas where tipo <> 'desconhecido')::numeric, 0);
select t.igual('tres reconexoes do mesmo banco: tres vinculos', (select count(*) from public.of_vinculos where user_id = :'e')::numeric, 3);
select t.igual('...e tres contas, nenhuma fundida', (select count(*) from public.of_contas where user_id = :'e')::numeric, 3);
select t.igual('Item com duas contas: um vinculo', (select count(*) from public.of_vinculos where user_id = :'f')::numeric, 1);
select t.igual('...duas contas ligadas a ele', (select count(*) from public.of_vinculo_contas l join public.of_vinculos v on v.id = l.vinculo_id where v.user_id = :'f' and l.ate is null)::numeric, 2);

-- ---- consent is never deduced
select t.igual('todo vinculo nasce com consentimento nao_informado',
  (select count(*) from public.of_consentimentos where estado = 'nao_informado' and confirmado_em is null)::numeric, (select count(*) from public.of_vinculos)::numeric);

-- ---- purpose inherited from the old role
select t.igual('finalidade: trabalho', (select count(*) from public.of_finalidades where vale_ate is null and finalidade = 'trabalho')::numeric, 8);
select t.igual('finalidade: pessoal', (select count(*) from public.of_finalidades where vale_ate is null and finalidade = 'pessoal')::numeric, 3);
select t.igual('finalidade: nao definida (conexao sem papel)', (select count(*) from public.of_finalidades where vale_ate is null and finalidade = 'nao_definida')::numeric, 1);
select t.verdade('papel automatico: a finalidade vale desde o comeco do mes, como na regra atual',
  (select f.vale_desde = (date_trunc('month', t.hora(10, '14:30') at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
     from public.of_finalidades f join public.of_vinculos v on v.id = f.vinculo_id where v.origem_conexao_id = :'ca' and f.vale_ate is null));
select t.verdade('papel escolhido a mao: vale desde o instante exato',
  (select f.vale_desde = t.hora(5, '10:00') from public.of_finalidades f join public.of_vinculos v on v.id = f.vinculo_id where v.origem_conexao_id = :'cb1' and f.vale_ate is null));
select t.verdade('trabalho que comeca amanha: hoje ainda nao e conta de venda',
  not (select public.of_vinculo_conta_de_venda(v.id, now()) from public.of_vinculos v where v.origem_conexao_id = :'ch1'));
select t.verdade('...e passa a ser no instante em que comeca',
  (select public.of_vinculo_conta_de_venda(v.id, now() + interval '1 day 1 second') from public.of_vinculos v where v.origem_conexao_id = :'ch1'));
select t.verdade('conta pessoal que sobrou sozinha e conta de venda (regra atual preservada)',
  (select public.of_vinculo_conta_de_venda(v.id, now()) from public.of_vinculos v where v.origem_conexao_id = :'cd2'));

-- ---- same answer as the rule in force
select t.igual('conta de venda: divergencia zero contra banco_conta_de_venda', (select count(*) from public.of_espelho_conferir())::numeric, 0);
select t.igual('a execucao registra divergencia zero', (:'r1'::jsonb ->> 'divergencias')::numeric, 0);
select t.igual('...e nenhum problema', (:'r1'::jsonb ->> 'problemas')::numeric, 0);
-- what a later step will write when the vendor says "I also use it for personal expenses"
update public.of_finalidades f set finalidade = 'misto', origem = 'vendedor' from public.of_vinculos v where v.id = f.vinculo_id and v.origem_conexao_id = :'cb1' and f.vale_ate is null;
select t.igual('uso misto responde ao contrato antigo igual a trabalho', (select count(*) from public.of_espelho_conferir())::numeric, 0);

-- ---- duplicates are reported, never removed
select t.igual('relatorio: um grupo de conexoes possivelmente duplicadas', (select count(*) from public.of_espelho_duplicadas())::numeric, 1);
select t.igual('...com as tres conexoes', (select qtd from public.of_espelho_duplicadas())::numeric, 3);
select t.igual('relatorio em numeros confere', (public.of_espelho_relatorio() ->> 'conexoes_em_grupos_duplicados')::numeric, 3);
select t.igual('relatorio: vinculos sem conta lida', (public.of_espelho_relatorio() ->> 'vinculos_sem_conta')::numeric, 5);
select t.igual('relatorio: vinculos com varias contas', (public.of_espelho_relatorio() ->> 'vinculos_com_varias_contas')::numeric, 1);

-- ---- nothing that existed before was written
select t.verdade('nenhuma tabela que ja existia mudou', pg_temp.foto() = :'antes');

-- ---- idempotent
select pg_temp.linhas_of() as n1 \gset
select public.of_espelho_atualizar() as r2 \gset
select t.igual('rodar de novo sem nada ter mudado nao grava nada', pg_temp.linhas_of()::numeric, :n1);
select t.verdade('finalidade escolhida pelo vendedor nao e sobrescrita pelo espelho',
  (select f.finalidade = 'misto' from public.of_finalidades f join public.of_vinculos v on v.id = f.vinculo_id where v.origem_conexao_id = :'cb1' and f.vale_ate is null));
select t.igual('...so o registro da execucao', (select count(*) from public.of_espelho_execucoes)::numeric, 2);
select t.igual('...e nada novo no resumo', ((:'r2'::jsonb ->> 'vinculos_novos')::int + (:'r2'::jsonb ->> 'contas_novas')::int + (:'r2'::jsonb ->> 'finalidades_novas')::int
  + (:'r2'::jsonb ->> 'finalidades_trocadas')::int + (:'r2'::jsonb ->> 'elos_abertos')::int + (:'r2'::jsonb ->> 'elos_fechados')::int)::numeric, 0);

-- ---- one run at a time
begin;
select public.of_espelho_atualizar() as r3 \gset
select t.verdade('a execucao segura uma trava ate o fim da transacao',
  (select count(*) > 0 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted));
commit;

-- ---- what changes in the origin is followed, and the past is kept
update public.bank_connections set papel = 'trabalho', papel_desde = now(), papel_auto = false where id = :'cb2';
update public.bank_connections set status = 'deleted' where id = :'ca';
update public.bank_connections set pausado_em = now() where id = :'cc';
delete from public.bank_saldos where conta_id = :'se1';
delete from public.bank_connections where id = :'ce1';
-- the same Item comes back under a new connection row (what the webhook "self-heal" does)
select item_id as item_f from public.bank_connections where id = :'cf' \gset
select id as vinc_f from public.of_vinculos where origem_conexao_id = :'cf' \gset
delete from public.bank_saldos where bank_connection_id = :'cf';
delete from public.bank_connections where id = :'cf';
insert into public.bank_connections (user_id, item_id, institution_name, status, papel, papel_desde)
values (:'f', :'item_f', 'Santander', 'UPDATED', 'trabalho', t.hora(8, '11:00')) returning id as cf_novo \gset
insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo) values (:'sf1', :'f', :'cf_novo', 'Santander', 'Conta corrente', 0), (:'sf2', :'f', :'cf_novo', 'Santander', 'Cartao de credito', 0);
select count(*) as vinc_antes from public.of_vinculos \gset
select count(*) as contas_antes from public.of_contas \gset
select public.of_espelho_atualizar() as r4 \gset

select t.igual('troca de papel: a finalidade antiga e encerrada, nao apagada',
  (select count(*) from public.of_finalidades f join public.of_vinculos v on v.id = f.vinculo_id where v.origem_conexao_id = :'cb2' and f.finalidade = 'pessoal' and f.vale_ate is not null)::numeric, 1);
select t.igual('...e a nova passa a valer',
  (select count(*) from public.of_finalidades f join public.of_vinculos v on v.id = f.vinculo_id where v.origem_conexao_id = :'cb2' and f.finalidade = 'trabalho' and f.vale_ate is null)::numeric, 1);
select t.verdade('conexao marcada como apagada: vinculo removido, com o motivo guardado',
  (select v.estado = 'removido' and exists (select 1 from public.of_mudancas m where m.vinculo_id = v.id and m.de = 'ativo' and m.para = 'removido' and m.motivo = 'conexao_mudou')
     from public.of_vinculos v where v.origem_conexao_id = :'ca'));
select t.verdade('conexao pausada: vinculo pausado', (select estado = 'pausado' from public.of_vinculos where origem_conexao_id = :'cc'));
select t.verdade('linha de origem apagada de vez: o vinculo fica, como removido',
  (select estado = 'removido' and estado_motivo = 'origem_apagada' from public.of_vinculos where origem_conexao_id = :'ce1'));
select t.igual('...a conta dele tambem fica', (select count(*) from public.of_contas where origem_conta_id = :'se1')::numeric, 1);
select t.igual('...com o elo encerrado', (select count(*) from public.of_vinculo_contas l join public.of_contas k on k.id = l.conta_id where k.origem_conta_id = :'se1' and l.ate is not null)::numeric, 1);
select t.verdade('mesmo Item sob uma linha nova de conexao: e o mesmo vinculo', (select id = :'vinc_f' from public.of_vinculos where origem_conexao_id = :'cf_novo'));
select t.igual('...com as mesmas duas contas', (select count(*) from public.of_vinculo_contas where vinculo_id = :'vinc_f' and ate is null)::numeric, 2);
select t.igual('nenhum vinculo foi criado ou apagado nessas mudancas', (select count(*) from public.of_vinculos)::numeric, :vinc_antes);
select t.igual('nenhuma conta foi criada ou apagada', (select count(*) from public.of_contas)::numeric, :contas_antes);
select t.igual('depois das mudancas: divergencia zero de novo', (select count(*) from public.of_espelho_conferir())::numeric, 0);

-- ---- incomplete or inconsistent origin rows are counted and skipped, never guessed
insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo) values ('acc-orfa', :'c', gen_random_uuid(), 'Inter', 'Conta corrente', 0);
insert into public.bank_saldos (conta_id, user_id, bank_connection_id, banco, nome, saldo) values ('acc-de-outro', :'a', :'cc', 'Inter', 'Conta corrente', 0);
select public.of_espelho_atualizar() as r5 \gset
select t.igual('saldo de conexao que nao existe: conta registrada, sem elo', (:'r5'::jsonb ->> 'contas_sem_vinculo')::numeric, 1);
select t.igual('saldo de um vendedor em conexao de outro: conflito, sem elo', (:'r5'::jsonb ->> 'conflitos')::numeric, 1);
select t.igual('...nenhum elo aberto para essas duas', (select count(*) from public.of_vinculo_contas l join public.of_contas k on k.id = l.conta_id where k.origem_conta_id in ('acc-orfa', 'acc-de-outro') and l.ate is null)::numeric, 0);
select t.igual('o conflito fica descrito na execucao', (select jsonb_array_length(problemas) from public.of_espelho_execucoes order by id desc limit 1)::numeric, 1);
