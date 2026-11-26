-- Store-test courtesy (26/11/2026): 30 days only for an e-mail on the admin's testers list.
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
do $$
begin
  insert into f select k, t.vendedor(k) from unnest(array['testador','qualquer','antigo','ja']) k;
  update auth.users set email = 'testador@exemplo.com' where id = pg_temp.id('testador');
  update auth.users set email = 'qualquer@exemplo.com' where id = pg_temp.id('qualquer');
  update public.profiles set plan_status = 'trial', trial_start = current_date, trial_end = current_date + 3 where user_id in (select id from f);
  update auth.users set email = 'antigo@exemplo.com' where id = pg_temp.id('antigo');
  update public.profiles set created_at = now() - interval '20 days' where user_id = pg_temp.id('antigo');
  insert into public.testadores_loja (email) values ('testador@exemplo.com'), ('antigo@exemplo.com');
  -- a courtesy already granted before this change: kept with its date
  insert into public.cortesia_teste_loja (user_id, trial_end_antes) values (pg_temp.id('ja'), current_date + 3);
  update public.profiles set trial_end = date '2026-12-25' where user_id = pg_temp.id('ja');
end $$;

select t.logar(pg_temp.id('qualquer'));
select public.cortesia_teste_loja_pedir() as r1 \gset
select t.verdade('T1 a new account NOT on the testers list calling the RPC directly: fora, still 3 days',
  :'r1' = 'fora' and (select trial_end from public.profiles where user_id = pg_temp.id('qualquer')) = current_date + 3
  and not exists (select 1 from public.cortesia_teste_loja where user_id = pg_temp.id('qualquer')));
select t.logar(pg_temp.id('testador'));
select public.cortesia_teste_loja_pedir() as r2 \gset
select t.verdade('T2 an eligible tester: 30 days from the start', :'r2' = 'aplicada'
  and (select trial_end from public.profiles where user_id = pg_temp.id('testador')) = current_date + 30);
select public.cortesia_teste_loja_pedir() as r3 \gset
select t.verdade('T3 asking again: ja_tinha, date unchanged', :'r3' = 'ja_tinha'
  and (select trial_end from public.profiles where user_id = pg_temp.id('testador')) = current_date + 30);
select t.verdade('T4 the app reads the exact end date of its own courtesy', public.cortesia_teste_loja_minha() = current_date + 30);
select t.logar(pg_temp.id('antigo'));
select public.cortesia_teste_loja_pedir() as r5 \gset
select t.verdade('T5 a listed e-mail on an account older than 7 days: fora', :'r5' = 'fora');
select t.logar(pg_temp.id('ja'));
select t.verdade('T6 a courtesy granted before this change is kept (25/12), nothing revoked',
  public.cortesia_teste_loja_pedir() = 'ja_tinha' and (select trial_end from public.profiles where user_id = pg_temp.id('ja')) = date '2026-12-25');
select t.logar(pg_temp.id('qualquer'));
select t.verdade('T7 only the admin adds testers', t.erro('select public.testadores_loja_adicionar(array[''eu@exemplo.com''])') <> 'ok'
  and not exists (select 1 from public.testadores_loja where email = 'eu@exemplo.com'));
select t.verdade('T8 the testers list is not readable by the app', not has_table_privilege('authenticated', 'public.testadores_loja', 'SELECT'));
