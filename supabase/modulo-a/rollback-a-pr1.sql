-- Rollback of A-PR1 (supabase/migrations/20261111170000_modulo_a_conexoes_espelho.sql).
--
-- Removes ONLY what that migration created: 5 functions and 9 tables, all prefixed of_
-- (the foreign keys to auth.users belong to those tables and go with them).
-- Nothing else depends on them (no trigger, no view, no foreign key from an older table, no
-- cron, no edge function, no screen), so removing them changes nothing for the app.
--
-- Same guard as the migration: one transaction that gives up after 3 seconds waiting for a lock.
-- NOTE: removing the foreign keys needs, for an instant, a lock on auth.users that blocks reads
-- as well as writes (stronger than the one the migration takes). Run it at a quiet hour.
-- No CASCADE on purpose: if anything unexpected came to depend on one of these objects, the
-- script stops instead of dragging that thing along.
--
-- What is lost: the mirror rows and their history (of_mudancas, of_espelho_execucoes). The
-- origin data (bank_connections, bank_saldos) is never touched, so the mirror can be rebuilt by
-- applying the migration again and calling public.of_espelho_atualizar().
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop function public.of_espelho_atualizar();
drop function public.of_espelho_relatorio();
drop function public.of_espelho_duplicadas();
drop function public.of_espelho_conferir(timestamptz);
drop function public.of_vinculo_conta_de_venda(uuid, timestamptz);

drop table public.of_espelho_execucoes;
drop table public.of_mudancas;
drop table public.of_eventos;
drop table public.of_finalidades;
drop table public.of_consentimentos;
drop table public.of_vinculo_contas;
drop table public.of_contas;
drop table public.of_vinculos;
drop table public.of_provedores;

commit;
