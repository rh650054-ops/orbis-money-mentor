-- Bug (Mohamed, 28/10/2026): "mover" in the bank statement (Raio-X) fails for everyone.
-- Since 20261021040000_seguranca_perfil_hotmart_banco the app role can no longer write
-- extrato_lancamentos directly (good: bank data is server-written). But these user actions
-- were SECURITY INVOKER, so they run with the user's role and hit "permission denied".
-- They all scope every write to auth.uid(), so running them as the owner is safe — same
-- pattern as the extrato_* functions that already work (extrato_responder, extrato_conta_uso…).
-- Direct table writes stay revoked.
alter function public.extrato_mover(uuid, text, text) security definer;
alter function public.extrato_mover_um(uuid, text) security definer;
alter function public.extrato_renomear(uuid, text) security definer;
alter function public.extrato_fora_analise(uuid, boolean) security definer;
alter function public.extrato_apagar_manual(uuid) security definer;
alter function public.extrato_apagar_arquivo(uuid) security definer;
alter function public.custo_notas_salvar(uuid, text, numeric, jsonb) security definer;
