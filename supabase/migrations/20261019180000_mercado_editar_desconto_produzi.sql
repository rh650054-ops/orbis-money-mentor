-- ============================================================
-- Market purchase: discount, edit, "how many units will you make" and "Produzi"
-- (Rick, 19/10/2026)
--
-- 1) mercado_compras keeps what was typed (itens, before the discount) and the
--    discount, so the purchase can be reopened and edited with everything filled in.
-- 2) mercado_salvar(...): concludes a purchase (wraps mercado_concluir) and, when
--    p_editar is given, first UNDOES the old purchase (stock, average cost, the
--    "sobe na hora" production) and writes the new one under the same id.
-- 3) mercado_rendimento(compra, produto, unidades): "I'll make 100 with this
--    purchase" → product cost = what was paid ÷ units. Inputs stay in stock.
-- 4) produto_produzir(produto, unidades): "Produzi 100" → product stock goes up and
--    the inputs go down (by the recipe if there is one, otherwise by the share of the
--    linked purchase: 50 of 100 = half of each item).
-- Idempotent.
-- ============================================================

alter table public.mercado_compras
  add column if not exists itens jsonb,
  add column if not exists desconto numeric not null default 0,
  add column if not exists produto_id uuid references public.products (id) on delete set null,
  add column if not exists unidades_previstas numeric,
  add column if not exists unidades_produzidas numeric not null default 0;

alter table public.production_batches
  add column if not exists mercado_compra_id uuid references public.mercado_compras (id) on delete set null;

-- ------------------------------------------------------------
-- Undo a purchase (internal): reverses the "sobe na hora" production, the lines
-- without value (they only added stock) and the lines with value (the delete
-- trigger reverses stock, average cost and day cost).
-- ------------------------------------------------------------
create or replace function public.mercado_desfazer(p_compra uuid)
returns void language plpgsql security definer set search_path = public as $$
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
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.product_id = b.product_id loop
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
end $$;
revoke all on function public.mercado_desfazer(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- mercado_salvar: conclude (or edit) a purchase.
--   p_itens: lines already with the discount spread in (what goes to cost/stock)
--   p_itens_orig: lines as typed (before the discount), saved to reopen for editing
-- ------------------------------------------------------------
create or replace function public.mercado_salvar(
  p_itens jsonb, p_total numeric default null, p_por_item boolean default true,
  p_desconto numeric default 0, p_itens_orig jsonb default null, p_editar uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if p_editar is not null and h.produto_id is not null and coalesce(h.unidades_previstas, 0) > 0 then
    update public.products p set cost = round(m.total / h.unidades_previstas, 2), updated_at = now()
      from public.mercado_compras m where m.id = p_editar and p.id = h.produto_id and p.user_id = u and m.total > 0;
  end if;

  return r || jsonb_build_object('desconto', round(p_desconto, 2));
end $$;
revoke all on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) from public, anon;
grant execute on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) to authenticated;

-- ------------------------------------------------------------
-- The purchase to reopen in the market screen: header + lines as typed.
-- Purchases before this migration have no "itens": rebuilt from compras_mercadoria.
-- ------------------------------------------------------------
create or replace function public.mercado_compra_abrir(p_compra uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', m.id, 'total', m.total, 'por_item', m.por_item, 'desconto', m.desconto,
    'criada_em', m.criada_em, 'produto_id', m.produto_id, 'unidades_previstas', m.unidades_previstas,
    'itens', coalesce(m.itens, (
      select jsonb_agg(jsonb_build_object(
               'tipo', c.item_tipo, 'id', coalesce(c.ingredient_id, c.product_id),
               'nome', coalesce(i.name, p.name, ''), 'qtd', c.quantidade,
               'preco_unit', round(c.total_pago / nullif(c.quantidade, 0), 4), 'para', '[]'::jsonb)
             order by c.created_at)
        from public.compras_mercadoria c
        left join public.ingredients i on i.id = c.ingredient_id
        left join public.products p on p.id = c.product_id
       where c.mercado_compra_id = m.id), '[]'::jsonb))
    from public.mercado_compras m
   where m.id = p_compra and m.user_id = auth.uid();
$$;
revoke all on function public.mercado_compra_abrir(uuid) from public, anon;
grant execute on function public.mercado_compra_abrir(uuid) to authenticated;

-- ------------------------------------------------------------
-- "Quantas unidades você vai fazer com essa compra?"
-- ------------------------------------------------------------
create or replace function public.mercado_rendimento(p_compra uuid, p_produto uuid, p_unidades numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_total numeric; v_custo numeric;
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_unidades is null or p_unidades < 1 or p_unidades > 1000000 then raise exception 'unidades invalidas'; end if;
  if not exists (select 1 from public.products p where p.id = p_produto and p.user_id = u) then raise exception 'produto não é seu'; end if;
  select total into v_total from public.mercado_compras where id = p_compra and user_id = u for update;
  if not found then raise exception 'compra não é sua'; end if;

  update public.mercado_compras set produto_id = p_produto, unidades_previstas = p_unidades where id = p_compra;
  v_custo := case when v_total > 0 then round(v_total / p_unidades, 2) end;
  update public.products
     set cost = coalesce(v_custo, cost), controla_estoque = true, origem = coalesce(origem, 'faz'), updated_at = now()
   where id = p_produto;
  return jsonb_build_object('custo', v_custo, 'unidades', p_unidades);
end $$;
revoke all on function public.mercado_rendimento(uuid, uuid, numeric) from public, anon;
grant execute on function public.mercado_rendimento(uuid, uuid, numeric) to authenticated;

-- ------------------------------------------------------------
-- "Produzi N": product stock up, inputs down.
--   • product with recipe (batch): N ÷ yield batches × recipe quantity of each input;
--   • otherwise: oldest linked purchase still pending — each of its items goes down
--     by N ÷ units planned (50 of 100 = half of the milk, half of the cream…).
-- ------------------------------------------------------------
create or replace function public.produto_produzir(p_produto uuid, p_unidades numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr where rr.product_id = p_produto and rr.quantity > 0 loop
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
end $$;
revoke all on function public.produto_produzir(uuid, numeric) from public, anon;
grant execute on function public.produto_produzir(uuid, numeric) to authenticated;

-- What can still be produced from purchases ("faltam 50 de 100 da compra de 19/10").
create or replace function public.produto_a_produzir()
returns table(produto_id uuid, compra_id uuid, criada_em timestamptz, previstas numeric, produzidas numeric, custo numeric)
language sql stable security definer set search_path = public as $$
  select m.produto_id, m.id, m.criada_em, m.unidades_previstas, m.unidades_produzidas,
         round(m.total / nullif(m.unidades_previstas, 0), 2)
    from public.mercado_compras m
   where m.user_id = auth.uid() and m.produto_id is not null and coalesce(m.unidades_previstas, 0) > 0
     and m.unidades_produzidas < m.unidades_previstas
   order by m.criada_em;
$$;
revoke all on function public.produto_a_produzir() from public, anon;
grant execute on function public.produto_a_produzir() to authenticated;
