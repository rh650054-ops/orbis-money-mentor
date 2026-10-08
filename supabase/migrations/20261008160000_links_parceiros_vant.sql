-- 08/10/2026 — partner links read the domains from parc_config (one place to switch).
--
-- Every partner has 3 links (+ the private panel), all built from parc_config:
--   • app        <dominio>/r/<slug>   → counts the click, opens the app with the coupon
--   • página     <lp_url><CODE>       → the landing page that captures the lead (leads.ref)
--   • checkout   Hotmart with sck + offDiscount (unchanged)
--   • painel     <dominio>/parceiro/?t=<token>
--
-- Rick (08/10): the "página" link is the real landing page (www.orbis.inf.br), not a
-- new page. It moves to the VANT domain together with the app (see the next migration):
-- landing at vantapp.com.br, app at app.vantapp.com.br. Until that DNS exists the links
-- stay on the addresses that work today.

insert into public.parc_config (chave, valor) values
  ('lp_url', to_jsonb('https://www.orbis.inf.br/?ref='::text))
on conflict (chave) do nothing;

-- CRM functions that had the domain written in the body now read the config.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.crm_influenciadores_before_write'::regproc);
  if position('''https://orbis.inf.br/?ref='' || candidate' in d) > 0 then
    execute replace(d, '''https://orbis.inf.br/?ref='' || candidate',
      'coalesce(public.parc_cfg(''lp_url'')#>>''{}'', ''https://www.orbis.inf.br/?ref='') || candidate');
  elsif position('lp_url' in d) = 0 then
    raise exception 'crm_influenciadores_before_write changed — link patch not applied';
  end if;

  d := pg_get_functiondef('public.crm_parceiros'::regproc);
  if position('''https://app.orbis.inf.br/?cupom='' || p.code' in d) > 0 then
    execute replace(d, '''https://app.orbis.inf.br/?cupom='' || p.code',
      'coalesce(public.parc_cfg(''dominio'')#>>''{}'', ''https://app.orbis.inf.br'') || ''/?cupom='' || p.code');
  end if;

  d := pg_get_functiondef('public.crm_parceiro_salvar'::regproc);
  if position('''https://app.orbis.inf.br/?cupom='' || cod' in d) > 0 then
    execute replace(d, '''https://app.orbis.inf.br/?cupom='' || cod',
      'coalesce(public.parc_cfg(''dominio'')#>>''{}'', ''https://app.orbis.inf.br'') || ''/?cupom='' || cod');
  end if;
end $$;
