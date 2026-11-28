-- C0 (ADR 0002): "Reiniciar o dia" from an old client keeps every row it destroys, and changes no
-- result. Fictional data. The five writes are sent exactly as restartChallenge sends them.
\set ON_ERROR_STOP on
create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
insert into auth.users (id) values (pg_temp.u('ana')), (pg_temp.u('bia')), (pg_temp.u('caio')) on conflict do nothing;
-- the production sweep of an account (same loop as public.apagar_dados_do_usuario)
create or replace function public.apagar_dados_do_usuario(p_user uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select c.table_name from information_schema.columns c join information_schema.tables t
             on t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
            where c.table_schema = 'public' and c.column_name = 'user_id' and c.table_name <> 'profiles'
  loop
    begin execute format('delete from public.%I where user_id = $1', r.table_name) using p_user;
    exception when others then raise warning 'falha ao limpar %: %', r.table_name, sqlerrm; end;
  end loop;
  return '{}'::jsonb;
end $$;

-- a day with money in it: plan, 2 blocks (one "+1h"), session, counters, approaches, a ledger
-- correction, a note, sales (one with stock) and the day's row
create or replace function pg_temp.dia(p text) returns uuid language plpgsql as $$
declare usr uuid := md5('u-' || p)::uuid; pl uuid := gen_random_uuid(); sid uuid;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (pl, usr, (now() at time zone 'America/Sao_Paulo')::date, 300, 2, 'normal', 150);
  insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount, achieved_amount, valor_pix, valor_dinheiro, timer_status, timer_started_at) values
    (pl, usr, 0, '8h', 150, 60, 40, 20, 'completed', now() - interval '70 minutes'),
    (pl, usr, 1, '⏱ +1h', 150, 20, 20, 0, 'running', now() - interval '10 minutes');
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks, current_block_index, total_sold)
    values (usr, (now() at time zone 'America/Sao_Paulo')::date, 300, 'active', 2, 1, 80) returning id into sid;
  insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count) values (sid, usr, 0, 5, 3), (sid, usr, 1, 2, 1) on conflict (session_id, block_index) do nothing;
  insert into public.defcon_abordagens (id, user_id, session_id, block_index, origem) values (md5('ab1-' || p)::uuid, usr, sid, 0, 'app'), (md5('ab2-' || p)::uuid, usr, sid, 1, 'app');
  insert into public.defcon_occurrences (user_id, session_id, block_index, description) values (usr, sid, 0, 'chuva');
  insert into public.products (id, user_id, name, sale_price, stock_quantity, controla_estoque) values (md5('prod-' || p)::uuid, usr, 'Bala', 20, 10, true);
  insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method, qty, product_id) values
    (md5('v1-' || p)::uuid, usr, sid, 0, 20, 'pix', 1, md5('prod-' || p)::uuid),
    (md5('v2-' || p)::uuid, usr, sid, 0, 20, 'dinheiro', 1, null),
    (md5('v3-' || p)::uuid, usr, sid, 0, 20, 'pix', 1, null),
    (md5('v4-' || p)::uuid, usr, sid, 1, 20, 'pix', 1, null);
  insert into public.daily_sales (user_id, date, cash_sales, pix_sales, card_sales, total_profit) values (usr, (now() at time zone 'America/Sao_Paulo')::date, 20, 60, 0, 80)
  on conflict do nothing;
  return sid;
end $$;
-- the five writes of restartChallenge, in its order (each its own request in the app)
create or replace function pg_temp.r1(sid uuid) returns void language sql as $$ delete from public.challenge_blocks where session_id = sid $$;
create or replace function pg_temp.r2(sid uuid) returns void language sql as $$ delete from public.challenge_sessions where id = sid $$;
create or replace function pg_temp.r3(p text) returns void language sql as $$
  delete from public.hourly_goal_blocks where plan_id = (select id from public.daily_goal_plans where user_id = md5('u-' || p)::uuid and date = (now() at time zone 'America/Sao_Paulo')::date) and hour_label like '⏱%' $$;
create or replace function pg_temp.r4(p text) returns void language sql as $$
  update public.hourly_goal_blocks set achieved_amount = 0, is_completed = false, timer_status = 'idle', timer_started_at = null,
    valor_dinheiro = 0, valor_cartao = 0, valor_pix = 0, valor_calote = 0, valor_gorjeta = 0
   where plan_id = (select id from public.daily_goal_plans where user_id = md5('u-' || p)::uuid and date = (now() at time zone 'America/Sao_Paulo')::date) $$;
create or replace function pg_temp.r5(p text) returns void language sql as $$
  update public.daily_sales set cash_sales = 0, card_sales = 0, pix_sales = 0, tip_sales = 0, total_profit = 0, total_debt = 0
   where user_id = md5('u-' || p)::uuid and date = (now() at time zone 'America/Sao_Paulo')::date $$;

-- A. a whole restart
select pg_temp.dia('ana') as s \gset ana_
select stock_quantity as estoque from public.products where id = md5('prod-ana')::uuid \gset ana_
select pg_temp.r1(:'ana_s'); select pg_temp.r2(:'ana_s'); select pg_temp.r3('ana'); select pg_temp.r4('ana'); select pg_temp.r5('ana');
select t.igual('A1 one restart event for the account and day', (select count(*)::int from public.defcon_reinicios where user_id = pg_temp.u('ana')), 1);
select t.verdade('A2 every step is recorded (counters, session, cascades, +1h blocks, zeroed blocks, zeroed day)',
  (select etapas @> array['contadores','sessao','defcon_abordagens','defcon_occurrences','blocos_extras','blocos_zerados','dia_zerado']
     from public.defcon_reinicios where user_id = pg_temp.u('ana')));
select t.verdade('A3 the counters are kept from the FIRST write (deleted before the session): 2 blocks, 5+2 approaches, 3+1 sales',
  (select count(*) = 2 and sum((dados ->> 'approaches_count')::int) = 7 and sum((dados ->> 'sales_count')::int) = 4
     from public.defcon_arquivo where user_id = pg_temp.u('ana') and tabela = 'challenge_blocks'));
select t.verdade('A4 the session row, its 2 approaches and the note are kept',
  (select count(*) from public.defcon_arquivo where user_id = pg_temp.u('ana') and tabela = 'challenge_sessions' and linha_id = :'ana_s'::uuid
     and (dados ->> 'total_sold')::numeric = 80) = 1
  and (select count(*) from public.defcon_arquivo where user_id = pg_temp.u('ana') and tabela = 'defcon_abordagens') = 2
  and (select count(*) from public.defcon_arquivo where user_id = pg_temp.u('ana') and tabela = 'defcon_occurrences') = 1);
select t.verdade('A5 the blocks BEFORE zeroing are kept: block 8h R$ 60 (40 Pix + 20 cash) zeroed in write 4, block +1h R$ 20 deleted in write 3 - R$ 80 rebuildable',
  (select sum((dados ->> 'achieved_amount')::numeric) = 60 and sum((dados ->> 'valor_pix')::numeric) = 40 and sum((dados ->> 'valor_dinheiro')::numeric) = 20
     from public.defcon_arquivo where user_id = pg_temp.u('ana') and tabela = 'hourly_goal_blocks' and etapa = 'blocos_zerados')
  and (select (dados ->> 'achieved_amount')::numeric = 20 and dados ->> 'hour_label' like '⏱%'
     from public.defcon_arquivo where user_id = pg_temp.u('ana') and etapa = 'blocos_extras'));
select t.verdade('A6 the day BEFORE zeroing is kept (cash 20, Pix 60, profit 80)',
  (select (dados ->> 'pix_sales')::numeric = 60 and (dados ->> 'cash_sales')::numeric = 20 from public.defcon_arquivo
    where user_id = pg_temp.u('ana') and etapa = 'dia_zerado'));
select t.verdade('A7 the event counts the sales the restart left behind: 4, R$ 80',
  (select vendas_deixadas = 4 and valor_deixado = 80 from public.defcon_reinicios where user_id = pg_temp.u('ana')));
-- no result changed: the client sees exactly what it saw before C0
select t.verdade('A8 NOTHING else changes: session gone, the 4 sales still there, stock as before, blocks and day zeroed',
  not exists (select 1 from public.challenge_sessions where id = :'ana_s'::uuid)
  and (select count(*) from public.defcon_sales where session_id = :'ana_s'::uuid) = 4
  and (select stock_quantity from public.products where id = md5('prod-ana')::uuid) = :'ana_estoque'::int
  and (select sum(achieved_amount) from public.hourly_goal_blocks where user_id = pg_temp.u('ana')) = 0
  and (select pix_sales from public.daily_sales where user_id = pg_temp.u('ana')) = 0);

-- B. retries and idempotency
select count(*) as n from public.defcon_arquivo where user_id = pg_temp.u('ana') \gset antes_
select pg_temp.r1(:'ana_s'); select pg_temp.r2(:'ana_s'); select pg_temp.r3('ana'); select pg_temp.r4('ana'); select pg_temp.r5('ana');
select t.verdade('B1 the app retries the five writes: nothing archived twice, still one event',
  (select count(*) from public.defcon_arquivo where user_id = pg_temp.u('ana')) = :'antes_n'::bigint
  and (select count(*) from public.defcon_reinicios where user_id = pg_temp.u('ana')) = 1);

-- C. a failure midway: only writes 1 and 2 reached the server
select pg_temp.dia('bia') as s \gset bia_
select pg_temp.r1(:'bia_s'); select pg_temp.r2(:'bia_s');
select t.verdade('C1 partial restart: counters and session kept; the event shows what is missing',
  (select etapas @> array['contadores','sessao'] and not (etapas @> array['blocos_zerados']) from public.defcon_reinicios where user_id = pg_temp.u('bia')));
select t.verdade('C2 the monitor counts it as partial', (public.defcon_c0_resumo(now() - interval '1 hour') ->> 'parciais')::int >= 1);

-- D. an offline sale for the deleted session arrives later
insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method, qty) values (pg_temp.id('off-bia'), pg_temp.u('bia'), :'bia_s'::uuid, 0, 15, 'pix', 1);
select t.verdade('D1 the offline sale is written exactly as before (nothing refused)', exists (select 1 from public.defcon_sales where id = pg_temp.id('off-bia')));
select t.verdade('D2 ...and recorded as a sale without a session, linked to the restart event',
  (select evento_id = (select id from public.defcon_reinicios where user_id = pg_temp.u('bia')) and valor = 15
     from public.defcon_vendas_sem_sessao where venda_id = pg_temp.id('off-bia')));
select t.verdade('D3 a sale of a live session is not recorded there', not exists (select 1 from public.defcon_vendas_sem_sessao where venda_id = md5('v1-ana')::uuid));

-- E. ordinary operations archive nothing
select pg_temp.dia('caio') as s \gset caio_
delete from public.defcon_abordagens where id = md5('ab1-caio')::uuid;
update public.hourly_goal_blocks set achieved_amount = 80, valor_pix = 60 where user_id = pg_temp.u('caio') and hour_index = 0;
update public.daily_sales set pix_sales = 70 where user_id = pg_temp.u('caio');
select t.verdade('E1 an approach removed while the session lives, a sale on a block, a change of the day: no event, no copy',
  not exists (select 1 from public.defcon_reinicios where user_id = pg_temp.u('caio'))
  and not exists (select 1 from public.defcon_arquivo where user_id = pg_temp.u('caio')));

-- F. RLS and isolation
select set_config('request.jwt.claim.sub', pg_temp.u('caio')::text, false) is not null as x \gset
set role authenticated;
select (select count(*) from public.defcon_arquivo) + (select count(*) from public.defcon_reinicios) + (select count(*) from public.defcon_vendas_sem_sessao) as visto \gset caio_
reset role;
select t.igual('F1 another account reads none of Ana''s archive, events or sales without a session', :'caio_visto'::int, 0);
select set_config('request.jwt.claim.sub', pg_temp.u('ana')::text, false) is not null as x \gset
set role authenticated;
select count(*) as visto, count(*) filter (where user_id <> md5('u-ana')::uuid) as alheio from public.defcon_arquivo \gset ana_
reset role;
select t.verdade('F2 Ana reads her own archive, and only hers', :'ana_visto'::int > 0 and :'ana_alheio'::int = 0);
select t.verdade('F3 no client may write, change or delete the archive (only the triggers do)',
  not has_table_privilege('authenticated', 'public.defcon_arquivo', 'insert') and not has_table_privilege('authenticated', 'public.defcon_arquivo', 'update')
  and not has_table_privilege('authenticated', 'public.defcon_arquivo', 'delete') and not has_table_privilege('anon', 'public.defcon_arquivo', 'select')
  and not has_table_privilege('authenticated', 'public.defcon_reinicios', 'insert'));
select t.verdade('F4 the archiving functions are not callable by clients',
  not has_function_privilege('authenticated', 'public.defcon_c0_evento(uuid,date,uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.defcon_c0_resumo(timestamptz)', 'execute'));

-- G. account deletion and retention
select public.apagar_dados_do_usuario(pg_temp.u('caio'));
select t.verdade('G1 wiping an account (apagar_dados_do_usuario) archives nothing of it and leaves nothing of it',
  not exists (select 1 from public.defcon_arquivo where user_id = pg_temp.u('caio'))
  and not exists (select 1 from public.defcon_reinicios where user_id = pg_temp.u('caio'))
  and not exists (select 1 from public.challenge_sessions where user_id = pg_temp.u('caio')));
delete from auth.users where id = pg_temp.u('ana');
select t.verdade('G2 the admin path deletes the auth user last: Ana''s archive goes with it',
  not exists (select 1 from public.defcon_arquivo where user_id = pg_temp.u('ana')) and not exists (select 1 from public.defcon_reinicios where user_id = pg_temp.u('ana')));
-- a session of a user that no longer exists (old leftovers) is still deletable: never blocked
insert into public.challenge_sessions (id, user_id, date, daily_goal, status, total_blocks, current_block_index) values (pg_temp.id('fantasma'), pg_temp.u('fantasma'), pg_temp.hoje(), 100, 'active', 1, 0);
delete from public.challenge_sessions where id = pg_temp.id('fantasma');
select t.verdade('G3 a session of an unknown user is deleted as before, nothing archived (never blocks the client)',
  not exists (select 1 from public.challenge_sessions where id = pg_temp.id('fantasma')) and not exists (select 1 from public.defcon_arquivo where linha_id = pg_temp.id('fantasma')));
update public.defcon_reinicios set expira_em = now() - interval '1 second' where user_id = pg_temp.u('bia');
select t.igual('G4 retention: an expired event and its copies are purged', public.defcon_c0_expurgar(), 1);
select t.verdade('G4 ...nothing of Bia''s restart is left', not exists (select 1 from public.defcon_arquivo where user_id = pg_temp.u('bia')));

-- H. a ledger session (VANT Quick account): its correction and a tap racing the restart
insert into auth.users (id) values (pg_temp.u('duda')) on conflict do nothing;
update public.defcon_persistencia_config set marcar_novas = true, vant_quick = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('duda')) on conflict do nothing;
select pg_temp.dia('duda') as s \gset duda_
insert into public.defcon_ajustes (id, user_id, session_id, block_index, tipo, pix, origem) values (pg_temp.id('aj-duda'), pg_temp.u('duda'), :'duda_s'::uuid, 0, 'valor_manual', 5, 'app');
select pg_temp.r1(:'duda_s');
-- a VANT Quick tap holds the session (FOR UPDATE) while the restart's delete arrives on another connection
select dblink_connect('tap', current_setting('vant.teste_conexao')) is not null as x \gset
select dblink_connect('reinicio', current_setting('vant.teste_conexao')) is not null as x \gset
select dblink_exec('tap', 'begin') is not null as x \gset
select r ->> 'aplicado' as aplicado from dblink('tap', format($q$select public.defcon_lancar_conta(%L, %L, 'venda', %L, 1, 25, 'pix', null, 1, null, 'atividade')$q$,
                                 pg_temp.u('duda'), pg_temp.id('tap-duda'), :'duda_s')) as x(r jsonb) \gset tap_
select dblink_send_query('reinicio', format('delete from public.challenge_sessions where id = %L', :'duda_s')) as enviado \gset
select pg_sleep(0.3) is not null as x \gset
select dblink_is_busy('reinicio') as esperando \gset
select dblink_exec('tap', 'commit') is not null as x \gset
select count(*) as n from dblink_get_result('reinicio') as r(x text) \gset fim_
select dblink_disconnect('tap') is not null as x \gset
select dblink_disconnect('reinicio') is not null as x \gset
select t.verdade('H1 the restart''s delete waits for the tap (same session lock): no tap lands half-way', :'esperando'::int = 1);
select t.verdade('H2 the tap''s sale is kept (R$ 25) and the session is gone, as without C0',
  exists (select 1 from public.defcon_sales where id = pg_temp.id('tap-duda') and amount = 25)
  and not exists (select 1 from public.challenge_sessions where id = :'duda_s'::uuid));
select t.verdade('H3 the archived session includes the tap (total R$ 105 = 80 + 25), and the ledger correction is kept',
  (select (dados ->> 'total_sold')::numeric = 105 from public.defcon_arquivo where tabela = 'challenge_sessions' and linha_id = :'duda_s'::uuid)
  and exists (select 1 from public.defcon_arquivo where tabela = 'defcon_ajustes' and linha_id = pg_temp.id('aj-duda') and (dados ->> 'pix')::numeric = 5));
select t.verdade('H4 the counter the tap re-created after write 1 is kept too (block 2: 1 sale)',
  exists (select 1 from public.defcon_arquivo where tabela = 'challenge_blocks' and user_id = pg_temp.u('duda') and (dados ->> 'block_index')::int = 1
            and etapa = 'contadores' and (dados ->> 'sales_count')::int >= 1 and dados ->> 'id' not in
              (select dados ->> 'id' from public.defcon_arquivo where user_id = pg_temp.u('duda') and tabela = 'challenge_blocks' and (dados ->> 'block_index')::int = 0)));
select t.igual('H5 still one restart event for Duda (the late writes joined it)', (select count(*)::int from public.defcon_reinicios where user_id = pg_temp.u('duda')), 1);
