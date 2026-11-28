-- ============================================================================================
-- DEFCON: recognise the ledger app even when the browser joined two X-Client-Info values.
-- Build 31 sends "supabase-js-web/2.76.0, vant-livro/2 supabase-js" (supabase-js's default key and
-- the app's lower-case key were merged by fetch). The old check wanted the value to START with
-- vant-livro/, so every write of build 31 marked its own session as an old client and VANT Quick
-- answered "Atualize a VANT no outro aparelho". Old builds never send vant-livro/: they stay old.
-- ============================================================================================
create or replace function public.defcon_cliente_novo() returns boolean
language sql stable set search_path to 'public' as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', '') ~ '(^|,)\s*vant-livro/'
      or coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-vant-cliente', '') <> ''
$$;
