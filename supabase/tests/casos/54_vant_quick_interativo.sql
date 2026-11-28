-- VANT Quick interactive (Phase 1): widget / Live Activity register in the background through a
-- scoped device credential, on top of the server-derived DEFCON totals (Phase 2). Fictional data.
\set ON_ERROR_STOP on

create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create or replace function pg_temp.dia(p_user uuid, p_rodando boolean default true) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); sid uuid; i int;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, p_user, pg_temp.hoje(), 300, 3, 'normal', 100);
  for i in 0..2 loop
    insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount, timer_status, timer_started_at)
    values (v, p_user, i, (8+i)::text || 'h', 100, case when i = 0 and p_rodando then 'running' else 'idle' end, case when i = 0 then now() - interval '20 minutes' end);
  end loop;
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks, current_block_index) values (p_user, pg_temp.hoje(), 300, 'active', 3, 0) returning id into sid;
  return sid;
end $$;
create or replace function pg_temp.emitir(p_user uuid, p_aparelho text default 'iphone-de-teste-1') returns text language plpgsql as $$
begin perform t.logar(p_user); return public.vant_quick_emitir(p_aparelho) ->> 'token'; end $$;
create or replace function pg_temp.ok(j jsonb) returns boolean language sql immutable as $$ select (j ->> 'ok')::boolean $$;
create or replace function pg_temp.esperar() returns void language sql as $$ select pg_sleep(0.75) $$;

update public.defcon_persistencia_config set marcar_novas = true;
insert into public.defcon_persistencia_contas (user_id) select pg_temp.u(k) from unnest(array['vend','old','pausa','outro']) k;

select pg_temp.dia(pg_temp.u('vend')) as s \gset v_
select pg_temp.emitir(pg_temp.u('vend')) as tk \gset v_

-- ---------------- off by default ----------------
select public.vant_quick_executar(:'v_tk', 'venda', pg_temp.id('t0')) as j \gset a_
select t.verdade('A1 interactive switch off by default: refused, nothing written',
  not pg_temp.ok(:'a_j') and :'a_j'::jsonb ->> 'motivo' = 'desativado' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('t0')));
select t.verdade('A1 ...the panel can still be read (display only)', pg_temp.ok(public.vant_quick_executar(:'v_tk', 'painel')));
update public.defcon_persistencia_config set vant_quick = true;

-- ---------------- credential ----------------
select t.verdade('B1 the token is never stored in clear', not exists (select 1 from public.vant_quick_credenciais where encode(hash, 'escape') like '%' || :'v_tk' || '%')
  and (select count(*) from public.vant_quick_credenciais where user_id = pg_temp.u('vend')) = 1);
select t.igual('B1 a client cannot read the credentials table', t.linhas_como('authenticated', pg_temp.u('vend'), 'select * from public.vant_quick_credenciais'), -1);
select t.verdade('B1 a client cannot call the executor directly', t.erro($q$select public.vant_quick_executar('x', 'venda')$q$, 'authenticated', pg_temp.u('vend')) like '42501|%');
select t.verdade('B2 an invented token is refused', public.vant_quick_executar('vq1_' || repeat('a', 64), 'venda', pg_temp.id('t1')) ->> 'motivo' = 'credencial_invalida');
select t.verdade('B2 a malformed token is refused', public.vant_quick_executar('anything', 'venda', pg_temp.id('t1')) ->> 'motivo' = 'credencial_invalida');

-- ---------------- the sale needs the VANT Quick value (its own, independent of the DEFCON) ----------------
select public.vant_quick_executar(:'v_tk', 'venda', pg_temp.id('t2')) as j \gset c_
select t.verdade('C1 no VANT Quick value yet: refused (sem_valor), nothing written', :'c_j'::jsonb ->> 'motivo' = 'sem_valor');
select t.logar(pg_temp.u('vend'));
select public.vant_quick_salvar_config(20, 'pix');

select public.vant_quick_executar(:'v_tk', 'venda', pg_temp.id('t3')) as j \gset d_
select t.verdade('D1 widget sale: confirmed only by the server answer, with its numbers',
  pg_temp.ok(:'d_j') and (:'d_j'::jsonb ->> 'aplicado')::boolean and (:'d_j'::jsonb -> 'painel' ->> 'faturamento')::numeric = 20);
select t.verdade('D1 ...registered as a normal DEFCON sale row (ranking, stock, bank check read it as today)',
  exists (select 1 from public.defcon_sales where id = pg_temp.id('t3') and amount = 20 and method = 'pix' and block_index = 0 and not late));
select t.igual('D1 ...session total derived by the server', (select total_sold from public.challenge_sessions where id = :'v_s'), 20);
-- the answer did not arrive: the iPhone resends the SAME id
select public.vant_quick_executar(:'v_tk', 'venda', pg_temp.id('t3')) as j \gset d2_
select t.verdade('D2 resend of the same id: answered as already done, not counted again',
  pg_temp.ok(:'d2_j') and (:'d2_j'::jsonb ->> 'repetido')::boolean and (select count(*) from public.defcon_sales where session_id = :'v_s') = 1);
select pg_temp.esperar();
select public.vant_quick_executar(:'v_tk', 'abordagem', pg_temp.id('t4'), 'atividade') as j \gset d3_
select t.verdade('D3 Live Activity approach: 1 sale / 2 approaches = 50% conversion',
  (:'d3_j'::jsonb -> 'painel' ->> 'abordagens')::int = 2 and (:'d3_j'::jsonb -> 'painel' ->> 'conversao')::numeric = 0.5);
select t.verdade('D3 panel: goal, remaining, block and its timer', (select
  (p ->> 'meta')::numeric = 300 and (p ->> 'restante')::numeric = 280 and (p ->> 'bloco')::int = 1 and p ->> 'blocoEstado' = 'running'
  and (p ->> 'blocoFim')::timestamptz > now() from (select :'d3_j'::jsonb -> 'painel' p) x));

-- ---------------- limits ----------------
select public.vant_quick_executar(:'v_tk', 'abordagem', pg_temp.id('t5')) as j \gset e_
select t.verdade('E1 two taps faster than a human (< 0,7 s): the second is refused, nothing written',
  :'e_j'::jsonb ->> 'motivo' = 'rapido_demais' and not exists (select 1 from public.defcon_abordagens where id = pg_temp.id('t5')));
update public.vant_quick_credenciais set usos_no_dia = 3000, uso_dia = pg_temp.hoje(), ultimo_uso_em = now() - interval '1 minute' where user_id = pg_temp.u('vend');
select t.verdade('E2 daily limit reached: refused', public.vant_quick_executar(:'v_tk', 'abordagem', pg_temp.id('t6')) ->> 'motivo' = 'limite_do_dia');
update public.vant_quick_credenciais set usos_no_dia = 0 where user_id = pg_temp.u('vend');

-- ---------------- DEFCON rules ----------------
select pg_temp.dia(pg_temp.u('pausa'), false) as s \gset p_
select pg_temp.emitir(pg_temp.u('pausa')) as tk \gset p_
select t.verdade('F1 block paused (lunch, break): refused', public.vant_quick_executar(:'p_tk', 'abordagem', pg_temp.id('p1')) ->> 'motivo' = 'bloco_parado');
select pg_temp.emitir(pg_temp.u('semdefcon')) as tk \gset n_
select t.verdade('F2 no DEFCON today: refused', public.vant_quick_executar(:'n_tk', 'abordagem', pg_temp.id('n1')) ->> 'motivo' = 'sem_defcon');
-- an old build wrote to this session: the widget stops (two writers could diverge, ADR 0001 §7.1)
select pg_temp.dia(pg_temp.u('old')) as s \gset o_
select pg_temp.emitir(pg_temp.u('old')) as tk \gset o_
select set_config('request.headers', '', false);
update public.challenge_sessions set total_sold = 1 where id = :'o_s';
select t.verdade('F3 an old app wrote to the session: refused with "update the other device"',
  public.vant_quick_executar(:'o_tk', 'abordagem', pg_temp.id('o1')) ->> 'motivo' = 'atualize_outro_aparelho');
-- a session that is not server-derived (account not switched on): the widget never writes there
select pg_temp.dia(pg_temp.u('fora')) as s \gset f_
select pg_temp.emitir(pg_temp.u('fora')) as tk \gset f_
select t.verdade('F4 session not server-derived: refused (no widget sale where no guard exists)',
  public.vant_quick_executar(:'f_tk', 'abordagem', pg_temp.id('f1')) ->> 'motivo' = 'defcon_nao_habilitado');

-- ---------------- sign-out, account switch, rotation, expiry ----------------
select t.logar(pg_temp.u('vend'));
select public.vant_quick_emitir('iphone-de-teste-1') ->> 'token' as tk \gset v2_
select t.verdade('G1 a new credential for the same device revokes the previous one (rotation)',
  public.vant_quick_executar(:'v_tk', 'painel') ->> 'motivo' = 'credencial_invalida' and pg_temp.ok(public.vant_quick_executar(:'v2_tk', 'painel')));
select t.logar(pg_temp.u('vend'));
select public.vant_quick_revogar('iphone-de-teste-1');
select t.verdade('G2 sign-out / account switch: the device credential stops at once (not even the panel)',
  public.vant_quick_executar(:'v2_tk', 'painel') ->> 'motivo' = 'credencial_invalida');
select t.logar(pg_temp.u('vend'));
select public.vant_quick_emitir('iphone-de-teste-2') ->> 'token' as tk \gset v3_
update public.vant_quick_credenciais set expira_em = now() - interval '1 second' where user_id = pg_temp.u('vend') and aparelho = 'iphone-de-teste-2';
select t.verdade('G3 expired credential: refused', public.vant_quick_executar(:'v3_tk', 'painel') ->> 'motivo' = 'credencial_expirada');
select pg_temp.emitir(pg_temp.u('outro')) as tk \gset x_
select t.verdade('G4 another account''s credential only ever sees ITS panel', (public.vant_quick_executar(:'x_tk', 'painel') -> 'painel' ->> 'sessao') is null);
select t.verdade('G5 the config is per account and only through the RPC',
  t.erro($q$insert into public.vant_quick_config values ('$q$ || pg_temp.u('outro') || $q$', 10, 'pix')$q$, 'authenticated', pg_temp.u('outro')) like '42501|%');
select t.logar(pg_temp.u('vend'));
select t.verdade('H1 the app is told to offer the buttons only when both switches are on and the account is switched on',
  (public.vant_quick_disponivel() ->> 'interativo')::boolean);
select t.logar(pg_temp.u('fora'));
select t.verdade('H1 ...an account not switched on: no buttons', not (public.vant_quick_disponivel() ->> 'interativo')::boolean);
update public.defcon_persistencia_config set vant_quick = false;
select t.logar(pg_temp.u('vend'));
select t.verdade('H1 ...interactive switch off: no buttons for anyone', not (public.vant_quick_disponivel() ->> 'interativo')::boolean);

-- ======================================================================================
-- I. The answer never reached the iPhone: asking later about the tap's id
-- ======================================================================================
update public.defcon_persistencia_config set vant_quick = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('perdida'));
select pg_temp.dia(pg_temp.u('perdida')) as s \gset q_
select pg_temp.emitir(pg_temp.u('perdida')) as tk \gset q_
select t.logar(pg_temp.u('perdida'));
select public.vant_quick_salvar_config(25, 'dinheiro');
-- I1: registered on the server, the answer lost on the way back
select public.vant_quick_executar(:'q_tk', 'venda', pg_temp.id('q1'));
update public.vant_quick_credenciais set ultimo_uso_em = now() - interval '1 minute' where user_id = pg_temp.u('perdida');
select (select usos_no_dia from public.vant_quick_credenciais where user_id = pg_temp.u('perdida') and revogado_em is null) as usos \gset q_
select public.vant_quick_executar(:'q_tk', 'status', pg_temp.id('q1')) as j \gset i1_
select t.verdade('I1 asked later: the server says it EXISTS (the iPhone shows "confirmada"), with the panel',
  pg_temp.ok(:'i1_j') and (:'i1_j'::jsonb ->> 'existe')::boolean and (:'i1_j'::jsonb -> 'painel' ->> 'faturamento')::numeric = 25);
select t.verdade('I1 ...asking created nothing and did not count as a use: still ONE sale',
  (select count(*) from public.defcon_sales where session_id = :'q_s') = 1
  and (select usos_no_dia from public.vant_quick_credenciais where user_id = pg_temp.u('perdida') and revogado_em is null) = :'q_usos');
select public.vant_quick_executar(:'q_tk', 'venda', pg_temp.id('q1')) as j \gset i1b_
select t.verdade('I1 ...and a resend of the same id after that: "repetido", still one sale',
  (:'i1b_j'::jsonb ->> 'repetido')::boolean and (select count(*) from public.defcon_sales where session_id = :'q_s') = 1);
-- I2: the request never reached the server; the iPhone asks: "not registered" -> the id is closed
select public.vant_quick_executar(:'q_tk', 'status', pg_temp.id('q2')) as j \gset i2_
select t.verdade('I2 never arrived: the server says it does NOT exist (the iPhone shows "não registrada")', not (:'i2_j'::jsonb ->> 'existe')::boolean);
select public.vant_quick_executar(:'q_tk', 'venda', pg_temp.id('q2')) as j \gset i2b_
select t.verdade('I2 ...the original request arriving AFTER that is refused: the answer given never changes, no sale',
  :'i2b_j'::jsonb ->> 'motivo' = 'encerrada' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('q2')));
-- I3: the original is STILL being processed when the iPhone asks (real parallel connections)
select dblink_connect('qa', current_setting('vant.teste_conexao'));
select dblink_connect('qb', current_setting('vant.teste_conexao'));
update public.vant_quick_credenciais set ultimo_uso_em = now() - interval '1 minute' where user_id = pg_temp.u('perdida');
select dblink_exec('qa', 'begin');
select * from dblink('qa', format($q$select public.vant_quick_executar(%L, 'venda', %L)::text$q$, :'q_tk', pg_temp.id('q3'))) as x(r text);
select dblink_send_query('qb', format($q$select public.vant_quick_executar(%L, 'status', %L)::text$q$, :'q_tk', pg_temp.id('q3')));
select pg_sleep(0.3);
select t.verdade('I3 the question waits for the original still in progress (same id, one at a time)', dblink_is_busy('qb') = 1);
select dblink_exec('qa', 'commit');
select * from dblink_get_result('qb') as x(r text) \gset i3_
select t.verdade('I3 ...then answers EXISTS: the tap is confirmed, one sale, never closed by mistake',
  (:'i3_r'::jsonb ->> 'existe')::boolean and (select count(*) from public.defcon_sales where id = pg_temp.id('q3')) = 1
  and not exists (select 1 from public.defcon_ids_encerrados where id = pg_temp.id('q3')));
select dblink_disconnect('qa'); select dblink_disconnect('qb');
select t.verdade('I4 status needs a real id and a valid credential', public.vant_quick_executar(:'q_tk', 'status') ->> 'motivo' = 'id_obrigatorio'
  and public.vant_quick_executar('vq1_' || repeat('b', 64), 'status', pg_temp.id('q1')) ->> 'motivo' = 'credencial_invalida');
