-- 26/11/2026: two independent 3-day rules, both unchanged by the end of the store courtesy.
--   free test  = sign-up day (Brasília) + 3, usable until 23:59 of that last day, same on every platform
--   grace      = 3 days after the paid period ends, for subscribers with a late payment
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
-- the request comes from the app (a logged-in person) or from the backend
create or replace function pg_temp.app(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', p::text, false),
         set_config('request.jwt.claims', '{"role":"authenticated"}', false) $$;
create or replace function pg_temp.servidor() returns void language sql as $$
  select set_config('request.jwt.claim.role', '', false), set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
select (now() at time zone 'America/Sao_Paulo')::date as hoje \gset

-- ------------------------------------------------------------------ free test: always 3 days
insert into f select 'novo', gen_random_uuid();
insert into auth.users (id) select id from f where k = 'novo';
select pg_temp.app(pg_temp.id('novo'));
-- an app (any platform, any version) signing up and asking for 30 days and an active plan
insert into public.profiles (user_id, nickname, plan_status, is_trial_active, trial_start, trial_end, billing_exempt)
values (pg_temp.id('novo'), 'novo', 'active', true, :'hoje'::date - 10, :'hoje'::date + 30, true);
select t.verdade('D1 sign-up asking for 30 days: the server writes sign-up day + 3, plan trial, not exempt',
  (select trial_start = :'hoje'::date and trial_end = :'hoje'::date + 3 and plan_status = 'trial' and not billing_exempt
     from public.profiles where user_id = pg_temp.id('novo')));

select public.check_trial_expired(pg_temp.id('novo')) as e0 \gset
select t.verdade('D2 sign-up day: test running', :'e0' = 'f');

select pg_temp.servidor();
update public.profiles set trial_start = :'hoje'::date - 3, trial_end = :'hoje'::date where user_id = pg_temp.id('novo');
select pg_temp.app(pg_temp.id('novo'));
select public.check_trial_expired(pg_temp.id('novo')) as e3 \gset
select t.verdade('D3 third selling day (the last one): still open, until 23:59',
  :'e3' = 'f' and (select plan_status from public.profiles where user_id = pg_temp.id('novo')) = 'trial');

select pg_temp.servidor();
update public.profiles set trial_start = :'hoje'::date - 4, trial_end = :'hoje'::date - 1 where user_id = pg_temp.id('novo');
select pg_temp.app(pg_temp.id('novo'));
select public.check_trial_expired(pg_temp.id('novo')) as e4 \gset
select t.verdade('D4 the day after: the test is over (no fourth selling day)',
  :'e4' = 't' and (select plan_status = 'expired' and not is_trial_active from public.profiles where user_id = pg_temp.id('novo')));

-- an installed app trying to give itself more days, with and without the old courtesy flag
update public.profiles set trial_end = :'hoje'::date + 30, plan_status = 'trial', is_trial_active = true where user_id = pg_temp.id('novo');
begin;
select set_config('vant.cortesia_loja', '1', true);
update public.profiles set trial_end = :'hoje'::date + 30, plan_status = 'trial', is_trial_active = true where user_id = pg_temp.id('novo');
commit;
select public.cortesia_teste_loja_pedir() as rpc \gset
select t.verdade('D5 an app cannot stretch its own test: direct update, old courtesy flag and old RPC all leave it expired',
  :'rpc' = 'fora' and (select trial_end = :'hoje'::date - 1 and plan_status = 'expired' and not is_trial_active
                         from public.profiles where user_id = pg_temp.id('novo'))
  and not exists (select 1 from public.cortesia_teste_loja where user_id = pg_temp.id('novo')));

-- ------------------------------------------------------------------ grace: 3 days after the due date
select pg_temp.servidor();
insert into f select k, t.vendedor(k) from unnest(array['paga','tolera','passou','so_teste']) k;
update public.profiles set plan_status = 'trial', is_trial_active = true, trial_start = :'hoje'::date, trial_end = :'hoje'::date + 3 where user_id = pg_temp.id('so_teste');

select now() + interval '10 days' as fim \gset
select public.hotmart_acesso_aplicar(pg_temp.id('paga'), 'ativar', 'SUBPAGA', 'HP1', :'fim'::timestamptz, false) as a1 \gset
select t.verdade('G1 payment approved: access until the next charge, grace exactly 3 days after it',
  :'a1' = 'ativada' and (select current_period_end = :'fim'::timestamptz and grace_until = :'fim'::timestamptz + interval '3 days'
                           from public.subscriptions where user_id = pg_temp.id('paga')));

select public.hotmart_acesso_aplicar(pg_temp.id('tolera'), 'ativar', 'SUBTOL', 'HP2', now() + interval '1 day', false) \gset x_
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '2 days', grace_until = now() + interval '1 day' where user_id = pg_temp.id('tolera');
select public.hotmart_acesso_aplicar(pg_temp.id('passou'), 'ativar', 'SUBPAS', 'HP3', now() + interval '1 day', false) \gset y_
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '4 days', grace_until = now() - interval '1 day' where user_id = pg_temp.id('passou');
select public.expire_overdue_subscriptions() as bloqueadas \gset
select t.verdade('G2 payment 2 days late: still inside the grace, access kept',
  (select plan_status from public.profiles where user_id = pg_temp.id('tolera')) = 'active'
  and (select status from public.subscriptions where user_id = pg_temp.id('tolera')) = 'past_due');
select t.verdade('G3 payment 4 days late: grace over, access blocked',
  (select plan_status from public.profiles where user_id = pg_temp.id('passou')) = 'expired'
  and (select status from public.subscriptions where user_id = pg_temp.id('passou')) = 'expired');

-- ------------------------------------------------------------------ the two rules never mix
select t.verdade('I1 the grace job never touches someone on the free test',
  (select plan_status = 'trial' and is_trial_active and trial_end = :'hoje'::date + 3 from public.profiles where user_id = pg_temp.id('so_teste')));
update public.profiles set trial_end = :'hoje'::date - 60 where user_id = pg_temp.id('tolera');
select pg_temp.app(pg_temp.id('tolera'));
select public.check_trial_expired(pg_temp.id('tolera')) as et \gset
select t.verdade('I2 the end of the free test never blocks a subscriber inside the grace',
  :'et' = 'f' and (select plan_status from public.profiles where user_id = pg_temp.id('tolera')) = 'active');
select pg_temp.servidor();
