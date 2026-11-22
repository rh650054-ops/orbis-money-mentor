-- Rollback of 20261122120000_producao_integridade.sql (Etapa 1).
-- Removes ONLY what that migration created. Refuses to run if any production was already recorded
-- through the new functions: that history is data, and data is never deleted without Rick's yes.
-- Nothing else (products, ingredients, old functions, sales) is touched.
begin;
do $$
begin
  if to_regclass('public.producao_eventos') is not null and exists (select 1 from public.producao_eventos) then
    raise exception 'Rollback recusado: já existe produção registrada pelo novo fluxo. Peça autorização antes de apagar esse histórico.';
  end if;
end $$;
drop function if exists public.producao_registrar(text, jsonb, jsonb, text);
drop function if exists public.producao_corrigir(uuid, text, jsonb, jsonb, text);
drop function if exists public.producao_desfazer(uuid, text, text);
drop function if exists public.producao_gravar(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, text, text);
drop function if exists public.producao_aplicar(uuid, uuid, uuid, jsonb);
drop function if exists public.producao_deltas(jsonb, jsonb);
drop function if exists public.producao_estado_atual(uuid);
drop function if exists public.producao_estado_alvo(uuid, jsonb, jsonb);
drop function if exists public.producao_repetido(uuid, text, text);
drop function if exists public.producao_validar_chave(text);
drop function if exists public.producao_num(numeric);
drop table if exists public.producao_movimentos, public.producao_consumos, public.producao_itens, public.producao_eventos, public.producao_registros;
drop function if exists public.producao_imutavel();
drop function if exists public.producao_sem_truncate();
commit;
