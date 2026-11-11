-- Test doubles: stand-ins for parts of production that are NOT under test here (plan access, the
-- verified badge, the sales-spike detector, ranking positions). Each one is a deliberate
-- simplification; the money math itself always runs the real function.
create table public.teste_pro (user_id uuid primary key);            -- who "has the Pro plan" in a test
create or replace function public.orbis_pro_ativo(p_user uuid default null) returns boolean language sql stable as $$
  select exists (select 1 from public.teste_pro t where t.user_id = coalesce(p_user, auth.uid()))
$$;
create or replace function public.open_finance_teste(p_user uuid) returns boolean language sql stable as $$ select false $$;
create or replace function public.is_orbis_admin() returns boolean language sql stable as $$
  select coalesce(current_setting('teste.admin', true), '') = 'on'
$$;
create or replace function public.selo_revisar() returns integer language sql as $$ select 0 $$;
create or replace function public.defcon_anomaly_suspects(p_dias integer, p_fator numeric)
returns table(user_id uuid, ratio numeric) language sql stable as $$ select null::uuid, null::numeric where false $$;
create or replace function public.recalculate_ranking_positions(p_mes text) returns void language sql as $$ select $$;
create view public.public_profiles as select p.user_id, p.nickname, p.avatar_url from public.profiles p;
