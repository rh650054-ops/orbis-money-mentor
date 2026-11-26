-- 26/11/2026: the test is 3 days for everybody; the old 30-day store courtesy grants nothing.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
do $$
begin
  insert into f select k, t.vendedor(k) from unnest(array['nova','ja']) k;
  update public.profiles set plan_status = 'trial', trial_start = current_date, trial_end = current_date + 3 where user_id in (select id from f);
  -- a courtesy granted before this change: kept with its date
  insert into public.cortesia_teste_loja (user_id, trial_end_antes) values (pg_temp.id('ja'), current_date + 3);
  update public.profiles set trial_end = date '2026-12-25' where user_id = pg_temp.id('ja');
end $$;
select md5(string_agg(user_id::text || trial_end || plan_status || coalesce(is_trial_active::text, ''), ',' order by user_id)) as antes from public.profiles \gset

select t.logar(pg_temp.id('nova'));
select public.cortesia_teste_loja_pedir() as r1 \gset
select t.verdade('T1 a new account calling the old 30-day RPC directly: fora, still exactly 3 days, nothing recorded',
  :'r1' = 'fora' and (select trial_end from public.profiles where user_id = pg_temp.id('nova')) = current_date + 3
  and not exists (select 1 from public.cortesia_teste_loja where user_id = pg_temp.id('nova')));
select public.cortesia_teste_loja_pedir() as r2 \gset
select t.verdade('T2 calling it again (installed apps): same safe answer, no error', :'r2' = 'fora');
select t.verdade('T3 no courtesy end date for a new account', public.cortesia_teste_loja_minha() is null);

select t.logar(pg_temp.id('ja'));
select public.cortesia_teste_loja_pedir() as r4 \gset
select t.verdade('T4 an old courtesy is kept: ja_tinha, 25/12 untouched, and the app can read that real date',
  :'r4' = 'ja_tinha' and (select trial_end from public.profiles where user_id = pg_temp.id('ja')) = date '2026-12-25'
  and public.cortesia_teste_loja_minha() = date '2026-12-25');
select t.verdade('T5 no profile changed at all by any of these calls',
  (select md5(string_agg(user_id::text || trial_end || plan_status || coalesce(is_trial_active::text, ''), ',' order by user_id)) from public.profiles) = :'antes');
select t.verdade('T6 the old RPC no longer writes: it is a read-only (stable SQL) function',
  (select provolatile from pg_proc where oid = 'public.cortesia_teste_loja_pedir()'::regprocedure) = 's');
