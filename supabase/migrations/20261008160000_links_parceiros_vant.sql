-- 08/10/2026 — partner links move to the VANT domain.
--
-- Every partner has 3 links (+ the private panel), all built from parc_config:
--   • app        <dominio>/r/<slug>          → counts the click, opens the app with the coupon
--   • página     <lp_url><CODE>              → was orbis.inf.br/?ref=CODE: the OLD "Orbis · Beta
--                                              privado · 500 vagas" page, old brand, a waiting-list
--                                              button that never reached sign-up. Now the VANT
--                                              invite page public/conheca.html
--   • checkout   Hotmart with sck + offDiscount (unchanged)
--   • painel     <dominio>/parceiro/?t=<token>
-- Links already shared keep working: app.orbis.inf.br serves the same app, /r/ and /parceiro/,
-- and parc_clique now sends the click to the VANT domain.

insert into public.parc_config (chave, valor) values
  ('dominio', to_jsonb('https://vantapp.com.br'::text)),
  ('lp_url',  to_jsonb('https://vantapp.com.br/conheca/'::text))
on conflict (chave) do update set valor = excluded.valor;

-- Places that still had the old domain written in the function body (CRM). Patched in
-- place with a guard: the function bodies live only in the database.
do $$
declare
  d text;
begin
  -- CRM: new influencer closed → its link
  d := pg_get_functiondef('public.crm_influenciadores_before_write'::regproc);
  if position('''https://orbis.inf.br/?ref='' || candidate' in d) > 0 then
    execute replace(d, '''https://orbis.inf.br/?ref='' || candidate',
      'coalesce(public.parc_cfg(''lp_url'')#>>''{}'', ''https://vantapp.com.br/conheca/'') || candidate');
  elsif position('lp_url' in d) = 0 then
    raise exception 'crm_influenciadores_before_write changed — link patch not applied';
  end if;

  -- CRM: partner list + save return the app link
  d := pg_get_functiondef('public.crm_parceiros'::regproc);
  if position('''https://app.orbis.inf.br/?cupom='' || p.code' in d) > 0 then
    execute replace(d, '''https://app.orbis.inf.br/?cupom='' || p.code',
      'coalesce(public.parc_cfg(''dominio'')#>>''{}'', ''https://vantapp.com.br'') || ''/?cupom='' || p.code');
  end if;

  d := pg_get_functiondef('public.crm_parceiro_salvar'::regproc);
  if position('''https://app.orbis.inf.br/?cupom='' || cod' in d) > 0 then
    execute replace(d, '''https://app.orbis.inf.br/?cupom='' || cod',
      'coalesce(public.parc_cfg(''dominio'')#>>''{}'', ''https://vantapp.com.br'') || ''/?cupom='' || cod');
  end if;
end $$;

-- influencers already closed with the old page link
update public.crm_influenciadores
   set link_afiliado = 'https://vantapp.com.br/conheca/' || codigo_afiliado
 where link_afiliado like 'https://orbis.inf.br/?ref=%' and coalesce(codigo_afiliado, '') <> '';
