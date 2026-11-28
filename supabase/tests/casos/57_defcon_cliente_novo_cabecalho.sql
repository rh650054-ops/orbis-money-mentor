-- Which X-Client-Info values count as the ledger app. Fictional data.
\set ON_ERROR_STOP on
create or replace function pg_temp.com(p text) returns boolean language plpgsql as $$
begin
  perform set_config('request.headers', json_build_object('x-client-info', p)::text, true);
  return public.defcon_cliente_novo();
end $$;
select t.verdade('A1 build 31 (two values joined by the browser) is the new app', pg_temp.com('supabase-js-web/2.76.0, vant-livro/2 supabase-js'));
select t.verdade('A2 the fixed app (one value) is the new app', pg_temp.com('vant-livro/2 supabase-js'));
select t.verdade('A3 an old build is still an old client', not pg_temp.com('supabase-js-web/2.45.0'));
select t.verdade('A4 a look-alike inside another value does not count', not pg_temp.com('supabase-js-web/2.76.0 nao-vant-livro/2'));
select t.verdade('A5 no header at all: old client', (select not public.defcon_cliente_novo() from (select set_config('request.headers', '', true)) x));
