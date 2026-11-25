-- Rollback of 20261125120000_receita_por_unidade.sql. Run only with Rick's authorization.
-- It REFUSES while any recipe line is per unit or any product has costs without stock: removing the
-- columns would lose what the seller typed. It never deletes or rewrites a row.
-- One transaction: a refusal undoes the whole script.
begin;
do $$
begin
  if exists (select 1 from public.product_recipes where base = 'unidade')
     or exists (select 1 from public.products where custos_extras <> '[]'::jsonb) then
    raise exception 'Há receitas por unidade ou custos sem estoque gravados: rollback recusado (nada foi alterado).';
  end if;
end $$;

-- production: back to units / yield × quantity for every base line
do $$
declare d text := pg_get_functiondef('public.producao_estado_alvo(uuid,jsonb,jsonb,text)'::regprocedure);
begin
  if position('20261125120000' in d) = 0 then return; end if;
  execute replace(d, 'select r.ingredient_id, case when r.base = ''unidade'' and r.qtd_por_unidade is not null then b.u * r.qtd_por_unidade else b.u / b.y * r.quantity end as q -- 20261125120000',
                     'select r.ingredient_id, b.u / b.y * r.quantity as q');
end $$;

drop trigger if exists receita_por_unidade_rendimento on public.products;
drop function if exists public.receita_por_unidade_acompanha_rendimento();

-- the 3-arg save production ran before (md5 9aa7ac60bdc8)
drop function if exists public.produto_salvar_receita(uuid, jsonb, numeric, jsonb);
create or replace function public.produto_salvar_receita(p_produto uuid, p_itens jsonb, p_rende numeric) returns jsonb
language plpgsql security definer set search_path = public as $corpo$
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
end $corpo$;

-- recalc as production ran it before (md5 83cd727a49e3)
create or replace function public.recalc_custo_produtos_do_ingrediente(p_ingredient_id uuid) returns void
language plpgsql security definer set search_path = public as $corpo$
declare
  v_dono uuid;
begin
  select i.user_id into v_dono from public.ingredients i where i.id = p_ingredient_id;
  if v_dono is null then return; end if;
  if auth.uid() is not null
     and auth.uid() <> v_dono
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_orbis_admin() then
    raise exception 'ingrediente não é seu';
  end if;
  -- só a BASE entra no custo do produto; o extra de cada sabor é somado em produto_sabores()
  update public.products p
     set cost = case when p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0
                     then round(sub.custo / p.batch_yield, 2)
                     else round(sub.custo, 2) end,
         updated_at = now()
    from (select r.product_id,
                 sum(r.quantity * coalesce(i.cost_per_unit, 0))::numeric as custo
            from public.product_recipes r
            join public.ingredients i on i.id = r.ingredient_id
           where r.variant_id is null
             and r.product_id in (select r2.product_id from public.product_recipes r2
                                   where r2.ingredient_id = p_ingredient_id)
           group by r.product_id) sub
   where p.id = sub.product_id and p.user_id = v_dono;
end $corpo$;

drop function if exists public.custo_extra_por_unidade(jsonb, numeric);
alter table public.products drop column if exists custos_extras;
alter table public.product_recipes drop column if exists qtd_por_unidade, drop column if exists base;
commit;
