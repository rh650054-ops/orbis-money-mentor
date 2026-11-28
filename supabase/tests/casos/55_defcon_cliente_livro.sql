-- The app writing through the ledger (ADR 0001, Phase 2 new client). Fictional data only.
\set ON_ERROR_STOP on
create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.dia(p_user uuid) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); sid uuid; i int;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, p_user, current_date, 300, 2, 'normal', 150);
  for i in 0..1 loop insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount) values (v, p_user, i, i::text, 150); end loop;
  insert into public.challenge_sessions (user_id, date, daily_goal, total_blocks) values (p_user, current_date, 300, 2) returning id into sid;
  return sid;
end $$;
create or replace function pg_temp.bloco(p_user uuid, p_idx int) returns public.hourly_goal_blocks language sql as $$
  select hb.* from public.hourly_goal_blocks hb join public.daily_goal_plans p on p.id = hb.plan_id where p.user_id = p_user and p.date = current_date and hb.hour_index = p_idx $$;
create or replace function pg_temp.como_app(p_user uuid) returns void language sql as $$
  select t.logar(p_user), set_config('request.headers', '{"x-client-info":"vant-livro/2 supabase-js"}', false) $$;
create or replace function pg_temp.como_build_antigo() returns void language sql as $$
  select set_config('request.headers', '{"x-client-info":"supabase-js-web/2.45.0"}', false) $$;

update public.defcon_persistencia_config set marcar_novas = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('app'));
select pg_temp.dia(pg_temp.u('app')) as s \gset a_
select pg_temp.dia(pg_temp.u('fora')) as s \gset f_

-- who is who
select pg_temp.como_app(pg_temp.u('app'));
select t.verdade('A1 the new app (x-client-info vant-livro/2) is recognised', public.defcon_cliente_novo());
select pg_temp.como_build_antigo();
select t.verdade('A1 a build that writes totals (plain supabase-js) is not', not public.defcon_cliente_novo());
select set_config('request.headers', '', false);
select t.verdade('A1 no headers at all: not the new app', not public.defcon_cliente_novo());

-- the new app's sales, approach, late Pix, tip
select pg_temp.como_app(pg_temp.u('app'));
select public.defcon_lancar(pg_temp.id('v1'), 'venda', :'a_s'::uuid, 0, 30, 'dinheiro');
select public.defcon_lancar(pg_temp.id('v2'), 'venda', :'a_s'::uuid, 0, 20, 'cartao');
select public.defcon_lancar(pg_temp.id('lp'), 'venda_tardia', :'a_s'::uuid, 0, 10);
select public.defcon_lancar(pg_temp.id('ab'), 'abordagem', :'a_s'::uuid, 0);
select t.verdade('B1 block: 30 cash + 20 card + 10 late Pix = 60; 2 sales, 3 approaches',
  (select achieved_amount = 60 and valor_pix = 10 from pg_temp.bloco(pg_temp.u('app'), 0))
  and (select sales_count = 2 and approaches_count = 3 from public.challenge_blocks where session_id = :'a_s' and block_index = 0));

-- "Como recebeu" by block id (the screens know blocks, not session indexes)
select public.defcon_redistribuir_bloco(pg_temp.id('rs1'), (pg_temp.bloco(pg_temp.u('app'), 0)).id,
  '{"dinheiro":20,"cartao":20,"pix":10,"calote":10}'::jsonb) as j \gset c_
select t.verdade('C1 Como recebeu on a ledger block: applied by the server (cash 20, calote 10, total 60)',
  (:'c_j'::jsonb ->> 'livro')::boolean and (select valor_dinheiro = 20 and valor_calote = 10 and achieved_amount = 60 from pg_temp.bloco(pg_temp.u('app'), 0)));
select public.defcon_redistribuir_bloco(pg_temp.id('rs1'), (pg_temp.bloco(pg_temp.u('app'), 0)).id, '{"dinheiro":20,"cartao":20,"pix":10,"calote":10}'::jsonb);
select t.igual('C1 ...the same id again: one ajuste', (select count(*) from public.defcon_ajustes where session_id = :'a_s' and tipo = 'redistribuicao'), 1);
select t.verdade('C2 a re-split that changes the block total is refused (e.g. a sale came in meanwhile)',
  t.erro($q$select public.defcon_redistribuir_bloco(md5('id-rs2')::uuid, '$q$ || (pg_temp.bloco(pg_temp.u('app'), 0)).id || $q$'::uuid, '{"dinheiro":50,"cartao":20,"pix":10,"calote":0}'::jsonb)$q$, null, pg_temp.u('app')) like '%redistribuicao_muda_total%');
select t.logar(pg_temp.u('fora'));
select t.verdade('C3 a block of a session that is not the ledger''s: {livro:false}, the app keeps today''s path',
  not (public.defcon_redistribuir_bloco(pg_temp.id('rs3'), (pg_temp.bloco(pg_temp.u('fora'), 0)).id, '{"dinheiro":0}'::jsonb) ->> 'livro')::boolean);
select t.verdade('C4 another account''s block is refused',
  t.erro($q$select public.defcon_redistribuir_bloco(md5('id-rs4')::uuid, '$q$ || (pg_temp.bloco(pg_temp.u('app'), 0)).id || $q$'::uuid, '{}'::jsonb)$q$, null, pg_temp.u('fora')) like '%bloco_invalido%');

-- the new app's other absolute writes on a ledger session never touch money nor flag it as old
select pg_temp.como_app(pg_temp.u('app'));
update public.challenge_sessions set total_sold = 1, current_block_index = 1 where id = :'a_s';
update public.hourly_goal_blocks set timer_status = 'running', is_completed = true where id = (pg_temp.bloco(pg_temp.u('app'), 0)).id;
select t.verdade('D1 new app moving to the next block: timer/index saved, totals untouched, session NOT flagged as old',
  (select total_sold = 60 and current_block_index = 1 and cliente_antigo_em is null from public.challenge_sessions where id = :'a_s')
  and (select achieved_amount = 60 and is_completed from pg_temp.bloco(pg_temp.u('app'), 0)));
-- an old build on the same session (second phone): flagged, so VANT Quick stops (ADR 0001 §7.1)
select pg_temp.como_build_antigo();
update public.challenge_sessions set total_sold = 2 where id = :'a_s';
select t.verdade('D2 an old build writing the same session: flagged as old, totals still the server''s',
  (select total_sold = 60 and cliente_antigo_em is not null from public.challenge_sessions where id = :'a_s'));

-- ======================================================================================
-- E. Three writers at the same moment (real parallel connections): the new app, the widget
--    (server path, same ledger) and an OLD build on a second phone with an outdated screen
-- ======================================================================================
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('tres'));
select pg_temp.dia(pg_temp.u('tres')) as s \gset e_
select dblink_connect('app', current_setting('vant.teste_conexao'));
select dblink_connect('wid', current_setting('vant.teste_conexao'));
select dblink_connect('old', current_setting('vant.teste_conexao'));
select dblink_exec('app', 'begin');
select * from dblink('app', format($q$select set_config('request.jwt.claim.sub', %L, false), set_config('request.headers', '{"x-client-info":"vant-livro/2"}', false),
  public.defcon_lancar(%L, 'venda', %L, 0, 15, 'pix')::text$q$, pg_temp.u('tres'), pg_temp.id('e-app'), :'e_s')) as x(a text, b text, c text);
-- the widget and the old phone fire while the app's transaction still holds the session
select dblink_send_query('wid', format($q$select public.defcon_lancar_conta(%L, %L, 'venda', %L, 0, 20, 'dinheiro', null, null, null, 'widget')::text$q$,
  pg_temp.u('tres'), pg_temp.id('e-wid'), :'e_s'));
select dblink_send_query('old', format($q$select set_config('request.headers', '{"x-client-info":"supabase-js-web/2.45.0"}', false);
  insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method) values (%L, %L, %L, 0, 5, 'dinheiro');
  update public.hourly_goal_blocks set valor_dinheiro = 5, valor_pix = 0, achieved_amount = 5 where id = %L;
  update public.challenge_sessions set total_sold = 5 where id = %L;
  insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count) values (%L, %L, 0, 1, 1)
    on conflict (session_id, block_index) do update set approaches_count = excluded.approaches_count, sales_count = excluded.sales_count$q$,
  pg_temp.id('e-old'), pg_temp.u('tres'), :'e_s', (pg_temp.bloco(pg_temp.u('tres'), 0)).id, :'e_s', :'e_s', pg_temp.u('tres')));
select pg_sleep(0.4);
select t.verdade('E1 the widget waits for the app (session lock)', dblink_is_busy('wid') = 1);
select dblink_exec('app', 'commit');
select * from dblink_get_result('wid') as x(r text);
select * from dblink_get_result('old') as x(r text);
select t.verdade('E1 three writers at once: 15 Pix + 20 cash + 5 cash = 40, split kept (Pix 15), 3 sales, 3 approaches',
  (select achieved_amount = 40 and valor_pix = 15 and valor_dinheiro = 25 from pg_temp.bloco(pg_temp.u('tres'), 0))
  and (select sales_count = 3 and approaches_count = 3 from public.challenge_blocks where session_id = :'e_s' and block_index = 0)
  and (select total_sold = 40 from public.challenge_sessions where id = :'e_s'));
select t.verdade('E1 ...no ajuste was invented from the old phone''s outdated absolute values',
  not exists (select 1 from public.defcon_ajustes where session_id = :'e_s'));
select dblink_disconnect('app'); select dblink_disconnect('wid'); select dblink_disconnect('old');
