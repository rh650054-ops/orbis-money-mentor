-- VANT Receita Inteligente — how the seller MEASURES what he uses (25/11/2026, Rick).
--
-- "Compro 1 caixinha, uso 200 g": the ingredient keeps its own stock unit (caixinha = 'un'), and the
-- recipe line keeps storing its quantity in THAT unit (200 g of a 395 g box = 0.5063 box). So stock,
-- cost, Mercado and Produção keep working exactly as today, with no conversion on the database side.
-- This migration only REMEMBERS three things the app needs to show it back and not ask twice:
--   ingredients.conteudo_qtd / conteudo_unidade  "each caixinha has 395 g" (reused by every recipe)
--   ingredients.embalagem_nome                   "caixinha", "lata", "pacote" (wording only)
--   product_recipes.unidade_uso                  the line was typed in g (display only)
-- Additive only: no existing row, quantity, stock, cost or history is changed.
-- Rollback: supabase/medida-de-uso/rollback.sql

alter table public.ingredients
  add column if not exists conteudo_qtd numeric,
  add column if not exists conteudo_unidade text,
  add column if not exists embalagem_nome text;
alter table public.ingredients drop constraint if exists ingredients_conteudo_valido;
alter table public.ingredients add constraint ingredients_conteudo_valido check (
  (conteudo_qtd is null and conteudo_unidade is null)
  or (conteudo_qtd > 0 and conteudo_qtd <= 1000000 and conteudo_unidade in ('g', 'ml')));
alter table public.ingredients drop constraint if exists ingredients_embalagem_nome_curto;
alter table public.ingredients add constraint ingredients_embalagem_nome_curto check (embalagem_nome is null or char_length(embalagem_nome) between 1 and 30);
comment on column public.ingredients.conteudo_qtd is 'What one stock unit (a box, a can) contains, in conteudo_unidade. Only used by the app to convert what a recipe line uses; stock stays in unit.';

alter table public.product_recipes add column if not exists unidade_uso text;
alter table public.product_recipes drop constraint if exists product_recipes_unidade_uso_valida;
alter table public.product_recipes add constraint product_recipes_unidade_uso_valida check (unidade_uso is null or unidade_uso in ('un', 'g', 'kg', 'ml', 'l'));
comment on column public.product_recipes.unidade_uso is 'Unit the seller typed the line in (display only). quantity is always in the ingredient unit.';

-- p_itens: [{ nome, sabor?, unidade_uso?, conteudo_qtd?, conteudo_unidade?, embalagem? }]
-- Only the owner's rows; never touches quantity, stock_quantity or cost_per_unit.
create or replace function public.receita_definir_medidas(p_produto uuid, p_itens jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  it jsonb; v_ing uuid; v_var uuid; v_uso text; v_cq numeric; v_cu text; v_emb text; v_n integer := 0;
begin
  if u is null then raise exception 'login necessario'; end if;
  if not exists (select 1 from public.products where id = p_produto and user_id = u) then raise exception 'produto nao encontrado'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 80 then raise exception 'itens invalidos'; end if;
  for it in select value from jsonb_array_elements(p_itens) loop
    select i.id into v_ing from public.ingredients i
     where i.user_id = u and regexp_replace(lower(trim(i.name)), '\s+', ' ', 'g') = regexp_replace(lower(trim(coalesce(it->>'nome', ''))), '\s+', ' ', 'g')
     order by i.created_at limit 1;
    continue when v_ing is null;
    v_uso := nullif(lower(coalesce(it->>'unidade_uso', '')), '');
    if v_uso is not null and v_uso not in ('un', 'g', 'kg', 'ml', 'l') then raise exception 'unidade de uso invalida'; end if;
    v_cq := nullif(it->>'conteudo_qtd', '')::numeric;
    v_cu := nullif(lower(coalesce(it->>'conteudo_unidade', '')), '');
    if (v_cq is null) <> (v_cu is null) or (v_cq is not null and (v_cq <= 0 or v_cq > 1000000 or v_cu not in ('g', 'ml'))) then
      raise exception 'conteudo invalido';
    end if;
    v_emb := nullif(trim(coalesce(it->>'embalagem', '')), '');
    if v_emb is not null and char_length(v_emb) > 30 then raise exception 'embalagem invalida'; end if;
    -- what the package contains is only filled in (other recipes reuse it); its name follows the screen
    -- when the key is sent ("" or null = plain "un" again)
    if v_cq is not null or it ? 'embalagem' then
      update public.ingredients
         set conteudo_qtd = coalesce(v_cq, conteudo_qtd), conteudo_unidade = coalesce(v_cu, conteudo_unidade),
             embalagem_nome = case when it ? 'embalagem' then v_emb else embalagem_nome end, updated_at = now()
       where id = v_ing and user_id = u
         and (conteudo_qtd is distinct from coalesce(v_cq, conteudo_qtd) or conteudo_unidade is distinct from coalesce(v_cu, conteudo_unidade)
              or (it ? 'embalagem' and embalagem_nome is distinct from v_emb));
    end if;
    v_var := null;
    if nullif(trim(coalesce(it->>'sabor', '')), '') is not null then
      select v.id into v_var from public.product_variants v
       where v.product_id = p_produto and v.user_id = u and lower(trim(v.name)) = lower(trim(it->>'sabor')) limit 1;
      continue when v_var is null;
    end if;
    update public.product_recipes set unidade_uso = v_uso
     where product_id = p_produto and user_id = u and ingredient_id = v_ing and variant_id is not distinct from v_var
       and unidade_uso is distinct from v_uso;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

revoke all on function public.receita_definir_medidas(uuid, jsonb) from public, anon;
grant execute on function public.receita_definir_medidas(uuid, jsonb) to authenticated;
