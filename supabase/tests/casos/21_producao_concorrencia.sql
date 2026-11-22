-- Etapa 1 (22/11/2026): two phones at the same time. Uses two REAL extra sessions (dblink) against
-- this same test database, so the locks are the ones Postgres takes in production.
create extension if not exists dblink;
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
create or replace function pg_temp.conectar(p_nome text, p_user uuid) returns void language plpgsql as $$
begin
  -- the server's own unix socket: trusted locally and in the CI image, no password involved
  perform dblink_connect(p_nome, format('dbname=%s host=%s port=%s user=%s', current_database(),
    split_part(current_setting('unix_socket_directories'), ',', 1), current_setting('port'), current_user));
  perform dblink_exec(p_nome, format('set "request.jwt.claim.sub" = %L', p_user));
end $$;
-- Sends a call without waiting; reads its answer (or its error) later.
create or replace function pg_temp.enviar(p_nome text, p_sql text) returns void language sql as $$ select dblink_send_query(p_nome, p_sql) $$;
create or replace function pg_temp.resposta(p_nome text) returns text language plpgsql as $$
declare v jsonb; v_err text;
begin
  select x.r into v from dblink_get_result(p_nome, false) as x(r jsonb);
  v_err := dblink_error_message(p_nome);
  perform 1 from dblink_get_result(p_nome, false) as x(r jsonb);  -- drain
  if v is null then return 'erro|' || v_err; end if;
  return v::text;
end $$;

do $$
declare u uuid := t.vendedor('Concorrencia Teste'); p uuid; g uuid; h uuid;
begin
  insert into f values ('u', u);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Leite', 'L', 10) returning id into g;
  insert into f values ('leite', g);
  insert into public.ingredients (user_id, name, unit, stock_quantity) values (u, 'Açúcar', 'kg', 10) returning id into h;
  insert into f values ('acucar', h);
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Bolo', 'batch', 1) returning id into p;
  insert into f values ('bolo', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 6);
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Doce', 'batch', 1) returning id into p;
  insert into f values ('doce', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, h, 1);
  insert into public.products (user_id, name, recipe_mode, batch_yield) values (u, 'Pudim', 'batch', 1) returning id into p;
  insert into f values ('pudim', p);
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p, g, 1);
end $$;
select pg_temp.conectar('a', pg_temp.id('u'));
select pg_temp.conectar('b', pg_temp.id('u'));

-- ---------------------------------------------------------------- 1. two productions fight for the same milk
-- 10 L of milk, each cake takes 6 L: only one of the two can go through.
select dblink_exec('a', 'begin');
select * from dblink('a', format($$select public.producao_registrar('conc-a-000001', '[{"produto":"%s","unidades":1}]')$$, pg_temp.id('bolo'))) as x(r jsonb);
select pg_temp.enviar('b', format($$select public.producao_registrar('conc-b-000001', '[{"produto":"%s","unidades":1}]')$$, pg_temp.id('bolo')));
select pg_sleep(0.5);
select t.igual('1 lock: the second phone waits for the first (does not read the old 10 L)', dblink_is_busy('b'), 1);
select dblink_exec('a', 'commit');
select t.verdade('1 lock: after the first commits, the second is refused for missing milk',
  pg_temp.resposta('b') like 'erro|%Falta ingrediente: Leite (precisa 6 L, tem 4 L).%');
select t.igual('1 lock: milk is 4, never negative, never 0 by clamping', (select stock_quantity from public.ingredients where id = pg_temp.id('leite')), 4);
select t.igual('1 lock: exactly one cake produced', (select stock_quantity from public.products where id = pg_temp.id('bolo')), 1);
select t.igual('1 lock: exactly one registro', (select count(*) from public.producao_registros), 1);

-- ---------------------------------------------------------------- 2. the same submission arrives twice at once
select dblink_exec('a', 'begin');
select * from dblink('a', format($$select public.producao_registrar('conc-dup-00001', '[{"produto":"%s","unidades":2}]')$$, pg_temp.id('doce'))) as x(r jsonb);
select pg_temp.enviar('b', format($$select public.producao_registrar('conc-dup-00001', '[{"produto":"%s","unidades":2}]')$$, pg_temp.id('doce')));
select pg_sleep(0.5);
select t.igual('2 same key: the duplicate waits on the key lock', dblink_is_busy('b'), 1);
select dblink_exec('a', 'commit');
select t.verdade('2 same key: the duplicate gets the first answer (repetido)', (pg_temp.resposta('b')::jsonb->>'repetido')::boolean);
select t.igual('2 same key: sugar taken once (10 - 2)', (select stock_quantity from public.ingredients where id = pg_temp.id('acucar')), 8);
select t.igual('2 same key: produced once', (select stock_quantity from public.products where id = pg_temp.id('doce')), 2);
select t.igual('2 same key: one event for the key', (select count(*) from public.producao_eventos where chave = 'conc-dup-00001'), 1);

-- ---------------------------------------------------------------- 3. connection lost before the commit
select dblink_exec('a', 'begin');
select * from dblink('a', format($$select public.producao_registrar('conc-perda-001', '[{"produto":"%s","unidades":3}]')$$, pg_temp.id('doce'))) as x(r jsonb);
select dblink_disconnect('a');   -- the phone dropped: the transaction never committed
select t.igual('3 lost connection: nothing stayed half-done (sugar still 8)', (select stock_quantity from public.ingredients where id = pg_temp.id('acucar')), 8);
select t.igual('3 lost connection: no event kept for the key', (select count(*) from public.producao_eventos where chave = 'conc-perda-001'), 0);
select pg_temp.conectar('a', pg_temp.id('u'));
select t.verdade('3 retry with the same key: goes through as new',
  (select (x.r->>'repetido')::boolean = false from dblink('a', format($$select public.producao_registrar('conc-perda-001', '[{"produto":"%s","unidades":3}]')$$, pg_temp.id('doce'))) as x(r jsonb)));
select t.igual('3 retry: applied exactly once (8 - 3)', (select stock_quantity from public.ingredients where id = pg_temp.id('acucar')), 5);

-- ---------------------------------------------------------------- 4. items in opposite order do not deadlock
select dblink_exec('a', 'begin');
select * from dblink('a', format($$select public.producao_registrar('conc-ord-a0001', '[{"produto":"%s","unidades":1},{"produto":"%s","unidades":1}]')$$, pg_temp.id('pudim'), pg_temp.id('doce'))) as x(r jsonb);
select pg_temp.enviar('b', format($$select public.producao_registrar('conc-ord-b0001', '[{"produto":"%s","unidades":1},{"produto":"%s","unidades":1}]')$$, pg_temp.id('doce'), pg_temp.id('pudim')));
select pg_sleep(0.5);
select dblink_exec('a', 'commit');
select t.verdade('4 order: the second finishes normally after the first (no deadlock)', pg_temp.resposta('b') not like 'erro|%');
select t.igual('4 order: both took their milk (4 - 2)', (select stock_quantity from public.ingredients where id = pg_temp.id('leite')), 2);
select t.igual('4 order: both took their sugar (5 - 2)', (select stock_quantity from public.ingredients where id = pg_temp.id('acucar')), 3);

-- ---------------------------------------------------------------- 5. an undo racing a sale of the same units
select dblink_exec('a', 'begin');
select dblink_exec('a', format('update public.products set stock_quantity = stock_quantity - 1 where id = %L', pg_temp.id('bolo')));  -- the sale (stock 1 -> 0)
select pg_temp.enviar('b', format($$select public.producao_desfazer(%L, 'conc-des-00001', 'teste')$$, (select registro_id from public.producao_itens where product_id = pg_temp.id('bolo'))));
select pg_sleep(0.5);
select t.igual('5 sale vs undo: the undo waits for the sale', dblink_is_busy('b'), 1);
select dblink_exec('a', 'commit');
select t.verdade('5 sale vs undo: the undo is refused (the cake was sold)', pg_temp.resposta('b') like 'erro|%Essas unidades já foram vendidas%Bolo (precisa tirar 1, só restam 0%');
select t.igual('5 sale vs undo: cake stock 0, not -1', (select stock_quantity from public.products where id = pg_temp.id('bolo')), 0);

select dblink_disconnect('a');
select dblink_disconnect('b');
