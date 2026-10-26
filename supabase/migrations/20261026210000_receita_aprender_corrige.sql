-- 26/10: o remendo do "descubro na compra" em produto_salvar_receita não pegou (a função no
-- banco está com quebra de linha CRLF e o replace de várias linhas não casou): v_aprender ficava
-- NULL e a receita não salvava ("null value in column aprender"). Função inteira de novo,
-- já com sabores (só a BASE, variant_id is null) e aprender. Aplicada em 26/10 18:15.
create or replace function public.produto_salvar_receita(p_produto uuid, p_itens jsonb, p_rende numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  it jsonb;
  v_id uuid; v_nome text; v_qtd numeric; v_preco numeric; v_aprender boolean;
  v_ids uuid[] := '{}';
  v_sem_custo int; v_custo numeric;
begin
  if u is null then raise exception 'login necessario'; end if;
  if not exists (select 1 from public.products p where p.id = p_produto and p.user_id = u) then
    raise exception 'produto não é seu';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'receita invalida'; end if;
  if jsonb_array_length(p_itens) > 40 then raise exception 'ingredientes demais'; end if;

  if jsonb_array_length(p_itens) = 0 then
    delete from public.product_recipes where product_id = p_produto and user_id = u and variant_id is null;
    update public.products set recipe_mode = 'none', updated_at = now() where id = p_produto;
    return jsonb_build_object('ingredientes', 0);
  end if;

  if p_rende is null or p_rende < 1 or p_rende > 100000 then raise exception 'rendimento invalido'; end if;

  delete from public.product_recipes where product_id = p_produto and user_id = u and variant_id is null;

  for it in select value from jsonb_array_elements(p_itens) loop
    v_nome := left(trim(coalesce(it->>'nome', '')), 80);
    v_qtd := nullif(it->>'qtd', '')::numeric;
    v_preco := coalesce(nullif(it->>'preco', '')::numeric, 0);
    v_aprender := coalesce((it->>'aprender')::boolean, false);
    if v_aprender then v_qtd := 0; end if;
    if v_nome = '' or v_qtd is null or v_qtd < 0 or (v_qtd = 0 and not v_aprender) or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000 then
      raise exception 'ingrediente invalido';
    end if;
    v_id := null;
    if nullif(it->>'id', '') is not null then
      begin v_id := (it->>'id')::uuid; exception when others then v_id := null; end;
      if v_id is not null and not exists (select 1 from public.ingredients i where i.id = v_id and i.user_id = u) then
        raise exception 'ingrediente não é seu';
      end if;
    end if;
    if v_id is null then
      select i.id into v_id from public.ingredients i
       where i.user_id = u and lower(trim(i.name)) = lower(v_nome) order by i.created_at limit 1;
    end if;
    if v_id is null then
      insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit)
      values (u, v_nome, 'un', 0, v_preco) returning id into v_id;
    else
      update public.ingredients
         set name = v_nome,
             cost_per_unit = case when v_preco > 0 then v_preco else cost_per_unit end,
             updated_at = now()
       where id = v_id;
    end if;
    if v_id = any (v_ids) then
      update public.product_recipes set quantity = quantity + v_qtd
       where product_id = p_produto and ingredient_id = v_id and variant_id is null;
    else
      insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, aprender)
      values (u, p_produto, v_id, v_qtd, v_aprender);
      v_ids := array_append(v_ids, v_id);
    end if;
  end loop;

  select count(*) filter (where coalesce(i.cost_per_unit, 0) <= 0 and not r.aprender),
         round(sum(r.quantity * coalesce(i.cost_per_unit, 0)) / p_rende, 2)
    into v_sem_custo, v_custo
    from public.product_recipes r join public.ingredients i on i.id = r.ingredient_id
   where r.product_id = p_produto and r.variant_id is null;

  update public.products
     set recipe_mode = 'batch', batch_yield = p_rende, origem = 'faz',
         cost = case when v_sem_custo = 0 and v_custo > 0 then v_custo else cost end,
         updated_at = now()
   where id = p_produto;

  return jsonb_build_object('ingredientes', array_length(v_ids, 1), 'custo', case when v_sem_custo = 0 then v_custo end);
end $function$;

