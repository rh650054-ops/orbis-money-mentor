-- What a NEW Supabase project already has before the first migration (22/11/2026 structure, read
-- from production's catalog: columns only, no data). Used only to rehearse the full replay locally.
-- On the real staging project this file is NOT applied: the platform provides all of it.
do $$ begin
end $$;
do $$ declare n text; begin
  foreach n in array array['anon','authenticated','service_role','authenticator','supabase_auth_admin','supabase_storage_admin','dashboard_user'] loop
    if not exists (select 1 from pg_roles where rolname = n) then execute format('create role %I nologin', n); end if;
  end loop;
end $$;
alter role service_role bypassrls;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create schema if not exists auth;
create table if not exists auth.users (instance_id uuid, id uuid primary key default gen_random_uuid(), aud varchar, role varchar, email varchar, encrypted_password varchar,
  email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token varchar, confirmation_sent_at timestamptz, recovery_token varchar, recovery_sent_at timestamptz,
  email_change_token_new varchar, email_change varchar, email_change_sent_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  is_super_admin boolean, created_at timestamptz default now(), updated_at timestamptz default now(), phone text, phone_confirmed_at timestamptz, phone_change text,
  phone_change_token varchar, phone_change_sent_at timestamptz, confirmed_at timestamptz, email_change_token_current varchar, email_change_confirm_status smallint,
  banned_until timestamptz, reauthentication_token varchar, reauthentication_sent_at timestamptz, is_sso_user boolean default false, deleted_at timestamptz, is_anonymous boolean default false);
create table if not exists auth.identities (provider_id text, user_id uuid references auth.users(id) on delete cascade, identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz, email text, id uuid primary key default gen_random_uuid());
create table if not exists auth.sessions (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz, updated_at timestamptz, aal text, not_after timestamptz);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb->>'sub'), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true)::jsonb->>'role') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.email() returns text language sql stable as $$ select auth.jwt()->>'email' $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), public boolean default false,
  avif_autodetection boolean default false, file_size_limit bigint, allowed_mime_types text[], owner_id text, type text);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now(),
  updated_at timestamptz default now(), last_accessed_at timestamptz, metadata jsonb, path_tokens text[], version text, owner_id text, user_metadata jsonb);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
create or replace function storage.extension(name text) returns text language sql immutable as $$ select split_part(storage.filename(name), '.', 2) $$;
-- pg_cron / pg_net stand-ins: schedules are recorded, nothing runs (staging has no jobs)
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(p_nome text, p_quando text, p_cmd text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_nome, p_quando, p_cmd) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create or replace function cron.unschedule(p_nome text) returns boolean language sql as $$ delete from cron.job where jobname = p_nome returning true $$;
create schema if not exists net;
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 0::bigint $$;
create or replace function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 0::bigint $$;
do $$ begin if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if; end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
