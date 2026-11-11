-- Rollback of A-PR1 (supabase/migrations/20261111170000_modulo_a_conexoes_espelho.sql).
--
-- Removes ONLY what that migration created: 9 functions and 11 tables, all prefixed of_
-- (the triggers and the foreign keys to auth.users belong to those tables and go with them).
-- Nothing else depends on them (no trigger, no view, no foreign key from or to an older table,
-- no cron, no edge function, no screen), so removing them changes nothing for the app.
-- No CASCADE on purpose: if anything unexpected came to depend on one of these objects, the
-- script stops instead of dragging that thing along.
--
-- STOP if a retention is in force (select * from public.of_retencoes where encerrada_em is null):
-- dropping of_retidos would erase records an obligation says to keep. Export them first.
--
-- What is lost: the mirror rows and their history (of_mudancas, of_espelho_execucoes). The
-- origin data (bank_connections, bank_saldos) is never touched, so the mirror can be rebuilt by
-- applying the migration again and calling public.of_espelho_atualizar().
begin;

drop function public.of_retencao_expurgar_vencidas();
drop function public.of_retencao_encerrar(bigint, text);
drop function public.of_retencao_registrar(uuid, text, text, timestamptz, text);
drop function public.of_espelho_atualizar();
drop function public.of_espelho_relatorio();
drop function public.of_espelho_duplicadas();
drop function public.of_espelho_conferir(timestamptz);
drop function public.of_vinculo_conta_de_venda(uuid, timestamptz);

drop table public.of_retidos;
drop table public.of_retencoes;
drop table public.of_espelho_execucoes;
drop table public.of_mudancas;
drop table public.of_eventos;
drop table public.of_finalidades;
drop table public.of_consentimentos;
drop table public.of_vinculo_contas;
drop table public.of_contas;
drop table public.of_vinculos;
drop table public.of_provedores;
drop function public.of_guardar_se_retido();

commit;
