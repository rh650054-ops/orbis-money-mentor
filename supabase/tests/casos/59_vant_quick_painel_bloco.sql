-- The panel carries the current block (what the Dynamic Island draws), equal to what the DEFCON stores.
-- Fictional data. Regression of 28/11: island R$ 0,00 while the lock screen showed R$ 120,00.
\set ON_ERROR_STOP on
create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
update public.defcon_persistencia_config set marcar_novas = true, vant_quick = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('ilha'));
do $$
declare v uuid := gen_random_uuid();
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, md5('u-ilha')::uuid, (now() at time zone 'America/Sao_Paulo')::date, 270, 2, 'normal', 33.75);
  insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount, timer_status, timer_started_at) values
    (v, md5('u-ilha')::uuid, 0, '8h', 33.75, 'running', now()), (v, md5('u-ilha')::uuid, 1, '9h', 33.75, 'idle', null);
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks, current_block_index) values (md5('u-ilha')::uuid, (now() at time zone 'America/Sao_Paulo')::date, 270, 'active', 2, 0);
end $$;
select t.logar(pg_temp.u('ilha'));
select public.vant_quick_salvar_config(20, 'pix');
select public.vant_quick_emitir('iphone-ilha-0001') ->> 'token' as tk \gset
reset role;
select t.verdade('A1 before any sale: the block is R$ 0, goal per hour R$ 33,75, 0 sales',
  (public.vant_quick_painel(pg_temp.u('ilha')) ->> 'faturamentoBloco')::numeric = 0
  and (public.vant_quick_painel(pg_temp.u('ilha')) ->> 'metaHora')::numeric = 33.75
  and (public.vant_quick_painel(pg_temp.u('ilha')) ->> 'vendasBloco')::int = 0);
-- six R$ 20 Pix sales from the lock screen, as on Rick's iPhone; the last answer is what the iPhone copies
create or replace function pg_temp.esperar() returns void language sql as $$ update public.vant_quick_credenciais set ultimo_uso_em = now() - interval '5 seconds' $$;
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v1'), 'atividade') is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v2'), 'atividade') is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v3'), 'atividade') is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v4'), 'widget') is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v5'), 'widget') is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v6'), 'atividade') -> 'painel' as p \gset
select t.verdade('B1 the tap''s answer carries the block: R$ 120 and 6 sales (the island no longer stays at R$ 0)',
  ((:'p'::jsonb) ->> 'faturamentoBloco')::numeric = 120 and ((:'p'::jsonb) ->> 'vendasBloco')::int = 6);
select t.verdade('B2 and the day agrees with it: one block, so day = block = R$ 120 (lock screen = island)',
  ((:'p'::jsonb) ->> 'faturamento')::numeric = ((:'p'::jsonb) ->> 'faturamentoBloco')::numeric);
select t.verdade('B3 the block numbers are the DEFCON''s own columns (achieved_amount, target_amount, challenge_blocks.sales_count)',
  ((:'p'::jsonb) ->> 'faturamentoBloco')::numeric = (select achieved_amount from public.hourly_goal_blocks where user_id = pg_temp.u('ilha') and hour_index = 0)
  and ((:'p'::jsonb) ->> 'metaHora')::numeric = 33.75
  and ((:'p'::jsonb) ->> 'vendasBloco')::int = (select sales_count from public.challenge_blocks where user_id = pg_temp.u('ilha') and block_index = 0));
-- next block, as the ledger app moves it (identified as the new app: no "old client" mark)
select set_config('request.headers', '{"x-client-info":"vant-livro/2 supabase-js"}', false) is not null as x \gset
update public.hourly_goal_blocks set timer_status = 'completed' where user_id = pg_temp.u('ilha') and hour_index = 0;
update public.hourly_goal_blocks set timer_status = 'running', timer_started_at = now() where user_id = pg_temp.u('ilha') and hour_index = 1;
update public.challenge_sessions set current_block_index = 1 where user_id = pg_temp.u('ilha');
select set_config('request.headers', '', false) is not null as x \gset
select pg_temp.esperar(); select public.vant_quick_executar(:'tk', 'venda', pg_temp.id('v7'), 'atividade') as r7 \gset
select t.verdade('B4 a sale in block 2: island R$ 20 / 1 sale (this block), lock screen R$ 140 (the day)',
  ((:'r7'::jsonb) -> 'painel' ->> 'faturamentoBloco')::numeric = 20 and ((:'r7'::jsonb) -> 'painel' ->> 'vendasBloco')::int = 1
  and ((:'r7'::jsonb) -> 'painel' ->> 'faturamento')::numeric = 140 and ((:'r7'::jsonb) -> 'painel' ->> 'bloco')::int = 2);
select t.verdade('B5 no session today: the panel has no block numbers to show (nothing invented)',
  not (public.vant_quick_painel(pg_temp.u('ninguem')) ? 'faturamentoBloco'));
-- C. review of 28/11: ordering stamp and the function's permissions
select public.vant_quick_painel(pg_temp.u('ilha')) ->> 'geradoEm' as g1 \gset
select pg_sleep(0.01) is not null as x \gset
select public.vant_quick_painel(pg_temp.u('ilha')) ->> 'geradoEm' as g2 \gset
select t.verdade('C1 every panel carries the server time it was built (ms); a later panel has a later stamp',
  :'g1'::numeric > 1.7e12 and :'g2'::numeric > :'g1'::numeric);
select t.verdade('C2 no session today: still stamped (the widget orders "Comece o DEFCON" too)',
  public.vant_quick_painel(pg_temp.u('ninguem')) ? 'geradoEm');
select t.verdade('C3 permissions unchanged: security definer, search_path=public, no execute for anon / authenticated',
  (select prosecdef and proconfig = array['search_path=public'] from pg_proc where oid = 'public.vant_quick_painel(uuid)'::regprocedure)
  and not has_function_privilege('anon', 'public.vant_quick_painel(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.vant_quick_painel(uuid)', 'execute'));
