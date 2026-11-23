-- Test fixture (23/11/2026): the four old product functions EXACTLY as production runs them.
-- The repo's newest CREATE of these is older than production: later migrations patched them in
-- place from pg_get_functiondef (20261026180000 "base only", 20261026200000 "aprender"), which the
-- function loader cannot see. Bodies are rebuilt from the repo + those patches. Production stores
-- them with CRLF line endings (and two LF-only lines the "aprender" patch inserted); git keeps this
-- file LF, so each body is converted at load time. Case 28 asserts md5(prosrc) = the md5 read from
-- production on 23/11/2026, written next to each function. No data, only code.

-- produto_produzir: md5(prosrc) in production = 1272f481bb43e3b57212dc661b6e6d84
do $do$
declare c text := replace($corpo$
declare
  u uuid := auth.uid();
  p record; m record; r record; it jsonb;
  v_frac numeric; v_lotes numeric; v_id uuid; v_compra uuid; v_restante numeric := null;
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_unidades is null or p_unidades < 1 or p_unidades > 1000000 then raise exception 'unidades invalidas'; end if;
  select * into p from public.products where id = p_produto and user_id = u for update;
  if not found then raise exception 'produto não é seu'; end if;

  if exists (select 1 from public.product_recipes rr where rr.product_id = p_produto and rr.quantity > 0)
     and coalesce(p.batch_yield, 0) > 0 then
    v_lotes := p_unidades / p.batch_yield;
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.product_id = p_produto and rr.quantity > 0 and rr.variant_id is null loop
      update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_lotes * r.quantity, 0), updated_at = now()
       where id = r.ingredient_id and user_id = u;
    end loop;
  else
    select * into m from public.mercado_compras
     where user_id = u and produto_id = p_produto and coalesce(unidades_previstas, 0) > 0
       and unidades_produzidas < unidades_previstas
     order by criada_em limit 1 for update;
    if found then
      v_compra := m.id;
      v_frac := least(p_unidades, m.unidades_previstas - m.unidades_produzidas) / m.unidades_previstas;
      v_lotes := v_frac;
      -- inputs of the purchase (lines as typed when we have them, else the cost rows)
      if m.itens is not null and jsonb_typeof(m.itens) = 'array' then
        for it in select value from jsonb_array_elements(m.itens) loop
          continue when coalesce(it->>'tipo', '') = 'produto';
          v_id := null;
          if coalesce(it->>'tipo', '') = 'novo' then
            select i.id into v_id from public.ingredients i
             where i.user_id = u and lower(trim(i.name)) = lower(trim(coalesce(it->>'nome', ''))) order by i.created_at limit 1;
          else
            begin v_id := (it->>'id')::uuid; exception when others then v_id := null; end;
          end if;
          continue when v_id is null;
          update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_frac * (it->>'qtd')::numeric, 0), updated_at = now()
           where id = v_id and user_id = u;
        end loop;
      else
        for r in select c.ingredient_id, c.quantidade from public.compras_mercadoria c
                  where c.mercado_compra_id = m.id and c.ingredient_id is not null loop
          update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_frac * r.quantidade, 0), updated_at = now()
           where id = r.ingredient_id and user_id = u;
        end loop;
      end if;
      update public.mercado_compras set unidades_produzidas = least(unidades_produzidas + p_unidades, unidades_previstas) where id = m.id;
      v_restante := greatest(m.unidades_previstas - m.unidades_produzidas - p_unidades, 0);
    end if;
  end if;

  update public.products
     set stock_quantity = coalesce(stock_quantity, 0) + round(p_unidades), controla_estoque = true, updated_at = now()
   where id = p_produto;
  insert into public.production_batches (user_id, product_id, batches_count, units_produced, notes, mercado_compra_id)
  values (u, p_produto, coalesce(v_lotes, 0), p_unidades, 'Produzi', v_compra);

  return jsonb_build_object('estoque', (select stock_quantity from public.products where id = p_produto),
                            'compra_id', v_compra, 'restante', v_restante);
end $corpo$, E'\n', E'\r\n');
begin
  execute 'create or replace function public.produto_produzir(p_produto uuid, p_unidades numeric) returns jsonb language plpgsql security definer set search_path to ''public'' as $function$' || c || '$function$';
end $do$;

-- produto_produzir_sabores: md5(prosrc) in production = 43c1fb25f53cbeb252d8ea91d3f3bece
do $do$
declare c text := replace($corpo$
declare
  u uuid := auth.uid();
  p record; s jsonb; r record;
  v_vid uuid; v_n numeric; v_total numeric := 0; v_levas numeric;
begin
  if u is null then raise exception 'login necessario'; end if;
  select * into p from public.products where id = p_produto and user_id = u for update;
  if not found then raise exception 'produto não é seu'; end if;
  if p_sabores is null or jsonb_typeof(p_sabores) <> 'array' then raise exception 'sabores invalidos'; end if;

  for s in select value from jsonb_array_elements(p_sabores) loop
    v_n := coalesce(nullif(s->>'unidades', '')::numeric, 0);
    continue when v_n <= 0;
    if v_n > 1000000 then raise exception 'unidades invalidas'; end if;
    begin v_vid := (s->>'id')::uuid; exception when others then raise exception 'sabor invalido'; end;
    if not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = p_produto and v.user_id = u) then
      raise exception 'sabor não é seu';
    end if;
    v_total := v_total + v_n;
    -- extras do sabor
    if coalesce(p.batch_yield, 0) > 0 then
      for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.variant_id = v_vid and rr.quantity > 0 loop
        update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - (v_n / p.batch_yield) * r.quantity, 0), updated_at = now()
         where id = r.ingredient_id and user_id = u;
      end loop;
    end if;
    update public.product_variants set stock_quantity = stock_quantity + round(v_n)::int, updated_at = now() where id = v_vid;
  end loop;
  if v_total <= 0 then raise exception 'nada pra produzir'; end if;

  -- base pelo total
  v_levas := case when coalesce(p.batch_yield, 0) > 0 then v_total / p.batch_yield else 0 end;
  if v_levas > 0 then
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr
              where rr.product_id = p_produto and rr.variant_id is null and rr.quantity > 0 loop
      update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_levas * r.quantity, 0), updated_at = now()
       where id = r.ingredient_id and user_id = u;
    end loop;
  end if;
  update public.products set stock_quantity = coalesce(stock_quantity, 0) + round(v_total)::int, controla_estoque = true, updated_at = now()
   where id = p_produto;
  insert into public.production_batches (user_id, product_id, batches_count, units_produced, notes)
  values (u, p_produto, v_levas, v_total, 'Produzi');
  return jsonb_build_object('estoque', (select stock_quantity from public.products where id = p_produto), 'unidades', v_total);
end $corpo$, E'\n', E'\r\n');
begin
  execute 'create or replace function public.produto_produzir_sabores(p_produto uuid, p_sabores jsonb) returns jsonb language plpgsql security definer set search_path to ''public'' as $function$' || c || '$function$';
end $do$;

-- produto_sabores_distribuir: md5(prosrc) in production = 7812b62772bd28b26187107857952986
do $do$
declare c text := replace($corpo$
declare
  u uuid := auth.uid();
  p record; s jsonb; r record;
  v_vid uuid; v_n numeric; v_total numeric := 0; v_livre numeric;
begin
  if u is null then raise exception 'login necessario'; end if;
  select * into p from public.products where id = p_produto and user_id = u for update;
  if not found then raise exception 'produto não é seu'; end if;
  if p_sabores is null or jsonb_typeof(p_sabores) <> 'array' then raise exception 'sabores invalidos'; end if;
  v_livre := greatest(coalesce(p.stock_quantity, 0) - coalesce((select sum(stock_quantity) from public.product_variants where product_id = p_produto), 0), 0);
  for s in select value from jsonb_array_elements(p_sabores) loop
    v_n := coalesce(nullif(s->>'unidades', '')::numeric, 0);
    continue when v_n <= 0;
    v_total := v_total + v_n;
  end loop;
  if v_total > v_livre + 0.001 then
    raise exception 'Só % sem sabor no estoque', round(v_livre) using errcode = 'P0001';
  end if;
  for s in select value from jsonb_array_elements(p_sabores) loop
    v_n := coalesce(nullif(s->>'unidades', '')::numeric, 0);
    continue when v_n <= 0;
    begin v_vid := (s->>'id')::uuid; exception when others then raise exception 'sabor invalido'; end;
    if not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = p_produto and v.user_id = u) then
      raise exception 'sabor não é seu';
    end if;
    if coalesce(p.batch_yield, 0) > 0 then
      for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.variant_id = v_vid and rr.quantity > 0 loop
        update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - (v_n / p.batch_yield) * r.quantity, 0), updated_at = now()
         where id = r.ingredient_id and user_id = u;
      end loop;
    end if;
    update public.product_variants set stock_quantity = stock_quantity + round(v_n)::int, updated_at = now() where id = v_vid;
  end loop;
  return jsonb_build_object('distribuidas', v_total, 'sem_sabor', v_livre - v_total);
end $corpo$, E'\n', E'\r\n');
begin
  execute 'create or replace function public.produto_sabores_distribuir(p_produto uuid, p_sabores jsonb) returns jsonb language plpgsql security definer set search_path to ''public'' as $function$' || c || '$function$';
end $do$;

-- produto_sabores_salvar: md5(prosrc) in production = b1184ff8663867af68d196aa183ef029
do $do$
declare c text := replace($corpo$
declare
  u uuid := auth.uid();
  s jsonb; it jsonb;
  v_vid uuid; v_nome text; v_emoji text; v_pos int := 0;
  v_ids uuid[] := '{}';
  v_iid uuid; v_inome text; v_qtd numeric; v_preco numeric; v_aprender boolean;
begin
  if u is null then raise exception 'login necessario'; end if;
  if not exists (select 1 from public.products p where p.id = p_produto and p.user_id = u) then raise exception 'produto não é seu'; end if;
  if p_sabores is null or jsonb_typeof(p_sabores) <> 'array' or jsonb_array_length(p_sabores) > 30 then raise exception 'sabores invalidos'; end if;

  for s in select value from jsonb_array_elements(p_sabores) loop
    v_nome := left(trim(coalesce(s->>'nome', '')), 60);
    continue when v_nome = '';
    v_emoji := left(coalesce(nullif(trim(s->>'emoji'), ''), '🥤'), 8);
    v_vid := null;
    if nullif(s->>'id', '') is not null then
      begin v_vid := (s->>'id')::uuid; exception when others then v_vid := null; end;
      if v_vid is not null and not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = p_produto and v.user_id = u) then
        v_vid := null;
      end if;
    end if;
    if v_vid is null then
      select v.id into v_vid from public.product_variants v
       where v.product_id = p_produto and v.user_id = u and lower(trim(v.name)) = lower(v_nome) limit 1;
    end if;
    if v_vid is null then
      insert into public.product_variants (user_id, product_id, name, emoji, posicao)
      values (u, p_produto, v_nome, v_emoji, v_pos) returning id into v_vid;
    else
      update public.product_variants set name = v_nome, emoji = v_emoji, posicao = v_pos, updated_at = now() where id = v_vid;
    end if;
    v_ids := array_append(v_ids, v_vid);
    v_pos := v_pos + 1;

    -- os extras desse sabor
    delete from public.product_recipes where variant_id = v_vid;
    if jsonb_typeof(s->'itens') = 'array' then
      for it in select value from jsonb_array_elements(s->'itens') loop
        v_inome := left(trim(coalesce(it->>'nome', '')), 80);
        v_qtd := nullif(it->>'qtd', '')::numeric;
        v_preco := coalesce(nullif(it->>'preco', '')::numeric, 0);
        v_aprender := coalesce((it->>'aprender')::boolean, false);
        if v_aprender then v_qtd := 0; end if;
        continue when v_inome = '' or v_qtd is null or v_qtd < 0 or (v_qtd = 0 and not v_aprender) or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000;
        v_iid := null;
        if nullif(it->>'id', '') is not null then
          begin v_iid := (it->>'id')::uuid; exception when others then v_iid := null; end;
          if v_iid is not null and not exists (select 1 from public.ingredients i where i.id = v_iid and i.user_id = u) then v_iid := null; end if;
        end if;
        if v_iid is null then
          select i.id into v_iid from public.ingredients i where i.user_id = u and lower(trim(i.name)) = lower(v_inome) order by i.created_at limit 1;
        end if;
        if v_iid is null then
          insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit) values (u, v_inome, 'un', 0, v_preco) returning id into v_iid;
        elsif v_preco > 0 then
          update public.ingredients set cost_per_unit = v_preco, updated_at = now() where id = v_iid;
        end if;
        if exists (select 1 from public.product_recipes r where r.variant_id = v_vid and r.ingredient_id = v_iid) then
          update public.product_recipes set quantity = quantity + v_qtd where variant_id = v_vid and ingredient_id = v_iid;
        else
          insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id, aprender) values (u, p_produto, v_iid, v_qtd, v_vid, v_aprender);
        end if;
      end loop;
    end if;
  end loop;

  delete from public.product_variants v where v.product_id = p_produto and v.user_id = u and not (v.id = any (v_ids));
  return jsonb_build_object('sabores', coalesce(array_length(v_ids, 1), 0));
end $corpo$, E'\n', E'\r\n');
begin
  c := replace(c, E'false);\r\n        if v_aprender then v_qtd := 0; end if;\r\n', E'false);\n        if v_aprender then v_qtd := 0; end if;\n');
  execute 'create or replace function public.produto_sabores_salvar(p_produto uuid, p_sabores jsonb) returns jsonb language plpgsql security definer set search_path to ''public'' as $function$' || c || '$function$';
end $do$;
