-- ADR 0001 (Phase 2): the server is the source of the DEFCON totals. Fictional data only.
-- "Old client" = today's app (absolute writes, no x-vant-cliente header); "new client" = ledger RPC.
\set ON_ERROR_STOP on

create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;

-- a plan of the day with 3 hour blocks (hour_index 0..2)
create or replace function pg_temp.plano(p_user uuid, p_data date default current_date) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); i int;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, p_user, p_data, 300, 3, 'normal', 100);
  for i in 0..2 loop
    insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount) values (v, p_user, i, (8+i)::text || 'h', 100);
  end loop;
  return v;
end $$;
create or replace function pg_temp.sessao(p_user uuid, p_data date default current_date) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks) values (p_user, p_data, 300, 'active', 3) returning id into v;
  return v;
end $$;
create or replace function pg_temp.bloco(p_user uuid, p_idx int, p_data date default current_date) returns public.hourly_goal_blocks language sql as $$
  select hb.* from public.hourly_goal_blocks hb join public.daily_goal_plans p on p.id = hb.plan_id
  where p.user_id = p_user and p.date = p_data and hb.hour_index = p_idx
$$;
create or replace function pg_temp.total(p_sessao uuid) returns numeric language sql as $$ select total_sold from public.challenge_sessions where id = p_sessao $$;
create or replace function pg_temp.cont(p_sessao uuid, p_idx int, out ab int, out ve int) language sql as $$
  select approaches_count, sales_count from public.challenge_blocks where session_id = p_sessao and block_index = p_idx $$;

-- the OLD client, exactly as today's app writes a sale: the row, then the block and the session with
-- ABSOLUTE values from ITS screen (p_tela_*), then the counters upsert
create or replace function pg_temp.venda_antiga(p_user uuid, p_sessao uuid, p_idx int, p_id uuid, p_valor numeric,
  p_tela_dinheiro numeric, p_tela_total numeric, p_tela_ab int, p_tela_ve int) returns void language plpgsql as $$
begin
  perform set_config('request.headers', '', false);
  insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method) values (p_id, p_user, p_sessao, p_idx, p_valor, 'dinheiro')
  on conflict (id) do nothing;
  -- the whole split from ITS screen (that screen had only cash), as queueBlockOffline sends it
  update public.hourly_goal_blocks set valor_dinheiro = p_tela_dinheiro + p_valor, valor_pix = 0, valor_cartao = 0, valor_calote = 0,
         achieved_amount = p_tela_dinheiro + p_valor
   where id = (pg_temp.bloco(p_user, p_idx)).id;
  update public.challenge_sessions set total_sold = p_tela_total + p_valor where id = p_sessao;
  insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count)
  values (p_sessao, p_user, p_idx, p_tela_ab + 1, p_tela_ve + 1)
  on conflict (session_id, block_index) do update set approaches_count = excluded.approaches_count, sales_count = excluded.sales_count;
end $$;
create or replace function pg_temp.abordagem_antiga(p_user uuid, p_sessao uuid, p_idx int, p_tela_ab int, p_tela_ve int) returns void language plpgsql as $$
begin
  perform set_config('request.headers', '', false);
  insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count)
  values (p_sessao, p_user, p_idx, p_tela_ab + 1, p_tela_ve)
  on conflict (session_id, block_index) do update set approaches_count = excluded.approaches_count, sales_count = excluded.sales_count;
end $$;
-- the NEW client / VANT Quick
create or replace function pg_temp.lancar(p_user uuid, p_id uuid, p_tipo text, p_sessao uuid, p_idx int, p_valor numeric default null,
  p_metodo text default null, p_origem text default 'app', p_split jsonb default null) returns jsonb language plpgsql as $$
begin
  perform t.logar(p_user);
  perform set_config('request.headers', '{"x-vant-cliente":"2"}', false);
  return public.defcon_lancar(p_id, p_tipo, p_sessao, p_idx, p_valor, p_metodo, null, null, p_split, p_origem);
end $$;

-- ======================================================================================
-- 0. Inactive by default: nothing changes for anyone
-- ======================================================================================
select pg_temp.plano(pg_temp.u('off'));
select pg_temp.sessao(pg_temp.u('off')) as s \gset off_
select t.verdade('A0 switches off: a new session is NOT marked', not (select totais_servidor from public.challenge_sessions where id = :'off_s'));
update public.challenge_sessions set total_sold = 77 where id = :'off_s';
select t.igual('A0 unmarked session: an absolute write behaves exactly as today', pg_temp.total(:'off_s'), 77);
insert into public.challenge_sessions (user_id, date, daily_goal, totais_servidor) values (pg_temp.u('forja'), current_date, 100, true);
select t.verdade('A0 a client cannot mark a session by itself', not (select totais_servidor from public.challenge_sessions where user_id = pg_temp.u('forja')));

-- switch on for the pilot accounts
update public.defcon_persistencia_config set marcar_novas = true;
insert into public.defcon_persistencia_contas (user_id) select pg_temp.u(k) from unnest(array['rick','duo','corrida','corrida2','volta']) k;

-- ======================================================================================
-- 1. Opening balance and the new client
-- ======================================================================================
select pg_temp.plano(pg_temp.u('rick'));
update public.hourly_goal_blocks set valor_dinheiro = 30, achieved_amount = 30 where id = (pg_temp.bloco(pg_temp.u('rick'), 0)).id; -- manual sale before the DEFCON
select pg_temp.sessao(pg_temp.u('rick')) as s \gset r_
select t.verdade('B1 the session of a switched-on account is marked', (select totais_servidor from public.challenge_sessions where id = :'r_s'));
select t.igual('B1 opening balance: what the block already held is kept (not zeroed)', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 30);
update public.hourly_goal_blocks set target_amount = 120 where id = (pg_temp.bloco(pg_temp.u('rick'), 0)).id;
select t.igual('B1 ...and survives the next write to the block', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 30);

select (pg_temp.lancar(pg_temp.u('rick'), pg_temp.id('v1'), 'venda', :'r_s', 0, 20, 'dinheiro')) as j \gset r1_
select t.verdade('B2 new client sale: applied, block 30 + 20', (:'r1_j'::jsonb ->> 'aplicado')::boolean and (:'r1_j'::jsonb -> 'bloco' ->> 'total')::numeric = 50);
select t.igual('B2 session total = the sales of the session', pg_temp.total(:'r_s'), 20);
select (pg_temp.lancar(pg_temp.u('rick'), pg_temp.id('v1'), 'venda', :'r_s', 0, 20, 'dinheiro')) as j \gset r2_
select t.verdade('B3 the same id again (offline replay / inconclusive answer): not applied twice', not (:'r2_j'::jsonb ->> 'aplicado')::boolean);
select t.igual('B3 ...block still 50', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 50);
select t.igual('B3 ...one sale row', (select count(*) from public.defcon_sales where session_id = :'r_s'), 1);
select t.igual('B3 ...daily_sales rebuilt by the server (no app open needed)', (select total_profit from public.daily_sales where user_id = pg_temp.u('rick') and date = current_date), 50);

-- ======================================================================================
-- 2. THE R$ 20 CASE: an old client with an outdated screen after a widget sale
-- ======================================================================================
-- app screen: block 50, total 20, 1 sale / 1 approach. The widget sells R$ 20 on the server:
select pg_temp.lancar(pg_temp.u('rick'), pg_temp.id('w1'), 'venda', :'r_s', 0, 20, 'dinheiro', 'widget');
-- the OLD app, not knowing, sells R$ 10 and writes block = 50 + 10, total = 20 + 10, counters 2/2
select pg_temp.venda_antiga(pg_temp.u('rick'), :'r_s', 0, pg_temp.id('a1'), 10, 50, 20, 1, 1);
select t.igual('C1 block keeps the widget sale: 30 + 20 + 20 + 10 = 80', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 80);
select t.igual('C1 session total keeps it too: 20 + 20 + 10 = 50 (X1 reads this)', pg_temp.total(:'r_s'), 50);
select t.igual('C1 sales of the block = 3 (from rows, not from the stale screen)', (pg_temp.cont(:'r_s', 0)).ve, 3);
select t.igual('C1 approaches = 3 (every sale is an approach)', (pg_temp.cont(:'r_s', 0)).ab, 3);
select t.verdade('C1 the ignored absolute write is kept for the audit', exists (select 1 from public.defcon_conflitos where session_id = :'r_s' and motivo = 'total_absoluto_ignorado' and not cliente_novo));
select t.verdade('C1 the session records that an old client wrote to it', (select cliente_antigo_em is not null from public.challenge_sessions where id = :'r_s'));
-- the old app re-sends the same write (offline queue replay)
select pg_temp.venda_antiga(pg_temp.u('rick'), :'r_s', 0, pg_temp.id('a1'), 10, 50, 20, 1, 1);
select t.igual('C2 replay of the old write: nothing counted twice (block 80)', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 80);
select t.igual('C2 ...total 50', pg_temp.total(:'r_s'), 50);
select t.igual('C2 ...3 sales', (pg_temp.cont(:'r_s', 0)).ve, 3);
-- ======================================================================================
-- 2b. The coincidence: an outdated old screen whose absolute write has the SAME total
-- ======================================================================================
-- server now: block 80 (30 opening + 20 + 20 widget + 10). The widget sells R$ 20 by PIX:
select pg_temp.lancar(pg_temp.u('rick'), pg_temp.id('w-pix'), 'venda', :'r_s', 0, 20, 'pix', 'widget');
-- the old app, still showing 80 all in cash, sells R$ 20 in CASH and writes cash = 100, pix = 0:
-- the same total the server has (100). As a "re-split" it would turn the widget's Pix into cash.
select pg_temp.venda_antiga(pg_temp.u('rick'), :'r_s', 0, pg_temp.id('a-coinc'), 20, 80, 50, 4, 4);
select t.verdade('C3 same-total outdated write: no ajuste is created (Pix 20 stays Pix, cash 30+20+20+10+20 = 100)',
  (select valor_pix = 20 and valor_dinheiro = 100 and achieved_amount = 120 from pg_temp.bloco(pg_temp.u('rick'), 0))
  and not exists (select 1 from public.defcon_ajustes where session_id = :'r_s' and tipo = 'redistribuicao'));
select t.igual('C3 ...session total = every sale (20 + 20 + 10 + 20 + 20)', pg_temp.total(:'r_s'), 90);
select t.verdade('C3 ...and the outdated write is in the audit', exists (select 1 from public.defcon_conflitos where session_id = :'r_s' and motivo in ('redistribuicao_absoluta_ignorada','total_absoluto_ignorado')));
-- the same coincidence with the block write arriving BEFORE its sale row (the other queue order):
-- the absolute total equals the server's exactly, the case a "re-split" reading would have taken
select pg_temp.lancar(pg_temp.u('rick'), pg_temp.id('w-pix2'), 'venda', :'r_s', 0, 10, 'pix', 'widget');
select set_config('request.headers', '', false);
update public.hourly_goal_blocks set valor_dinheiro = 130, valor_pix = 0, valor_cartao = 0, valor_calote = 0, achieved_amount = 130
 where id = (pg_temp.bloco(pg_temp.u('rick'), 0)).id;   -- screen: 120 all cash (+ its own 10 cash) = 130 = server total
insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method) values (pg_temp.id('a-coinc2'), pg_temp.u('rick'), :'r_s', 0, 10, 'dinheiro');
select t.verdade('C3b block write first, same total as the server: nothing moved (Pix 30 stays Pix), then its row: 140',
  (select valor_pix = 30 and valor_dinheiro = 110 and achieved_amount = 140 from pg_temp.bloco(pg_temp.u('rick'), 0))
  and exists (select 1 from public.defcon_conflitos where session_id = :'r_s' and motivo = 'redistribuicao_absoluta_ignorada')
  and not exists (select 1 from public.defcon_ajustes where session_id = :'r_s' and tipo = 'redistribuicao'));
-- an outdated screen that does not know the manual amount: achieved lower, same split
update public.hourly_goal_blocks set achieved_amount = 100 where id = (pg_temp.bloco(pg_temp.u('rick'), 0)).id;
select t.verdade('C4 achieved written LOWER with the same split: no negative ajuste, value kept (140), logged',
  (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount = 140
  and not exists (select 1 from public.defcon_ajustes where session_id = :'r_s' and extra < 0)
  and exists (select 1 from public.defcon_conflitos where session_id = :'r_s' and motivo = 'achieved_menor_ignorado'));


-- ======================================================================================
-- 3. Approaches and conversion
-- ======================================================================================
select pg_temp.plano(pg_temp.u('duo'));
select pg_temp.sessao(pg_temp.u('duo')) as s \gset d_
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-v1'), 'venda', :'d_s', 0, 10, 'pix');
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-a1'), 'abordagem', :'d_s', 0);
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-a1'), 'abordagem', :'d_s', 0);  -- replay
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-a2'), 'abordagem', :'d_s', 0, null, null, 'atividade');
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-tip'), 'gorjeta', :'d_s', 0, 5);
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-late'), 'venda_tardia', :'d_s', 0, 8);
select t.igual('D1 approaches = 1 sale + 2 standalone (replay not counted)', (pg_temp.cont(:'d_s', 0)).ab, 3);
select t.igual('D1 sales = 1: tip and late Pix never count as a sale (conversion 1/3)', (pg_temp.cont(:'d_s', 0)).ve, 1);
select t.igual('D1 money: 10 pix + 5 tip (cash) + 8 late pix = 23', (pg_temp.bloco(pg_temp.u('duo'), 0)).achieved_amount, 23);
select t.igual('D1 tip stays in its own column', (pg_temp.bloco(pg_temp.u('duo'), 0)).valor_gorjeta, 5);
-- an old client that knows the same approaches adds one more: its view 1 sale + 2 standalone -> 4
select pg_temp.abordagem_antiga(pg_temp.u('duo'), :'d_s', 0, 3, 1);
select t.igual('D2 old client +1 approach (screen up to date): counted', (pg_temp.cont(:'d_s', 0)).ab, 4);
select pg_temp.abordagem_antiga(pg_temp.u('duo'), :'d_s', 0, 3, 1);
select t.igual('D2 ...its replay: not counted again', (pg_temp.cont(:'d_s', 0)).ab, 4);
-- the widget adds 2 approaches; an old client with an OUTDATED screen (it saw 4) adds 1 -> writes 5
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-w1'), 'abordagem', :'d_s', 0, null, null, 'widget');
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-w2'), 'abordagem', :'d_s', 0, null, null, 'widget');
select pg_temp.abordagem_antiga(pg_temp.u('duo'), :'d_s', 0, 4, 1);
select t.igual('D3 outdated old screen: the server count is never lowered (6, not 5)', (pg_temp.cont(:'d_s', 0)).ab, 6);
select t.verdade('D3 ...and the divergence is recorded (it fails the shadow approval; VANT Quick refuses such sessions)',
  exists (select 1 from public.defcon_conflitos where session_id = :'d_s' and motivo = 'abordagens_desatualizadas'));

-- ======================================================================================
-- 4. Deletes, "Como recebeu", Nova Venda
-- ======================================================================================
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-v1'), 'apagar_venda', :'d_s', 0);
select t.igual('E1 delete: money reverted (23 - 10)', (pg_temp.bloco(pg_temp.u('duo'), 0)).achieved_amount, 13);
select t.igual('E1 ...and the sale + its approach (6 - 1)', (pg_temp.cont(:'d_s', 0)).ab, 5);
select (pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-v1'), 'apagar_venda', :'d_s', 0)) as j \gset e2_
select t.verdade('E2 deleting again changes nothing', not (:'e2_j'::jsonb ->> 'aplicado')::boolean and (pg_temp.bloco(pg_temp.u('duo'), 0)).achieved_amount = 13);
-- an OLD client's absolute re-split (5 cash + 8 pix -> 3 cash + 10 pix): never turned into money
update public.hourly_goal_blocks set valor_dinheiro = 3, valor_pix = 10, achieved_amount = 13 where id = (pg_temp.bloco(pg_temp.u('duo'), 0)).id;
select t.verdade('E3 old client absolute re-split on a marked session: NOT applied (cash 5, pix 8 stay), logged',
  (select valor_dinheiro = 5 and valor_pix = 8 and achieved_amount = 13 from pg_temp.bloco(pg_temp.u('duo'), 0))
  and exists (select 1 from public.defcon_conflitos where session_id = :'d_s' and motivo = 'redistribuicao_absoluta_ignorada')
  and not exists (select 1 from public.defcon_ajustes where session_id = :'d_s' and tipo = 'redistribuicao'));
-- the NEW app re-splits explicitly ("Como recebeu" through the ledger)
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-rs'), 'redistribuir', :'d_s', 0, null, null, 'app', '{"dinheiro":3,"pix":10,"cartao":0,"calote":0}');
select t.verdade('E3 new app re-split: applied (3 cash, 10 pix, same 13)',
  (select valor_dinheiro = 3 and valor_pix = 10 and achieved_amount = 13 from pg_temp.bloco(pg_temp.u('duo'), 0)));
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-rs'), 'redistribuir', :'d_s', 0, null, null, 'app', '{"dinheiro":3,"pix":10,"cartao":0,"calote":0}');
select t.igual('E3 ...its replay (same id) adds no second ajuste', (select count(*) from public.defcon_ajustes where session_id = :'d_s' and tipo = 'redistribuicao'), 1);
select t.igual('E3 the session total is not touched by a re-split (sales only)', pg_temp.total(:'d_s'), 13);
-- calote through a re-split: part of the cash becomes "not received"
select pg_temp.lancar(pg_temp.u('duo'), pg_temp.id('d-cal'), 'redistribuir', :'d_s', 0, null, null, 'app', '{"dinheiro":1,"pix":10,"cartao":0,"calote":2}');
select t.verdade('E3 calote: 2 of the cash become calote, block total still 13',
  (select valor_dinheiro = 1 and valor_calote = 2 and achieved_amount = 13 from pg_temp.bloco(pg_temp.u('duo'), 0)));
select t.verdade('E4 a re-split that changes the total is refused for the new client',
  t.erro($q$select public.defcon_lancar(md5('id-rs')::uuid, 'redistribuir', '$q$ || :'d_s' || $q$'::uuid, 0, null, null, null, null, '{"dinheiro":1,"pix":1}'::jsonb, 'app')$q$, null, pg_temp.u('duo')) like '%redistribuicao_muda_total%');
-- Nova Venda outside the DEFCON (DailySalesForm) adds 7 to the hour block (achieved only)
update public.hourly_goal_blocks set achieved_amount = 20 where id = (pg_temp.bloco(pg_temp.u('duo'), 0)).id;
select t.igual('E5 Nova Venda amount kept as a manual ajuste (13 + 7)', (pg_temp.bloco(pg_temp.u('duo'), 0)).achieved_amount, 20);
select t.verdade('E5 ...which is not a DEFCON sale: it does not create a sale row (manual vs bank-verified stays as today)',
  (select count(*) from public.defcon_sales where session_id = :'d_s') = 2);

-- ======================================================================================
-- 5. Rollback never lets an old write erase what the server registered
-- ======================================================================================
select public.defcon_desligar_conta(pg_temp.u('rick'));
update public.challenge_sessions set totais_servidor = false where id = :'r_s';
select t.verdade('F1 account switched off: its marked session stays marked (a client cannot unmark it)', (select totais_servidor from public.challenge_sessions where id = :'r_s'));
select pg_temp.venda_antiga(pg_temp.u('rick'), :'r_s', 0, pg_temp.id('a2'), 5, 0, 0, 0, 0);   -- a very outdated old screen
select t.igual('F1 ...and it still protects the widget sales (140 + 5, not 5)', (pg_temp.bloco(pg_temp.u('rick'), 0)).achieved_amount, 145);
select t.igual('F1 ...session total 110 + 5', pg_temp.total(:'r_s'), 115);
update public.defcon_persistencia_config set marcar_novas = false;
select pg_temp.plano(pg_temp.u('volta'), current_date + 1);
select pg_temp.sessao(pg_temp.u('volta'), current_date + 1) as s \gset v_
select t.verdade('F2 global switch off: next sessions are not marked (today''s path)', not (select totais_servidor from public.challenge_sessions where id = :'v_s'));
select t.verdade('F2 ...and the ledger RPC refuses them, so the client keeps today''s path',
  t.erro($q$select public.defcon_lancar(md5('id-x')::uuid, 'venda', '$q$ || :'v_s' || $q$'::uuid, 0, 5)$q$, null, pg_temp.u('volta')) like '%sessao_nao_servidor%');
update public.defcon_persistencia_config set marcar_novas = true;

-- ======================================================================================
-- 6. Security
-- ======================================================================================
select t.verdade('G1 another account cannot write in my session',
  t.erro($q$select public.defcon_lancar(md5('id-y')::uuid, 'venda', '$q$ || :'d_s' || $q$'::uuid, 0, 5)$q$, null, pg_temp.u('intruso')) like '%sessao_invalida%');
select t.verdade('G1 limits: no zero, negative or above-R$ 5.000 sale',
  t.erro($q$select public.defcon_lancar(md5('id-z')::uuid, 'venda', '$q$ || :'d_s' || $q$'::uuid, 0, 9000)$q$, null, pg_temp.u('duo')) like '%valor_invalido%');
select t.igual('G2 a client cannot read the audit tables', t.linhas_como('authenticated', pg_temp.u('duo'), 'select * from public.defcon_conflitos'), -1);

-- ======================================================================================
-- 7. Concurrency: two devices at the same moment (real parallel connections)
-- ======================================================================================
select pg_temp.plano(pg_temp.u('corrida'));
select pg_temp.sessao(pg_temp.u('corrida')) as s \gset c_
select dblink_connect('a', current_setting('vant.teste_conexao'));
select dblink_connect('b', current_setting('vant.teste_conexao'));
select dblink_exec('a', 'begin');
select * from dblink('a', format($q$select set_config('request.jwt.claim.sub', %L, false), public.defcon_lancar(%L, 'venda', %L, 0, 10, 'dinheiro', null, null, null, 'widget')$q$,
  pg_temp.u('corrida'), pg_temp.id('c1'), :'c_s')) as x(a text, b jsonb);
-- b (another device) sells while a's transaction holds the session: it must wait, not overwrite
select dblink_send_query('b', format($q$select set_config('request.jwt.claim.sub', %L, false), public.defcon_lancar(%L, 'venda', %L, 0, 15, 'pix', null, null, null, 'app')$q$,
  pg_temp.u('corrida'), pg_temp.id('c2'), :'c_s'));
select pg_sleep(0.5);
select t.verdade('H1 the second device waits for the first (session lock)', dblink_is_busy('b') = 1);
select dblink_exec('a', 'commit');
select * from dblink_get_result('b') as x(a text, b jsonb);
select t.igual('H1 both sales counted: 10 + 15', (pg_temp.bloco(pg_temp.u('corrida'), 0)).achieved_amount, 25);
select t.igual('H1 ...2 sales', (pg_temp.cont(:'c_s', 0)).ve, 2);
-- the SAME tap delivered twice at the same moment (inconclusive answer + resend)
select dblink_exec('a', 'begin');
select * from dblink('a', format($q$select set_config('request.jwt.claim.sub', %L, false), public.defcon_lancar(%L, 'venda', %L, 0, 10, 'dinheiro', null, null, null, 'widget')$q$,
  pg_temp.u('corrida'), pg_temp.id('c3'), :'c_s')) as x(a text, b jsonb);
select dblink_send_query('b', format($q$select set_config('request.jwt.claim.sub', %L, false), public.defcon_lancar(%L, 'venda', %L, 0, 10, 'dinheiro', null, null, null, 'widget')$q$,
  pg_temp.u('corrida'), pg_temp.id('c3'), :'c_s'));
select pg_sleep(0.3);
select dblink_exec('a', 'commit');
select * from dblink_get_result('b') as x(a text, b jsonb);
select t.igual('H2 same id twice at once: counted once (25 + 10)', (pg_temp.bloco(pg_temp.u('corrida'), 0)).achieved_amount, 35);
-- widget (new) and an OLD app at the same moment, the old one with a stale screen (block 0)
select dblink_exec('a', 'begin');
select * from dblink('a', format($q$select set_config('request.jwt.claim.sub', %L, false), public.defcon_lancar(%L, 'venda', %L, 0, 20, 'dinheiro', null, null, null, 'widget')$q$,
  pg_temp.u('corrida'), pg_temp.id('c4'), :'c_s')) as x(a text, b jsonb);
select dblink_send_query('b', format($q$select set_config('request.headers', '', false);
  insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method) values (%L, %L, %L, 0, 5, 'dinheiro');
  update public.hourly_goal_blocks set valor_dinheiro = 5, achieved_amount = 5 where id = %L;
  update public.challenge_sessions set total_sold = 5 where id = %L$q$,
  pg_temp.id('c5'), pg_temp.u('corrida'), :'c_s', (pg_temp.bloco(pg_temp.u('corrida'), 0)).id, :'c_s'));
select pg_sleep(0.3);
select dblink_exec('a', 'commit');
select * from dblink_get_result('b') as x(a text);
select t.igual('H3 widget + old app at once: 35 + 20 + 5 = 60, nothing overwritten', (pg_temp.bloco(pg_temp.u('corrida'), 0)).achieved_amount, 60);
select t.igual('H3 ...session total = all sales (60)', pg_temp.total(:'c_s'), 60);
select dblink_disconnect('a'); select dblink_disconnect('b');

-- ======================================================================================
-- 8. Shadow mode and its objective approval criteria
-- ======================================================================================
-- an UNMARKED day consistent with its rows, and one that is not (a total no row explains)
select pg_temp.plano(pg_temp.u('sombra-ok'), current_date - 1);
insert into public.challenge_sessions (id, user_id, date, daily_goal, total_sold) values (pg_temp.id('so'), pg_temp.u('sombra-ok'), current_date - 1, 300, 12);
insert into public.defcon_sales (user_id, session_id, block_index, amount, method) values (pg_temp.u('sombra-ok'), pg_temp.id('so'), 0, 12, 'pix');
update public.hourly_goal_blocks set valor_pix = 12, achieved_amount = 12 where id = (pg_temp.bloco(pg_temp.u('sombra-ok'), 0, current_date - 1)).id;
insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count) values (pg_temp.id('so'), pg_temp.u('sombra-ok'), 0, 4, 1);
select public.defcon_sombra_medir(current_date - 1);
select t.verdade('I1 shadow: a consistent day measures equal everywhere',
  not exists (select 1 from public.defcon_sombra where data = current_date - 1 and classe <> 'igual'));
select pg_temp.plano(pg_temp.u('sombra-ruim'), current_date - 1);
insert into public.challenge_sessions (id, user_id, date, daily_goal, total_sold) values (pg_temp.id('sr'), pg_temp.u('sombra-ruim'), current_date - 1, 300, 40);
insert into public.defcon_sales (user_id, session_id, block_index, amount, method) values (pg_temp.u('sombra-ruim'), pg_temp.id('sr'), 0, 30, 'dinheiro');
update public.hourly_goal_blocks set valor_dinheiro = 40, achieved_amount = 40 where id = (pg_temp.bloco(pg_temp.u('sombra-ruim'), 0, current_date - 1)).id;
select public.defcon_sombra_medir(current_date - 1);
select t.igual('I2 shadow: R$ 10 no row explains = unexplained financial divergence (day and block)',
  (select count(*) from public.defcon_sombra where data = current_date - 1 and classe = 'nao_explicada'), 2);
select t.verdade('I3 approval refuses: unexplained divergences, too few days and sessions, outdated approaches',
  (select bool_and(not ok) from public.defcon_sombra_aprovacao(current_date - 1, current_date)
    where criterio in ('dias medidos', 'sessoes medidas', 'divergencias financeiras nao explicadas (total do dia)',
                       'divergencias financeiras nao explicadas (bloco)', 'abordagens desatualizadas de clientes antigos (sessoes marcadas)')));
select t.verdade('I3 ...and passes the criteria that hold (sales per block)',
  (select ok from public.defcon_sombra_aprovacao(current_date - 1, current_date) where criterio = 'divergencias de vendas por bloco'));

-- ======================================================================================
-- 9. The new app: offline sales keep their hour; closing a block sends no counts to read
-- ======================================================================================
select pg_temp.plano(pg_temp.u('volta2'));
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('volta2'));
select pg_temp.sessao(pg_temp.u('volta2')) as s \gset j_
select pg_temp.lancar(pg_temp.u('volta2'), pg_temp.id('j-on'), 'venda', :'j_s', 0, 9, 'dinheiro', 'app');
select t.logar(pg_temp.u('volta2'));
select public.defcon_lancar(pg_temp.id('j-off2'), 'venda', :'j_s'::uuid, 0, 7, 'pix', null, null, null, 'app', now() - interval '40 minutes');
select t.verdade('J1 a sale made offline 40 min ago and sent now keeps its own hour',
  (select created_at < now() - interval '39 minutes' from public.defcon_sales where id = pg_temp.id('j-off2')));
select public.defcon_lancar(pg_temp.id('j-fut'), 'venda', :'j_s'::uuid, 0, 7, 'pix', null, null, null, 'app', now() + interval '3 days');
select t.verdade('J1 ...a time in the future is never accepted', (select created_at <= now() from public.defcon_sales where id = pg_temp.id('j-fut')));
select pg_temp.lancar(pg_temp.u('volta2'), pg_temp.id('j-ab'), 'abordagem', :'j_s', 0, null, null, 'widget');
select t.verdade('J1 a signed-in client cannot claim to be the widget (origin forced to app)',
  (select origem = 'app' from public.defcon_abordagens where id = pg_temp.id('j-ab')));
-- closing the block: the new app upserts status/ended_at with whatever counters it has (here 0)
select set_config('request.headers', '{"x-vant-cliente":"2"}', false);
insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count, status, ended_at)
values (:'j_s', pg_temp.u('volta2'), 0, 0, 0, 'done', now())
on conflict (session_id, block_index) do update set approaches_count = excluded.approaches_count, sales_count = excluded.sales_count, status = excluded.status, ended_at = excluded.ended_at;
select t.verdade('J2 new app closing a block: counts stay the server''s (3 sales, 4 approaches), status saved, nothing logged as a conflict',
  (select approaches_count = 4 and sales_count = 3 and status = 'done' from public.challenge_blocks where session_id = :'j_s' and block_index = 0)
  and not exists (select 1 from public.defcon_conflitos where session_id = :'j_s')
  and (select cliente_antigo_em is null from public.challenge_sessions where id = :'j_s'));
-- stock: a ledger sale of a product goes through the same stock trigger path (product id + qty on the row)
select pg_temp.lancar(pg_temp.u('volta2'), pg_temp.id('j-prod'), 'venda', :'j_s', 0, 10, 'dinheiro', 'app') ;
select t.logar(pg_temp.u('volta2'));
select public.defcon_lancar(pg_temp.id('j-prod2'), 'venda', :'j_s'::uuid, 0, 10, 'dinheiro', pg_temp.id('produto'), 3);
select t.verdade('J3 product and quantity reach the sale row (what the stock trigger reads)',
  (select product_id = pg_temp.id('produto') and qty = 3 from public.defcon_sales where id = pg_temp.id('j-prod2')));
