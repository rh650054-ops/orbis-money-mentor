-- Rollback of 20261125180000_ajuste_estoque_ingrediente.sql. Run only with Rick's authorization.
-- Refuses while there are adjustments recorded (dropping the table would lose that history).
-- Ingredient quantities already adjusted stay as counted: rollback never rewrites stock.
begin;
do $$ begin
  if exists (select 1 from public.estoque_ajustes) then raise exception 'Há ajustes de estoque registrados: rollback recusado (nada foi alterado).'; end if;
end $$;
drop function if exists public.ingrediente_ajustar_estoque(uuid, numeric, text);
drop table if exists public.estoque_ajustes;
commit;
