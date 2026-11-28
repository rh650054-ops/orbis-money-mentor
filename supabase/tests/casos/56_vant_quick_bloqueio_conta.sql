-- Cutting ONE account off VANT Quick at once, with its DEFCON session running. Fictional data.
\set ON_ERROR_STOP on
create or replace function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5('u-' || p)::uuid $$;
create or replace function pg_temp.id(p text) returns uuid language sql immutable as $$ select md5('id-' || p)::uuid $$;
create or replace function pg_temp.hoje() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
update public.defcon_persistencia_config set marcar_novas = true, vant_quick = true;
insert into public.defcon_persistencia_contas (user_id) values (pg_temp.u('alvo')), (pg_temp.u('outra'));
create or replace function pg_temp.dia(p_user uuid) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); sid uuid;
begin
  insert into public.daily_goal_plans (id, user_id, date, daily_goal, work_hours, mood, hourly_goal) values (v, p_user, pg_temp.hoje(), 300, 1, 'normal', 300);
  insert into public.hourly_goal_blocks (plan_id, user_id, hour_index, hour_label, target_amount, timer_status, timer_started_at) values (v, p_user, 0, '8h', 300, 'running', now());
  insert into public.challenge_sessions (user_id, date, daily_goal, status, total_blocks, current_block_index) values (p_user, pg_temp.hoje(), 300, 'active', 1, 0) returning id into sid;
  return sid;
end $$;
select pg_temp.dia(pg_temp.u('alvo')) as s \gset a_
select pg_temp.dia(pg_temp.u('outra')) as s \gset o_
select t.logar(pg_temp.u('alvo'));
select public.vant_quick_salvar_config(10, 'pix');
select public.vant_quick_emitir('iphone-alvo-0001') ->> 'token' as tk \gset a_
select t.logar(pg_temp.u('outra'));
select public.vant_quick_salvar_config(10, 'pix');
select public.vant_quick_emitir('iphone-outra-001') ->> 'token' as tk \gset o_
select t.verdade('A0 before: the account registers from the widget', (public.vant_quick_executar(:'a_tk', 'venda', pg_temp.id('a1')) ->> 'ok')::boolean);

select public.vant_quick_bloquear_conta(pg_temp.u('alvo')) as n \gset b_
select t.igual('B1 block: its live credential revoked at once', :'b_n'::int, 1);
select t.verdade('B1 ...the very next tap is refused (session still running), nothing written',
  public.vant_quick_executar(:'a_tk', 'venda', pg_temp.id('a2')) ->> 'motivo' = 'credencial_invalida' and not exists (select 1 from public.defcon_sales where id = pg_temp.id('a2')));
select t.logar(pg_temp.u('alvo'));
select t.verdade('B2 the app is told to hide the buttons', not (public.vant_quick_disponivel() ->> 'interativo')::boolean);
select t.verdade('B3 and cannot get a new credential (no way back in by reopening the app)',
  t.erro($q$select public.vant_quick_emitir('iphone-alvo-0002')$q$, null, pg_temp.u('alvo')) like '%bloqueado%');
select t.verdade('B4 the session stays server-derived: its totals stay protected (block 10 = the widget sale before the block)',
  (select totais_servidor and total_sold = 10 from public.challenge_sessions where id = :'a_s'));
select t.verdade('B5 another account is not affected', (public.vant_quick_executar(:'o_tk', 'venda', pg_temp.id('o1')) ->> 'ok')::boolean);
select public.vant_quick_bloquear_conta(pg_temp.u('alvo'), false);
select t.logar(pg_temp.u('alvo'));
select t.verdade('B6 unblocking lets it in again (a fresh credential)', public.vant_quick_emitir('iphone-alvo-0003') ? 'token');
-- hardening
select t.verdade('C1 trigger functions are not executable by clients',
  not has_function_privilege('authenticated', 'public.defcon_guarda_bloco_hora()', 'execute') and not has_function_privilege('anon', 'public.defcon_marcar_sessao()', 'execute'));
select t.verdade('C2 anon cannot call the VANT Quick config / availability', not has_function_privilege('anon', 'public.vant_quick_salvar_config(numeric,text)', 'execute')
  and not has_function_privilege('anon', 'public.vant_quick_disponivel()', 'execute') and has_function_privilege('authenticated', 'public.vant_quick_disponivel()', 'execute'));
select t.verdade('C3 a client cannot block or unblock an account', not has_function_privilege('authenticated', 'public.vant_quick_bloquear_conta(uuid,boolean)', 'execute'));
