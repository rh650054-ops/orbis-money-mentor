-- 27/11/2026: the CPF-less Apple Sandbox test account logs in through the "E-mail" tab again
-- (migration 20261127170000). Fictional accounts and passwords only.
-- What the login needs that the base schema does not model: login e-mail and password hash on
-- auth.users, the brake table and pgcrypto (production has all three).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter table auth.users add column if not exists email text, add column if not exists encrypted_password text;
alter table public.profiles add column if not exists cpf text, add column if not exists email text, add column if not exists is_demo boolean default false;
create table if not exists public.login_tentativas (chave text primary key, tentativas integer not null default 0, janela timestamptz not null default now());
\ir direitos/preparo.sql
\ir direitos/migracoes.sql
\ir ../../migrations/20261023150000_login_email_conta_demo.sql
-- fingerprint without SQL comments: production stores the body of 23/10 without its two comment lines
select t.verdade('L0 the function under test is production''s (fingerprint read on 27/11/2026)',
  (select left(md5(lower(regexp_replace(regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g'))), 10) = 'c55c74f55d' from pg_proc where proname = 'resolve_login_email'));
select pg_temp.servidor();
create or replace function pg_temp.login(p_k text, p_email text, p_cpf text, p_demo boolean) returns uuid language plpgsql as $$
declare u uuid;
begin
  u := pg_temp.conta(p_k);
  update auth.users set email = p_email, encrypted_password = extensions.crypt('senha-certa-123', extensions.gen_salt('bf')) where id = u;
  update public.profiles set cpf = p_cpf, email = case when p_cpf is null then null else p_email end, is_demo = p_demo where user_id = u;
  return u;
end $$;
select pg_temp.login('sandbox', 'sandbox@exemplo.test', null, false);
select pg_temp.login('demo', 'demo@exemplo.test', null, true);
select pg_temp.login('cpf', 'pessoal@exemplo.test', '529.982.247-25', false);
select pg_temp.login('semcpf', 'qualquer@exemplo.test', null, false);
insert into public.apple_contas_de_teste (user_id, motivo) values (pg_temp.id('sandbox'), 'teste');
select t.verdade('L1 before the fix (production today): the Sandbox test account is refused even with the right password',
  public.resolve_login_email('sandbox@exemplo.test', 'senha-certa-123') is null);
delete from public.login_tentativas;

\ir ../../migrations/20261127170000_login_email_conta_sandbox.sql
select t.verdade('L2 after the fix: the Sandbox test account logs in with its right password, under its own login e-mail (same user, nothing recreated)',
  public.resolve_login_email('  Sandbox@Exemplo.test ', 'senha-certa-123') = 'sandbox@exemplo.test'
  and (select id from auth.users where email = 'sandbox@exemplo.test') = pg_temp.id('sandbox'));
select public.resolve_login_email('sandbox@exemplo.test', 'errada') is null as recusada \gset
select t.verdade('L3 the wrong password is still refused, and counted by the brake',
  :'recusada'::boolean
  and (select tentativas from public.login_tentativas where chave = encode(extensions.digest('sandbox@exemplo.test', 'sha256'), 'hex')) = 1);
select public.resolve_login_email('sandbox@exemplo.test', 'errada') from generate_series(1, 9) \g /dev/null
select t.verdade('L4 after 10 wrong tries in 15 minutes even the right password is refused (brake unchanged)',
  public.resolve_login_email('sandbox@exemplo.test', 'senha-certa-123') is null);
select t.verdade('L5 unchanged: demo accounts log in, CPF accounts resolve to cpf@orbis.internal',
  public.resolve_login_email('demo@exemplo.test', 'senha-certa-123') = 'demo@exemplo.test'
  and public.resolve_login_email('pessoal@exemplo.test', 'senha-certa-123') = '52998224725@orbis.internal');
select t.verdade('L6 unchanged: a CPF-less account that is neither demo nor Sandbox test is still refused',
  public.resolve_login_email('qualquer@exemplo.test', 'senha-certa-123') is null);
delete from public.apple_contas_de_teste where user_id = pg_temp.id('sandbox');
delete from public.login_tentativas;
select t.verdade('L7 removed from the Sandbox list, the account loses this door again',
  public.resolve_login_email('sandbox@exemplo.test', 'senha-certa-123') is null);
