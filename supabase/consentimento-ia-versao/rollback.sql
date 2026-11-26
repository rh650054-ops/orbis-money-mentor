-- Rollback of 20261126160000_consentimento_ia_versao. Run it ONLY together with the edge functions
-- and the app of before (they read "versao"): with this alone, the current functions fail closed
-- (no AI for anyone), which is safe but turns AI off.
-- The history table is kept: it is the record of every answer.
drop trigger if exists consentimento_ia_registrar on public.consentimento_ia;
drop trigger if exists a_consentimento_ia_sem_versao on public.consentimento_ia;
drop function if exists public.responder_consentimento_ia(boolean, text);
drop function if exists public._consentimento_ia_registrar();
drop function if exists public._consentimento_ia_sem_versao();
alter table public.consentimento_ia drop column if exists versao;
