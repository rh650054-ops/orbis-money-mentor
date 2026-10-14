-- Stub mínimo do Supabase pra testar a migração localmente.
do $r$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $r$;
create schema extensions; create extension pgcrypto schema extensions;
create schema auth;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
create table auth.refresh_tokens (id bigserial primary key, user_id varchar(255), session_id uuid references auth.sessions(id) on delete cascade, token text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claim.role', true), auth.jwt() ->> 'role') $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), auth.jwt() ->> 'sub'), '')::uuid $$;

create table public.admin_access (cpf text, is_super_admin boolean, enabled boolean);
create function public.is_orbis_admin() returns boolean language sql stable as $$ select false $$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cpf text, email text, nickname text, phone text,
  plan_status text, updated_at timestamptz default now(),
  is_demo boolean, billing_exempt boolean, plan_type text, subscription_id text, trial_start timestamptz, trial_end timestamptz,
  is_trial_active boolean, verificado boolean, verificado_em timestamptz, verificado_por text, ranking_hidden boolean,
  origem_ref text, origem_fixada_em timestamptz, vision_points int, streak_days int
);
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on public.profiles for select using ((select auth.uid()) = user_id);
create policy "Users can update their own profile" on public.profiles for update using ((select auth.uid()) = user_id);
create policy "Users can insert their own profile" on public.profiles for insert with check ((select auth.uid()) = user_id);
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create function public.profiles_valida_identidade() returns trigger language plpgsql as $$
begin if new.email is not null then new.email := lower(trim(new.email)); end if; return new; end $$;
create trigger profiles_valida_identidade before insert or update of cpf, phone, email on public.profiles for each row execute function public.profiles_valida_identidade();

-- cópias fiéis das travas de produção (11/10)
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF public.is_orbis_admin() THEN RETURN NEW; END IF;
  IF OLD.cpf IS NOT NULL AND btrim(OLD.cpf) <> '' THEN NEW.cpf := OLD.cpf; END IF;
  NEW.is_demo := OLD.is_demo; NEW.billing_exempt := OLD.billing_exempt; NEW.plan_type := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id; NEW.trial_start := OLD.trial_start; NEW.trial_end := OLD.trial_end;
  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired' THEN NEW.plan_status := OLD.plan_status; END IF;
  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) THEN NEW.is_trial_active := OLD.is_trial_active; END IF;
  NEW.verificado := OLD.verificado; NEW.verificado_em := OLD.verificado_em; NEW.verificado_por := OLD.verificado_por;
  NEW.ranking_hidden := OLD.ranking_hidden;
  IF NOT (coalesce(current_setting('vant.fixar_origem', true), '') = '1' AND OLD.origem_ref IS NULL) THEN
    NEW.origem_ref := OLD.origem_ref; NEW.origem_fixada_em := OLD.origem_fixada_em; END IF;
  NEW.vision_points := OLD.vision_points; NEW.streak_days := OLD.streak_days;
  RETURN NEW;
END; $function$;
create trigger protect_profile_billing before update on public.profiles for each row execute function public.protect_profile_billing_columns();
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_super boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.user_id THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.admin_access a WHERE regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g')
      AND a.is_super_admin AND a.enabled AND regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g') <> '') INTO v_super;
  IF v_super THEN RAISE EXCEPTION 'Perfil de super admin protegido: somente o proprio pode altera-lo.'; END IF;
  RETURN NEW;
END; $function$;
create trigger trg_protect_super_admin_profile before update on public.profiles for each row execute function public.protect_super_admin_profile();

create table public.cadastro_freio (chave text primary key, tentativas int not null, janela_em timestamptz not null);
CREATE OR REPLACE FUNCTION public.cadastro_pode_tentar(p_chave text, p_teto integer DEFAULT 5, p_janela_min integer DEFAULT 15)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $function$
declare v_tent integer; v_ini timestamptz;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'somente o servidor'; end if;
  insert into public.cadastro_freio (chave, tentativas, janela_em) values (p_chave, 1, now())
  on conflict (chave) do update set
    tentativas = case when public.cadastro_freio.janela_em < now() - make_interval(mins => p_janela_min) then 1 else public.cadastro_freio.tentativas + 1 end,
    janela_em  = case when public.cadastro_freio.janela_em < now() - make_interval(mins => p_janela_min) then now() else public.cadastro_freio.janela_em end
  returning tentativas, janela_em into v_tent, v_ini;
  return v_tent <= p_teto;
end; $function$;
