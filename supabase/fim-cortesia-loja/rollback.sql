-- Rollback of 20261126130000_fim_cortesia_teste_loja: brings back the 30-day grant (only on a new
-- product decision). Re-run the cortesia_teste_loja_pedir() body of
-- supabase/migrations/20261028190000_cortesia_teste_loja.sql, then:
drop function if exists public.cortesia_teste_loja_minha();
