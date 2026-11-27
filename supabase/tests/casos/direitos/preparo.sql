-- Shared by casos/4x_direitos_*.sql (this folder is not run by itself: the runner reads casos/*.sql only).
-- Loads the rights functions exactly as production runs them today and the small helpers.
\ir ../../schema/extra/direitos_producao_20261127.sql
create temp table f (k text primary key, id uuid);
create or replace function pg_temp.id(p text) returns uuid language sql as $$ select id from f where k = p $$;
-- the request comes from the app (a logged-in person) or from the backend
create or replace function pg_temp.app(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', p::text, false),
         set_config('request.jwt.claims', '{"role":"authenticated"}', false) $$;
create or replace function pg_temp.servidor() returns void language sql as $$
  select set_config('request.jwt.claim.role', '', false), set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
-- a fictional account; p_estado: 'teste' (free test running), 'sem' (never paid, test over), 'equipe' (courtesy)
create or replace function pg_temp.conta(p_k text, p_estado text default 'sem') returns uuid language plpgsql as $$
declare u uuid;
begin
  u := t.vendedor(p_k, 12, false);
  insert into f values (p_k, u);
  update public.profiles
     set plan_status = case p_estado when 'teste' then 'trial' else 'expired' end,
         is_trial_active = (p_estado = 'teste'),
         trial_start = (now() at time zone 'America/Sao_Paulo')::date - case p_estado when 'teste' then 1 else 30 end,
         trial_end = (now() at time zone 'America/Sao_Paulo')::date + case p_estado when 'teste' then 2 else -27 end,
         billing_exempt = (p_estado = 'equipe')
   where user_id = u;
  return u;
end $$;
create or replace function pg_temp.plano(p_k text) returns text language sql as $$ select plan_status from public.profiles where user_id = pg_temp.id(p_k) $$;
-- a Hotmart subscription alive in the mirror (what a webhook event leaves behind)
create or replace function pg_temp.hotmart_viva(p_k text, p_sub text, p_dias integer) returns void language sql as $$
  insert into public.hotmart_eventos (event_type, subscription_id, user_id, payload)
  values ('PURCHASE_APPROVED', p_sub, pg_temp.id(p_k),
          jsonb_build_object('data', jsonb_build_object('subscription', jsonb_build_object('status', 'ACTIVE'),
            'purchase', jsonb_build_object('date_next_charge', (extract(epoch from now() + make_interval(days => p_dias)) * 1000)::bigint::text))))
$$;
select pg_temp.servidor();
