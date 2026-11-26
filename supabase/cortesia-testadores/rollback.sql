-- Rollback of 20261126130000: restores the previous cortesia_teste_loja_pedir (no testers list).
-- Run the function body of supabase/migrations/20261028190000_cortesia_teste_loja.sql again, then:
drop function if exists public.cortesia_teste_loja_minha();
drop function if exists public.testadores_loja_adicionar(text[]);
drop table if exists public.testadores_loja;
