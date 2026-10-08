-- 08/10/2026 — app.vantapp.com.br is live (CNAME + cert). Partner "app" links and
-- private panels now go out on the VANT app domain. The old app.orbis.inf.br keeps
-- serving the same app, so links already shared keep working.
-- The "página" link (lp_url) stays on www.orbis.inf.br until the landing moves.

insert into public.parc_config (chave, valor) values
  ('dominio', to_jsonb('https://app.vantapp.com.br'::text))
on conflict (chave) do update set valor = excluded.valor;
