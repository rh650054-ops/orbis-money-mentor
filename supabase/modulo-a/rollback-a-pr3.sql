-- Rollback of A-PR3 (supabase/migrations/20261112230000_modulo_a_estados_em_paralelo.sql).
--
-- Removes ONLY what that migration created: seven functions. Nothing depends on them (no trigger,
-- no view, no cron, no edge function, no screen), so removing them changes nothing for the app.
-- No CASCADE on purpose: if anything unexpected came to depend on one of them, the script stops.
--
-- What the functions wrote stays where it is, and nothing reads it: consent states in
-- of_consentimentos, their history in of_mudancas (campo = 'consentimento') and the mark in
-- of_eventos.aplicado. To take those back to how A-PR2 left them — a separate, explicit decision,
-- since it erases history — run the block at the end by hand. Everything can be rebuilt from the
-- recorded events by applying the migration again and calling public.of_estados_atualizar().
--
-- If A-PR1 is ever rolled back, roll this one back first: these functions read A-PR1's tables.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop function public.of_estados_relatorio();
drop function public.of_estados_atualizar();
drop function public.of_estados_conferir();
drop function public.of_consentimento_pede_vendedor(text);
drop function public.of_consentimento_do_estado(text, text, text, timestamptz, timestamptz);
drop function public.of_grupo_do_status(text);
drop function public.of_consentimento_do_motivo(text);

commit;

-- OPTIONAL, BY HAND, ONLY WITH EXPLICIT AUTHORISATION — back to how A-PR2 left the records:
--   begin;
--   delete from public.of_mudancas where campo = 'consentimento';
--   update public.of_consentimentos
--      set estado = 'nao_informado', estado_bruto = null, valido_ate = null, confirmado_em = null, atualizado_em = now();
--   update public.of_eventos set aplicado = null where aplicado is not null;
--   commit;
