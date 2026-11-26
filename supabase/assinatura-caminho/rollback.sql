-- Rollback of 20261126120000_assinatura_caminho: read-only functions + the check log. The app falls
-- back to the old checkout when the functions do not exist.
drop function if exists public.assinar_token_caminho(text);
drop function if exists public.assinatura_caminho();
drop function if exists public.assinatura_caminho_de(uuid);
drop table if exists public.hotmart_conciliacoes;
