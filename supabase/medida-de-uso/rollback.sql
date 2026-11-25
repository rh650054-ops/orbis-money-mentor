-- Rollback of 20261125200000_medida_de_uso. Only removes what it added. The app already works without
-- it (it probes the columns), and recipe quantities are stored in the ingredient's own unit, so no
-- quantity, stock or cost depends on these columns.
drop function if exists public.receita_definir_medidas(uuid, jsonb);
alter table public.product_recipes drop constraint if exists product_recipes_unidade_uso_valida;
alter table public.product_recipes drop column if exists unidade_uso;
alter table public.ingredients drop constraint if exists ingredients_conteudo_valido;
alter table public.ingredients drop constraint if exists ingredients_embalagem_nome_curto;
alter table public.ingredients drop column if exists conteudo_qtd, drop column if exists conteudo_unidade, drop column if exists embalagem_nome;
