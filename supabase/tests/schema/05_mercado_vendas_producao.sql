-- Test fixture (23/11/2026): Mercado, sales and recipe functions EXACTLY as production runs them
-- (md5 of prosrc without \r, read on 23/11, next to each). aplicar/reverter_compra_mercadoria exist
-- only in production (never in a migration); their text was read from production. The others come
-- from the repo (+ the in-place patches of 20261026180000) or the production body. Tables and
-- triggers below have the production columns. No data, only structure and code.
create table public.mercado_compras (id uuid not null default gen_random_uuid(), user_id uuid not null default auth.uid(), total numeric not null default 0, por_item boolean not null default true, criada_em timestamp with time zone not null default now(), conta_id uuid, banco_transacao_id text, total_banco numeric, conferida_em timestamp with time zone, itens jsonb, desconto numeric not null default 0, produto_id uuid, unidades_previstas numeric, unidades_produzidas numeric not null default 0, PRIMARY KEY (id));
create table public.compras_mercadoria (id uuid not null default gen_random_uuid(), user_id uuid not null default auth.uid(), item_tipo text not null check (item_tipo = any (array['ingrediente', 'produto'])), ingredient_id uuid, product_id uuid, quantidade numeric not null check (quantidade > 0), total_pago numeric not null check (total_pago >= 0), custo_unitario numeric generated always as (round((total_pago / quantidade), 4)) stored, fornecedor text not null default '', data date not null default ((now() at time zone 'America/Sao_Paulo'))::date, notas text not null default '', custo_anterior numeric, custo_novo numeric, created_at timestamp with time zone not null default now(), lancar_custo_dia boolean not null default true, mercado_compra_id uuid, PRIMARY KEY (id),
  check ((item_tipo = 'ingrediente' and product_id is null) or (item_tipo = 'produto' and ingredient_id is null)));
create table public.defcon_daily_loadout (id uuid not null default gen_random_uuid(), user_id uuid not null, date date not null default current_date, product_id uuid not null, product_name text not null, qty_initial numeric not null default 0, qty_sold numeric not null default 0, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), PRIMARY KEY (id), UNIQUE (user_id, date, product_id));
create table public.product_sales_log (id uuid not null default gen_random_uuid(), user_id uuid not null, product_id uuid not null, quantity numeric not null default 1, total_amount numeric not null default 0, created_at timestamp with time zone not null default now(), defcon_sale_id uuid, unit_cost numeric, PRIMARY KEY (id));

-- recalc_custo_produtos_do_ingrediente: md5(prosrc) = 83cd727a49e3
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

-- aplicar_compra_mercadoria: md5(prosrc) = 103c0241ba71
create or replace function public.aplicar_compra_mercadoria() returns trigger
language plpgsql security definer set search_path = public as $corpo$
declare
  v_old_stock numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_custo_compra numeric;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v_custo_compra := round(new.total_pago / new.quantidade, 4);

  if new.item_tipo = 'ingrediente' then
    select greatest(coalesce(stock_quantity, 0), 0), coalesce(cost_per_unit, 0)
    into v_old_stock, v_old_cost
    from public.ingredients
    where id = new.ingredient_id and user_id = new.user_id
    for update;

    if not found then
      raise exception 'Ingrediente não encontrado para este usuário';
    end if;

    if v_old_stock <= 0 or v_old_cost <= 0 then
      v_new_cost := v_custo_compra;
    else
      v_new_cost := round((v_old_stock * v_old_cost + new.quantidade * v_custo_compra)
                          / (v_old_stock + new.quantidade), 4);
    end if;

    new.custo_anterior := nullif(v_old_cost, 0);
    new.custo_novo := v_new_cost;

    update public.ingredients
    set cost_per_unit = v_new_cost,
        stock_quantity = v_old_stock + new.quantidade,
        updated_at = now()
    where id = new.ingredient_id;

    perform public.recalc_custo_produtos_do_ingrediente(new.ingredient_id);

  else
    select greatest(coalesce(stock_quantity, 0), 0), coalesce(cost, 0)
    into v_old_stock, v_old_cost
    from public.products
    where id = new.product_id and user_id = new.user_id
    for update;

    if not found then
      raise exception 'Produto não encontrado para este usuário';
    end if;

    if v_old_stock <= 0 or v_old_cost <= 0 then
      v_new_cost := round(v_custo_compra, 2);
    else
      v_new_cost := round((v_old_stock * v_old_cost + new.quantidade * v_custo_compra)
                          / (v_old_stock + new.quantidade), 2);
    end if;

    new.custo_anterior := nullif(v_old_cost, 0);
    new.custo_novo := v_new_cost;

    update public.products
    set cost = v_new_cost,
        stock_quantity = (v_old_stock + new.quantidade)::int,
        updated_at = now()
    where id = new.product_id;
  end if;

  -- lança no custo do dia (abate do líquido no relatório) — nunca trava a compra
  if coalesce(new.lancar_custo_dia, true) and new.total_pago > 0 then
    begin
      update public.daily_sales
      set cost = coalesce(cost, 0) + new.total_pago,
          updated_at = now()
      where user_id = new.user_id and date = v_hoje;
      if not found then
        insert into public.daily_sales (user_id, date, cost)
        values (new.user_id, v_hoje, new.total_pago);
      end if;
    exception when others then
      raise warning 'compra registrada, mas falhou ao lançar no custo do dia: %', sqlerrm;
    end;
  end if;

  return new;
end $corpo$;

-- reverter_compra_mercadoria: md5(prosrc) = f1ebaaeebbeb
create or replace function public.reverter_compra_mercadoria() returns trigger
language plpgsql security definer set search_path = public as $corpo$
declare
  v_dia date := (old.created_at at time zone 'America/Sao_Paulo')::date;
  v_tem_posterior boolean;
begin
  if old.item_tipo = 'ingrediente' and old.ingredient_id is not null then
    select exists (
      select 1 from public.compras_mercadoria c
      where c.ingredient_id = old.ingredient_id and c.id <> old.id and c.created_at > old.created_at
    ) into v_tem_posterior;

    update public.ingredients
    set stock_quantity = greatest(coalesce(stock_quantity, 0) - old.quantidade, 0),
        cost_per_unit = case
          when not v_tem_posterior and coalesce(old.custo_anterior, 0) > 0 then old.custo_anterior
          else cost_per_unit end,
        updated_at = now()
    where id = old.ingredient_id and user_id = old.user_id;

    perform public.recalc_custo_produtos_do_ingrediente(old.ingredient_id);

  elsif old.item_tipo = 'produto' and old.product_id is not null then
    select exists (
      select 1 from public.compras_mercadoria c
      where c.product_id = old.product_id and c.id <> old.id and c.created_at > old.created_at
    ) into v_tem_posterior;

    update public.products
    set stock_quantity = greatest(coalesce(stock_quantity, 0) - old.quantidade, 0)::int,
        cost = case
          when not v_tem_posterior and coalesce(old.custo_anterior, 0) > 0 then old.custo_anterior
          else cost end,
        updated_at = now()
    where id = old.product_id and user_id = old.user_id;
  end if;

  if coalesce(old.lancar_custo_dia, true) and old.total_pago > 0 then
    begin
      update public.daily_sales
      set cost = greatest(coalesce(cost, 0) - old.total_pago, 0), updated_at = now()
      where user_id = old.user_id and date = v_dia;
    exception when others then
      raise warning 'compra excluída, mas falhou ao abater do custo do dia: %', sqlerrm;
    end;
  end if;

  return old;
end $corpo$;

-- defcon_venda_baixa_estoque: md5(prosrc) = c0388358fea3
create or replace function public.defcon_venda_baixa_estoque() returns trigger
language plpgsql security definer set search_path = public as $corpo$
declare
  v_dia date;
  p record;
  v_custo numeric;
  v_log record;
  v_modo text;
  v_controla boolean;
  v_vid uuid;
begin
  if tg_op = 'INSERT' then
    if new.product_id is null or coalesce(new.qty, 0) <= 0 then return new; end if;

    select pr.id, pr.name, coalesce(pr.cost, 0) as cost, pr.recipe_mode,
           coalesce(pr.controla_estoque, true) as controla
      into p
      from public.products pr
     where pr.id = new.product_id and pr.user_id = new.user_id;
    if not found then return new; end if;

    v_dia := coalesce(
      (select cs.date from public.challenge_sessions cs where cs.id = new.session_id),
      (new.created_at at time zone 'America/Sao_Paulo')::date);

    begin
      if p.controla then
        update public.products
           set stock_quantity = greatest(coalesce(stock_quantity, 0) - new.qty, 0)::int,
               updated_at = now()
         where id = new.product_id;
        -- sabores (26/10): o escolhido, senão o que tem mais
        v_vid := new.variant_id;
        if v_vid is null then
          select v.id into v_vid from public.product_variants v
           where v.product_id = new.product_id and v.stock_quantity > 0
           order by v.stock_quantity desc, v.posicao limit 1;
        end if;
        if v_vid is not null then
          update public.product_variants set stock_quantity = greatest(stock_quantity - new.qty, 0), updated_at = now()
           where id = v_vid and product_id = new.product_id;
          -- guarda o sabor na venda: apagar a venda devolve pro sabor certo (o gatilho não roda em UPDATE)
          if new.variant_id is null then update public.defcon_sales set variant_id = v_vid where id = new.id; end if;
        end if;
      end if;

      update public.defcon_daily_loadout
         set qty_sold = coalesce(qty_sold, 0) + new.qty, updated_at = now()
       where user_id = new.user_id and product_id = new.product_id and date = v_dia;
      if not found then
        insert into public.defcon_daily_loadout (user_id, date, product_id, product_name, qty_initial, qty_sold)
        values (new.user_id, v_dia, p.id, p.name, 0, new.qty)
        on conflict (user_id, date, product_id) do update
          set qty_sold = coalesce(defcon_daily_loadout.qty_sold, 0) + excluded.qty_sold;
      end if;

      if p.recipe_mode = 'per_unit' then
        update public.ingredients i
           set stock_quantity = greatest(coalesce(i.stock_quantity, 0) - r.quantity * new.qty, 0)
          from public.product_recipes r
         where r.product_id = new.product_id and r.variant_id is null and i.id = r.ingredient_id and i.user_id = new.user_id;
      end if;

      insert into public.product_sales_log (user_id, product_id, quantity, total_amount, defcon_sale_id, unit_cost)
      values (new.user_id, new.product_id, new.qty, coalesce(new.amount, 0), new.id, p.cost);

      if p.cost > 0 then
        insert into public.daily_sales (user_id, date, cost)
        values (new.user_id, v_dia, round(p.cost * new.qty, 2))
        on conflict (user_id, date) do update
          set cost = round(coalesce(daily_sales.cost, 0) + excluded.cost, 2);
      end if;
    exception when others then
      raise warning 'defcon_venda_baixa_estoque (venda %): %', new.id, sqlerrm;
    end;
    return new;

  elsif tg_op = 'DELETE' then
    if old.product_id is null or coalesce(old.qty, 0) <= 0 then return old; end if;

    select pr.recipe_mode, coalesce(pr.controla_estoque, true)
      into v_modo, v_controla
      from public.products pr
     where pr.id = old.product_id and pr.user_id = old.user_id;

    v_dia := coalesce(
      (select cs.date from public.challenge_sessions cs where cs.id = old.session_id),
      (old.created_at at time zone 'America/Sao_Paulo')::date);

    begin
      if coalesce(v_controla, false) then
        update public.products
           set stock_quantity = (coalesce(stock_quantity, 0) + old.qty)::int, updated_at = now()
         where id = old.product_id;
        if old.variant_id is not null then
          update public.product_variants set stock_quantity = stock_quantity + old.qty, updated_at = now()
           where id = old.variant_id and product_id = old.product_id;
        end if;
      end if;

      update public.defcon_daily_loadout
         set qty_sold = greatest(coalesce(qty_sold, 0) - old.qty, 0), updated_at = now()
       where user_id = old.user_id and product_id = old.product_id and date = v_dia;

      if v_modo = 'per_unit' then
        update public.ingredients i
           set stock_quantity = coalesce(i.stock_quantity, 0) + r.quantity * old.qty
          from public.product_recipes r
         where r.product_id = old.product_id and r.variant_id is null and i.id = r.ingredient_id and i.user_id = old.user_id;
      end if;

      select l.id, coalesce(l.unit_cost, 0) as unit_cost into v_log
        from public.product_sales_log l where l.defcon_sale_id = old.id limit 1;
      if found then
        delete from public.product_sales_log where id = v_log.id;
        v_custo := round(v_log.unit_cost * old.qty, 2);
        if v_custo > 0 then
          update public.daily_sales
             set cost = greatest(round(coalesce(cost, 0) - v_custo, 2), 0)
           where user_id = old.user_id and date = v_dia;
        end if;
      end if;
    exception when others then
      raise warning 'defcon_venda_baixa_estoque (apagar %): %', old.id, sqlerrm;
    end;
    return old;
  end if;
  return null;
end $corpo$;

-- mercado_concluir: md5(prosrc) = 49f187eca986
create or replace function public.mercado_concluir(p_itens jsonb, p_total numeric default null, p_por_item boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $corpo$
declare
  u uuid := auth.uid();
  n int;
  k int;
  it jsonb;
  l_tipo text[] := '{}';
  l_id uuid[] := '{}';
  l_qtd numeric[] := '{}';
  l_preco numeric[] := '{}';
  l_custo numeric[] := '{}';
  l_para jsonb[] := '{}';
  l_total numeric[] := '{}';
  v_tipo text; v_id uuid; v_nome text; v_qtd numeric; v_preco numeric; v_custo numeric; v_para jsonb;
  v_conta int; v_auto text; v_era_novo boolean;
  v_soma_peso numeric; v_peso numeric; v_acum numeric; v_por_qtd boolean;
  v_header numeric := 0;
  v_compra uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cands uuid[] := '{}';
  v_pid text;
  v_aloc jsonb := '{}';
  v_pool jsonb := '{}';
  v_custo_antes jsonb := '{}';
  v_prod record; r record;
  v_receitas numeric; v_x numeric; v_disp numeric; v_need numeric; v_take numeric; v_chave text;
  v_unid numeric;
  v_out jsonb := '[]';
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'compra vazia';
  end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'itens demais'; end if;
  if p_total is not null and (p_total < 0 or p_total > 1000000) then raise exception 'total invalido'; end if;
  for it in select value from jsonb_array_elements(p_itens) loop
    v_tipo := it->>'tipo';
    v_qtd := nullif(it->>'qtd', '')::numeric;
    if v_qtd is null or v_qtd <= 0 or v_qtd > 1000000 then raise exception 'quantidade invalida'; end if;
    v_preco := nullif(it->>'preco_unit', '')::numeric;
    if v_preco is not null and (v_preco < 0 or v_preco > 1000000) then raise exception 'preco invalido'; end if;
    v_para := coalesce(it->'para', '[]'::jsonb);
    if jsonb_typeof(v_para) <> 'array' then v_para := '[]'::jsonb; end if;
    v_id := null; v_custo := null; v_era_novo := v_tipo = 'novo';
    if v_tipo = 'novo' then
      v_nome := left(trim(coalesce(it->>'nome', '')), 80);
      if v_nome = '' then raise exception 'item sem nome'; end if;
      select i.id, coalesce(i.cost_per_unit, 0) into v_id, v_custo
        from public.ingredients i
       where i.user_id = u and lower(trim(i.name)) = lower(v_nome)
       order by i.created_at limit 1;
      if v_id is null then
        insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit)
        values (u, v_nome, 'un', 0, 0) returning id into v_id;
        v_custo := 0;
      end if;
      v_tipo := 'ingrediente';
      v_para := '[]'::jsonb;
    elsif v_tipo = 'ingrediente' then
      begin v_id := (it->>'id')::uuid; exception when others then raise exception 'item não é seu'; end;
      select coalesce(i.cost_per_unit, 0) into v_custo from public.ingredients i where i.id = v_id and i.user_id = u;
      if not found then raise exception 'item não é seu'; end if;
    elsif v_tipo = 'produto' then
      begin v_id := (it->>'id')::uuid; exception when others then raise exception 'item não é seu'; end;
      select coalesce(p.cost, 0) into v_custo from public.products p where p.id = v_id and p.user_id = u;
      if not found then raise exception 'item não é seu'; end if;
      v_para := '[]'::jsonb;
    else
      raise exception 'tipo invalido';
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_para) x
                where not exists (select 1 from public.products p where p.id::text = x and p.user_id = u)) then
      raise exception 'item não é seu';
    end if;
    if v_tipo = 'ingrediente' and not v_era_novo and jsonb_array_length(v_para) = 0 then
      select count(distinct p.id), min(p.id::text) into v_conta, v_auto
        from public.product_recipes rr
        join public.products p on p.id = rr.product_id
       where rr.ingredient_id = v_id and rr.quantity > 0 and p.user_id = u
         and coalesce(p.is_active, true) and p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0;
      if v_conta = 1 then v_para := jsonb_build_array(v_auto); end if;
    end if;
    l_tipo := array_append(l_tipo, v_tipo); l_id := array_append(l_id, v_id);
    l_qtd := array_append(l_qtd, v_qtd); l_preco := array_append(l_preco, v_preco);
    l_custo := array_append(l_custo, v_custo); l_para := array_append(l_para, v_para);
    l_total := array_append(l_total, 0::numeric);
  end loop;
  n := array_length(l_tipo, 1);
  if p_por_item then
    for k in 1..n loop
      if coalesce(l_preco[k], 0) > 0 then
        l_total[k] := round(l_qtd[k] * l_preco[k], 2);
        v_header := v_header + l_total[k];
      end if;
    end loop;
  elsif coalesce(p_total, 0) > 0 then
    v_soma_peso := 0;
    for k in 1..n loop v_soma_peso := v_soma_peso + l_qtd[k] * l_custo[k]; end loop;
    v_por_qtd := v_soma_peso <= 0;
    if v_por_qtd then
      v_soma_peso := 0;
      for k in 1..n loop v_soma_peso := v_soma_peso + l_qtd[k]; end loop;
    end if;
    v_acum := 0;
    for k in 1..n loop
      v_peso := case when v_por_qtd then l_qtd[k] else l_qtd[k] * l_custo[k] end;
      if k < n then
        l_total[k] := round(p_total * v_peso / v_soma_peso, 2);
        v_acum := v_acum + l_total[k];
      else
        l_total[k] := greatest(round(p_total, 2) - v_acum, 0);
      end if;
    end loop;
    v_header := round(p_total, 2);
  end if;
  for k in 1..n loop
    if l_tipo[k] = 'ingrediente' then
      for v_pid in select value from jsonb_array_elements_text(l_para[k]) loop
        if not (v_pid::uuid = any (v_cands)) then v_cands := array_append(v_cands, v_pid::uuid); end if;
        v_chave := l_id[k]::text || ':' || v_pid;
        v_aloc := jsonb_set(v_aloc, array[v_chave],
          to_jsonb(coalesce((v_aloc->>v_chave)::numeric, 0) + l_qtd[k] / jsonb_array_length(l_para[k])));
      end loop;
    end if;
  end loop;
  for r in
    select i.id, greatest(coalesce(i.stock_quantity, 0), 0) as estoque
      from public.ingredients i
     where i.user_id = u
       and (i.id = any (l_id)
            or i.id in (select rr.ingredient_id from public.product_recipes rr where rr.product_id = any (v_cands)))
     for update
  loop
    v_pool := jsonb_set(v_pool, array[r.id::text], to_jsonb(r.estoque));
  end loop;
  select coalesce(jsonb_object_agg(p.id::text, coalesce(p.cost, 0)), '{}'::jsonb) into v_custo_antes
    from public.products p where p.id = any (v_cands) and p.user_id = u;
  insert into public.mercado_compras (user_id, total, por_item)
  values (u, v_header, coalesce(p_por_item, true)) returning id into v_compra;
  for k in 1..n loop
    if l_total[k] > 0 then
      insert into public.compras_mercadoria
        (user_id, item_tipo, ingredient_id, product_id, quantidade, total_pago, data, notas,
         lancar_custo_dia, mercado_compra_id)
      values (u, l_tipo[k],
              case when l_tipo[k] = 'ingrediente' then l_id[k] end,
              case when l_tipo[k] = 'produto' then l_id[k] end,
              l_qtd[k], l_total[k], v_hoje, 'Tô no mercado', false, v_compra);
    elsif l_tipo[k] = 'ingrediente' then
      update public.ingredients set stock_quantity = coalesce(stock_quantity, 0) + l_qtd[k], updated_at = now()
       where id = l_id[k] and user_id = u;
    else
      update public.products set stock_quantity = coalesce(stock_quantity, 0) + round(l_qtd[k]), updated_at = now()
       where id = l_id[k] and user_id = u;
    end if;
    if l_tipo[k] = 'produto' then
      update public.products set controla_estoque = true where id = l_id[k] and user_id = u;
    end if;
  end loop;
  foreach v_pid in array v_cands::text[] loop
    select p.id, p.name, p.batch_yield into v_prod
      from public.products p
     where p.id = v_pid::uuid and p.user_id = u
       and p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0;
    continue when not found;
    v_receitas := null;
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr
              where rr.product_id = v_prod.id and rr.quantity > 0 and rr.variant_id is null loop
      v_disp := coalesce((v_aloc->>(r.ingredient_id::text || ':' || v_pid))::numeric, 0)
              + coalesce((v_pool->>r.ingredient_id::text)::numeric, 0);
      v_x := floor(v_disp / r.quantity + 0.000000001);
      v_receitas := least(coalesce(v_receitas, v_x), v_x);
    end loop;
    v_receitas := greatest(coalesce(v_receitas, 0), 0);
    v_unid := round(v_receitas * v_prod.batch_yield);
    if v_receitas > 0 then
      for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr
                where rr.product_id = v_prod.id and rr.quantity > 0 and rr.variant_id is null loop
        v_chave := r.ingredient_id::text || ':' || v_pid;
        v_need := v_receitas * r.quantity;
        v_take := least(coalesce((v_aloc->>v_chave)::numeric, 0), v_need);
        v_need := v_need - v_take;
        if v_need > 0 then
          v_pool := jsonb_set(v_pool, array[r.ingredient_id::text],
            to_jsonb(greatest(coalesce((v_pool->>r.ingredient_id::text)::numeric, 0) - v_need, 0)));
        end if;
        update public.ingredients
           set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_receitas * r.quantity, 0), updated_at = now()
         where id = r.ingredient_id and user_id = u;
      end loop;
      update public.products
         set stock_quantity = coalesce(stock_quantity, 0) + v_unid, controla_estoque = true, updated_at = now()
       where id = v_prod.id;
      insert into public.production_batches (user_id, product_id, batches_count, units_produced, notes)
      values (u, v_prod.id, v_receitas, v_unid, 'Tô no mercado');
    end if;
    v_out := v_out || jsonb_build_object(
      'id', v_prod.id, 'nome', v_prod.name, 'receitas', v_receitas, 'unidades', v_unid,
      'custo_antes', coalesce((v_custo_antes->>v_pid)::numeric, 0),
      'custo_depois', (select coalesce(p.cost, 0) from public.products p where p.id = v_prod.id));
  end loop;
  return jsonb_build_object('compra_id', v_compra, 'total', v_header, 'produtos', v_out);
end $corpo$;

-- mercado_desfazer: md5(prosrc) = 349ed0608329
create or replace function public.mercado_desfazer(p_compra uuid) returns void
language plpgsql security definer set search_path = public as $corpo$
declare
  u uuid := auth.uid();
  h record; b record; r record; it jsonb;
  v_id uuid;
begin
  select * into h from public.mercado_compras where id = p_compra and user_id = u for update;
  if not found then raise exception 'compra não é sua'; end if;

  for b in select * from public.production_batches where mercado_compra_id = p_compra and user_id = u
             and notes = 'Tô no mercado' loop
    update public.products set stock_quantity = greatest(coalesce(stock_quantity, 0) - round(b.units_produced), 0), updated_at = now()
     where id = b.product_id and user_id = u;
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.product_id = b.product_id and rr.variant_id is null loop
      update public.ingredients set stock_quantity = coalesce(stock_quantity, 0) + b.batches_count * r.quantity, updated_at = now()
       where id = r.ingredient_id and user_id = u;
    end loop;
    delete from public.production_batches where id = b.id;
  end loop;

  if h.itens is not null and jsonb_typeof(h.itens) = 'array' then
    for it in select value from jsonb_array_elements(h.itens) loop
      v_id := null;
      if coalesce(it->>'tipo', '') = 'novo' then
        select i.id into v_id from public.ingredients i
         where i.user_id = u and lower(trim(i.name)) = lower(trim(coalesce(it->>'nome', ''))) order by i.created_at limit 1;
      else
        begin v_id := (it->>'id')::uuid; exception when others then v_id := null; end;
      end if;
      continue when v_id is null;
      -- only lines that never became a compras_mercadoria row
      continue when exists (select 1 from public.compras_mercadoria c where c.mercado_compra_id = p_compra
                             and (c.ingredient_id = v_id or c.product_id = v_id));
      if coalesce(it->>'tipo', '') = 'produto' then
        update public.products set stock_quantity = greatest(coalesce(stock_quantity, 0) - round((it->>'qtd')::numeric), 0), updated_at = now()
         where id = v_id and user_id = u;
      else
        update public.ingredients set stock_quantity = greatest(coalesce(stock_quantity, 0) - (it->>'qtd')::numeric, 0), updated_at = now()
         where id = v_id and user_id = u;
      end if;
    end loop;
  end if;

  delete from public.compras_mercadoria where mercado_compra_id = p_compra and user_id = u;
end $corpo$;

-- mercado_salvar: md5(prosrc) = 07c48116edb8
create or replace function public.mercado_salvar(p_itens jsonb, p_total numeric default null, p_por_item boolean default true, p_desconto numeric default 0, p_itens_orig jsonb default null, p_editar uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $corpo$
declare
  u uuid := auth.uid();
  r jsonb; v_novo uuid; v_id uuid; h record;
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_desconto is null or p_desconto < 0 or p_desconto > 1000000 then raise exception 'desconto invalido'; end if;

  if p_editar is not null then
    select * into h from public.mercado_compras where id = p_editar and user_id = u;
    if not found then raise exception 'compra não é sua'; end if;
    perform public.mercado_desfazer(p_editar);
  end if;

  r := public.mercado_concluir(p_itens, p_total, p_por_item);
  v_novo := (r->>'compra_id')::uuid;

  -- production made right now by mercado_concluir belongs to this purchase
  update public.production_batches set mercado_compra_id = v_novo
   where user_id = u and mercado_compra_id is null and notes = 'Tô no mercado' and created_at = now();

  if p_editar is null then
    v_id := v_novo;
  else
    v_id := p_editar;
    update public.compras_mercadoria set mercado_compra_id = p_editar where mercado_compra_id = v_novo;
    update public.production_batches set mercado_compra_id = p_editar where mercado_compra_id = v_novo;
    update public.mercado_compras m set total = n.total, por_item = n.por_item
      from public.mercado_compras n where m.id = p_editar and n.id = v_novo;
    delete from public.mercado_compras where id = v_novo;
    r := jsonb_set(r, '{compra_id}', to_jsonb(p_editar::text));
  end if;

  update public.mercado_compras
     set itens = coalesce(p_itens_orig, p_itens), desconto = round(p_desconto, 2)
   where id = v_id;

  -- edited purchase that already had "I'll make N": cost per unit follows the new total
  if p_editar is not null then
    if h.produto_id is not null and coalesce(h.unidades_previstas, 0) > 0 then
      update public.products p set cost = round(m.total / h.unidades_previstas, 2), updated_at = now()
        from public.mercado_compras m where m.id = p_editar and p.id = h.produto_id and p.user_id = u and m.total > 0;
    end if;
  end if;

  return r || jsonb_build_object('desconto', round(p_desconto, 2));
end $corpo$;

-- mercado_aprender: md5(prosrc) = a3b9462ec255
create or replace function public.mercado_aprender(p_compra uuid, p_produto uuid, p_unidades numeric) returns jsonb
language plpgsql security definer set search_path = public as $corpo$
declare
  u uuid := auth.uid();
  p record; r record;
  v_levas numeric; v_qtd numeric; v_out jsonb := '[]';
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_unidades is null or p_unidades < 1 or p_unidades > 1000000 then raise exception 'unidades invalidas'; end if;
  select * into p from public.products where id = p_produto and user_id = u;
  if not found then raise exception 'produto não é seu'; end if;
  if not exists (select 1 from public.mercado_compras m where m.id = p_compra and m.user_id = u) then raise exception 'compra não é sua'; end if;
  v_levas := p_unidades / greatest(coalesce(p.batch_yield, 0), 1);

  for r in
    select rr.id, rr.ingredient_id, i.name, coalesce(i.unit, 'un') as unit, coalesce(i.cost_per_unit, 0) as custo,
           sum(c.quantidade) as comprado
      from public.product_recipes rr
      join public.ingredients i on i.id = rr.ingredient_id
      join public.compras_mercadoria c on c.ingredient_id = rr.ingredient_id and c.mercado_compra_id = p_compra
     where rr.product_id = p_produto and rr.aprender
     group by rr.id, rr.ingredient_id, i.name, i.unit, i.cost_per_unit
  loop
    v_qtd := round(r.comprado / v_levas, 3);
    continue when v_qtd <= 0;
    update public.product_recipes set quantity = v_qtd, aprender = false where id = r.id;
    v_out := v_out || jsonb_build_object('nome', r.name, 'unidade', r.unit, 'por_leva', v_qtd,
                                         'por_unidade', round(r.comprado / p_unidades, 2),
                                         'custo_unidade', round(r.comprado / p_unidades * r.custo, 2));
    perform public.recalc_custo_produtos_do_ingrediente(r.ingredient_id);
  end loop;
  return jsonb_build_object('aprendeu', v_out, 'custo', (select cost from public.products where id = p_produto));
end $corpo$;

-- produto_salvar_receita: md5(prosrc) = 9aa7ac60bdc8
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

create trigger compras_mercadoria_aplicar before insert on public.compras_mercadoria for each row execute function public.aplicar_compra_mercadoria();
create trigger compras_mercadoria_reverter after delete on public.compras_mercadoria for each row execute function public.reverter_compra_mercadoria();
create trigger defcon_venda_estoque after insert or delete on public.defcon_sales for each row execute function public.defcon_venda_baixa_estoque();
revoke all on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) from public, anon;
grant execute on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) to authenticated;
