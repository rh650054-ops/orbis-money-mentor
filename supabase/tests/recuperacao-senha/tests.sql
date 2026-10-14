-- Testes da migração 20261011140000 (rodar depois do run-setup.sh)
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.ok(cond boolean, nome text) returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', nome; end if;
  return 'PASS  ' || nome;
end $$;

-- ===== 1. falsificação de email_verificado_em pelo app =====
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c"}';
update public.profiles set email_verificado_em = now(), email_verificado_por = 'codigo' where user_id = auth.uid();
reset role; reset request.jwt.claims;
select pg_temp.ok((select email_verificado_em is null and email_verificado_por is null from profiles where cpf = '39053344705'), 'app nao carimba o proprio e-mail (update)');

set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}';
update public.profiles set email_verificado_legado_em = null where user_id = auth.uid();
reset role; reset request.jwt.claims;
select pg_temp.ok((select email_verificado_legado_em is not null from profiles where cpf = '11144477735'), 'historico e imutavel');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000e1"}';
insert into public.profiles (user_id, cpf, email, email_verificado_em, email_verificado_por, email_verificado_legado_em)
values (auth.uid(), '74682489000', 'novo@ex.com', now(), 'codigo', now());
reset role; reset request.jwt.claims;
select pg_temp.ok((select email_verificado_em is null and email_verificado_por is null and email_verificado_legado_em is null from profiles where cpf = '74682489000'), 'cadastro nao nasce confirmado (insert pelo app)');

set request.jwt.claims = '{"role":"service_role"}';
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e2');
insert into public.profiles (user_id, cpf, email, email_verificado_em, email_verificado_por)
values ('00000000-0000-0000-0000-0000000000e2', '05212301072', 'srv@ex.com', now(), 'codigo');
reset request.jwt.claims;
select pg_temp.ok((select email_verificado_em is null from profiles where cpf = '05212301072'), 'cadastro nao nasce confirmado (insert pelo servidor)');

-- funcao do furo virou no-op
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c"}';
select public.email_confirmar_por_recuperacao();
reset role; reset request.jwt.claims;
select pg_temp.ok((select email_verificado_em is null from profiles where cpf = '39053344705'), 'email_confirmar_por_recuperacao nao confirma mais');

-- app nao alcanca as funcoes nem a tabela
do $$
declare f text; n int := 0;
begin
  foreach f in array array[
    'select public.senha_desafio_criar(gen_random_uuid(), ''52998224725'')',
    'select public.senha_desafio_verificar(gen_random_uuid(), ''123456'')',
    'select public.senha_troca_consumir(''x'')',
    'select public.senha_troca_concluir(gen_random_uuid())',
    'select public.email_confirmar_codigo(gen_random_uuid(), ''x'')',
    'select public.email_confirmar_link(''x'')',
    'select * from public.senha_desafios',
    'select * from public.email_codigos'] loop
    begin
      execute 'set local role authenticated';
      execute f;
      raise exception 'FALHOU: authenticated executou %', f;
    exception when insufficient_privilege then n := n + 1;
    end;
    execute 'reset role';
  end loop;
  if n <> 8 then raise exception 'FALHOU: permissoes (%)', n; end if;
end $$;
reset role;
select pg_temp.ok(true, 'app nao executa funcoes do servidor nem le as tabelas (8/8 negados)');

-- ===== 2. criar desafio: so com e-mail confirmado COM prova =====
select pg_temp.ok((select count(*) = 0 from public.senha_desafio_criar(gen_random_uuid(), '39053344705')), 'CPF sem e-mail confirmado: nao cria');
select pg_temp.ok((select count(*) = 0 from public.senha_desafio_criar(gen_random_uuid(), '11144477735')), 'CPF com carimbo legado sem prova: nao cria');
select pg_temp.ok((select count(*) = 0 from public.senha_desafio_criar(gen_random_uuid(), '00000000191')), 'CPF inexistente: nao cria');

select gen_random_uuid() as d1 \gset
select codigo as c1, email as e1 from public.senha_desafio_criar(:'d1', '529.982.247-25') \gset
select pg_temp.ok(:'c1' ~ '^[0-9]{6}$' and :'e1' = 'ana@ex.com', 'CPF confirmado (com mascara): cria desafio com codigo de 6 digitos');
select pg_temp.ok((select codigo_hash <> :'c1' and length(codigo_hash) = 64 and expira_em between now() + interval '14 minutes' and now() + interval '15 minutes' from senha_desafios where id = :'d1'), 'so o hash e gravado, validade 15 min');

-- ===== 3. codigo errado x5 → bloqueia =====
select (select string_agg(status, ',') from (
  select (public.senha_desafio_verificar(:'d1', case when :'c1' = '000000' then '111111' else '000000' end)).status
  from generate_series(1, 5)) s) as erros \gset
select pg_temp.ok(:'erros' = 'errado,errado,errado,errado,bloqueado', '5 erros: errado x4 e bloqueia no 5o (' || :'erros' || ')');
select pg_temp.ok((select status = 'invalido' from public.senha_desafio_verificar(:'d1', :'c1')), 'depois de bloquear, nem o codigo certo vale');
select pg_temp.ok((select status = 'invalido' from public.senha_desafio_verificar(:'d1', 'abc')), 'formato invalido nao quebra');

-- ===== 4. expirado =====
select gen_random_uuid() as d2 \gset
select codigo as c2 from public.senha_desafio_criar(:'d2', '52998224725') \gset
update senha_desafios set expira_em = now() - interval '1 second' where id = :'d2';
select pg_temp.ok((select status = 'expirado' from public.senha_desafio_verificar(:'d2', :'c2')), 'codigo expirado recusado');

-- ===== 5. reenvio invalida o anterior =====
select gen_random_uuid() as d3 \gset
select codigo as c3 from public.senha_desafio_criar(:'d3', '52998224725') \gset
select gen_random_uuid() as d4 \gset
select codigo as c4 from public.senha_desafio_criar(:'d4', '52998224725') \gset
select pg_temp.ok((select status = 'invalido' from public.senha_desafio_verificar(:'d3', :'c3')), 'reenviar invalida o codigo anterior');

-- ===== 6. certo → token; reuso recusado; troca uso unico; sessoes derrubadas =====
select status as s4, troca_token as t4 from public.senha_desafio_verificar(:'d4', :'c4') \gset
select pg_temp.ok(:'s4' = 'ok' and length(:'t4') = 64, 'codigo certo devolve token de troca');
select pg_temp.ok((select troca_hash <> :'t4' from senha_desafios where id = :'d4'), 'token guardado so como hash');
select pg_temp.ok((select status = 'invalido' from public.senha_desafio_verificar(:'d4', :'c4')), 'codigo reutilizado recusado');
select pg_temp.ok((select count(*) = 0 from public.senha_troca_consumir((case when left(:'t4', 1) = '0' then '1' else '0' end) || substr(:'t4', 2))), 'token adulterado recusado');
select desafio_id as td from public.senha_troca_consumir(:'t4') \gset
select pg_temp.ok(:'td' = :'d4', 'token consumido uma vez');
select pg_temp.ok((select count(*) = 0 from public.senha_troca_consumir(:'t4')), 'token reutilizado recusado');
select public.senha_troca_reabrir(:'d4');
select pg_temp.ok((select count(*) = 1 from public.senha_troca_consumir(:'t4')), 'Auth recusou a senha → token reaberto dentro dos 10 min');
select public.senha_troca_concluir(:'d4');
select public.senha_troca_reabrir(:'d4');
select pg_temp.ok((select count(*) = 0 from public.senha_troca_consumir(:'t4')), 'depois de concluir nao reabre');
select pg_temp.ok((select count(*) = 0 from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a')
              and (select count(*) = 0 from auth.refresh_tokens where user_id = '00000000-0000-0000-0000-00000000000a'), 'sessoes e refresh tokens antigos derrubados');

-- token expirado
select gen_random_uuid() as d5 \gset
select codigo as c5 from public.senha_desafio_criar(:'d5', '52998224725') \gset
select troca_token as t5 from public.senha_desafio_verificar(:'d5', :'c5') \gset
update senha_desafios set troca_expira_em = now() - interval '1 second' where id = :'d5';
select pg_temp.ok((select count(*) = 0 from public.senha_troca_consumir(:'t5')), 'token de troca expirado recusado');

-- ===== 7. troca de e-mail durante a recuperacao =====
update senha_desafios set criado_em = criado_em - interval '2 hours';  -- zera o teto/hora pros proximos
select gen_random_uuid() as d6 \gset
select codigo as c6 from public.senha_desafio_criar(:'d6', '52998224725') \gset
select gen_random_uuid() as d7 \gset
-- (d7 fica com token emitido antes da troca)
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}';
update public.profiles set email = 'Outra@Ex.com' where user_id = auth.uid();
reset role; reset request.jwt.claims;
select pg_temp.ok((select email = 'outra@ex.com' and email_verificado_em is null and email_verificado_por is null from profiles where cpf = '52998224725'), 'trocar e-mail tira a confirmacao');
select pg_temp.ok((select status = 'invalido' from public.senha_desafio_verificar(:'d6', :'c6')), 'trocar e-mail invalida o desafio pendente');
select pg_temp.ok((select count(*) = 0 from public.senha_desafio_criar(gen_random_uuid(), '52998224725')), 'sem confirmacao nova, CPF nao recebe codigo');

-- mesmo e-mail com caixa diferente NAO tira a confirmacao
update profiles set email_verificado_em = now(), email_verificado_por = 'codigo' where cpf = '52998224725';  -- (servidor)
set role authenticated;
set request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}';
update public.profiles set email = ' OUTRA@ex.com ', nickname = 'Ana B' where user_id = auth.uid();
reset role; reset request.jwt.claims;
select pg_temp.ok((select email_verificado_em is not null from profiles where cpf = '52998224725'), 'mesmo e-mail (so caixa/espaco) mantem a confirmacao');

-- token emitido e e-mail trocado antes de usar
update senha_desafios set criado_em = criado_em - interval '2 hours';
select codigo as c7 from public.senha_desafio_criar(:'d7', '52998224725') \gset
select troca_token as t7 from public.senha_desafio_verificar(:'d7', :'c7') \gset
set request.jwt.claims = '{"role":"service_role"}';
update public.profiles set email = 'terceira@ex.com' where cpf = '52998224725';
reset request.jwt.claims;
select pg_temp.ok((select count(*) = 0 from public.senha_troca_consumir(:'t7')), 'trocar e-mail (ate pelo servidor) invalida token de troca ja emitido');

-- ===== 8. confirmacao de e-mail (codigo e link) =====
-- codigo de confirmacao pro Caio
insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo)
values ('00000000-0000-0000-0000-00000000000c', 'caio@ex.com', 'HASH-OK', now() + interval '15 minutes', 'codigo')
on conflict (user_id) do update set email = excluded.email, codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tipo = 'codigo', tentativas = 0;
select pg_temp.ok(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'errado') = 'errado', 'confirmacao: codigo errado');
select pg_temp.ok(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'HASH-OK') = 'ok', 'confirmacao: codigo certo confirma');
select pg_temp.ok((select email_verificado_por = 'codigo' and email = 'caio@ex.com' from profiles where cpf = '39053344705'), 'confirmacao grava a prova (codigo)');
select pg_temp.ok(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'HASH-OK') = 'sem_codigo', 'confirmacao: codigo de uso unico');

-- 5 tentativas na confirmacao
update profiles set email = 'caio2@ex.com' where cpf = '39053344705';
insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo) values ('00000000-0000-0000-0000-00000000000c', 'caio2@ex.com', 'H2', now() + interval '15 minutes', 'codigo');
select (select string_agg(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'x'), ',') from generate_series(1, 6)) as ce \gset
select pg_temp.ok(:'ce' = 'errado,errado,errado,errado,bloqueado,bloqueado', 'confirmacao: bloqueia em 5 (' || :'ce' || ')');
select pg_temp.ok(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'H2') = 'sem_codigo', 'confirmacao: bloqueado nao aceita o certo');

-- link antigo NAO restaura e-mail substituido
insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo) values ('00000000-0000-0000-0000-00000000000c', 'caio2@ex.com', 'LINK1', now() + interval '24 hours', 'link');
update profiles set email = 'caio3@ex.com' where cpf = '39053344705';
select pg_temp.ok(public.email_confirmar_link('LINK1') = 'invalido', 'link de e-mail substituido nao vale (pendencia apagada na troca)');
select pg_temp.ok((select email = 'caio3@ex.com' and email_verificado_em is null from profiles where cpf = '39053344705'), 'e-mail substituido nao volta e nao confirma');
-- mesmo se a linha sobrevivesse (defesa em profundidade): e-mail diferente do atual
insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo) values ('00000000-0000-0000-0000-00000000000c', 'caio2@ex.com', 'LINK2', now() + interval '24 hours', 'link');
select pg_temp.ok(public.email_confirmar_link('LINK2') = 'email_mudou', 'link preso ao e-mail atual (email_mudou)');
select pg_temp.ok((select email = 'caio3@ex.com' and email_verificado_em is null from profiles where cpf = '39053344705'), 'link nao sobrescreve o e-mail');
insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo) values ('00000000-0000-0000-0000-00000000000c', 'caio3@ex.com', 'LINK3', now() + interval '24 hours', 'link');
select pg_temp.ok(public.email_confirmar_link('LINK3') = 'ok', 'link valido confirma');
select pg_temp.ok((select email_verificado_por = 'link' from profiles where cpf = '39053344705'), 'confirmacao grava a prova (link)');
select pg_temp.ok(public.email_confirmar_link('LINK3') = 'invalido', 'link de uso unico');
select pg_temp.ok(public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'LINK3') = 'sem_codigo', 'hash de link nao serve como codigo');

-- ===== 9. teto por conta =====
update profiles set email_verificado_em = now(), email_verificado_por = 'codigo' where cpf = '39053344705';
select (select count(*) from generate_series(1, 7) g, lateral public.senha_desafio_criar(gen_random_uuid(), '39053344705' || repeat(' ', g))) as criados \gset
select pg_temp.ok(:'criados' = '5', 'teto de 5 desafios por hora por conta (' || :'criados' || ')');
select pg_temp.ok((select count(*) = 1 from senha_desafios d join profiles p using (user_id) where p.cpf = '39053344705' and d.invalidado_em is null), 'so o ultimo desafio fica valido');

-- ===== 10. constraint de coerencia =====
do $$ begin
  begin
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    update public.profiles set email_verificado_em = now(), email_verificado_por = null where cpf = '05212301072';
    raise exception 'FALHOU: carimbo sem prova passou';
  exception when check_violation then null;
  end;
end $$;
select pg_temp.ok(true, 'carimbo sem tipo de prova e rejeitado pelo banco');
