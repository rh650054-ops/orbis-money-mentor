-- Products, Mercado and Production module (23/11/2026). Requires 20261123120000 (yield per flavour).
--
-- What it changes
--   1) mercado_concluir: a purchase NO LONGER manufactures products. Ingredients go to stock (as
--      always, by the compras_mercadoria trigger or the direct update); ready products bought for
--      resale still go to stock. For each recipe product it answers how much the stock now allows
--      (pode_receitas / pode_unidades) and whether the recipe is complete; receitas / unidades = 0.
--   2) mercado_salvar: editing a purchase saved before this date still undoes its automatic
--      production (as always) and now says so in the answer (producao_desfeita).
--   3) produto_estoque_inicial: the stock a seller already has when registering a product, per
--      flavour. Only for a product that never moved (no production, no batch, no sale).
--   4) producao_simular: what a production would consume and what is missing, with the same rules as
--      producao_registrar (nothing is written).
--   5) producao_recentes: the seller's last productions, to correct or undo them.
--   6) aplicar_compra_mercadoria (trigger of every purchase line): the cost per unit of an
--      INGREDIENT is kept with 10 decimals instead of 4 on NEW purchases (R$ 35,99 per kg = R$ 0,03599
--      per g, was stored as 0,0360 = R$ 36,00 per kg). Same formula (weighted average); resale
--      products stay at 2 decimals; no stored cost is rewritten.
-- What it does NOT touch: costs (average cost, products.cost, recalc), sales, Open Finance, any row.
-- Rollback: supabase/modulo-producao/rollback.sql.

do $$
declare h text;
begin
  if to_regprocedure('public.produto_receita_por_sabor(uuid)') is null then
    raise exception 'Aplique antes 20261123120000_rendimento_por_sabor.sql.';
  end if;
  -- the bodies replaced below must be exactly the ones production ran on 23/11/2026
  select left(md5(replace(prosrc, E'\r', '')), 12) into h from pg_proc where oid = 'public.mercado_concluir(jsonb,numeric,boolean)'::regprocedure;
  if h is distinct from '49f187eca986' then raise exception 'mercado_concluir mudou desde 23/11 (md5 %); revise antes de aplicar.', h; end if;
  select left(md5(replace(prosrc, E'\r', '')), 12) into h from pg_proc where oid = 'public.mercado_salvar(jsonb,numeric,boolean,numeric,jsonb,uuid)'::regprocedure;
  if h is distinct from '07c48116edb8' then raise exception 'mercado_salvar mudou desde 23/11 (md5 %); revise antes de aplicar.', h; end if;
end $$;

-- ------------------------------------------------------------------ 1) the purchase only registers
create or replace function public.mercado_concluir(
  p_itens jsonb, p_total numeric default null, p_por_item boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$

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
    -- 23/11/2026: the purchase no longer manufactures. It says how much the stock now allows;
    -- the seller produces on the production screen (producao_registrar), with the real numbers.
    v_out := v_out || jsonb_build_object(
      'id', v_prod.id, 'nome', v_prod.name, 'receitas', 0, 'unidades', 0,
      'pode_receitas', v_receitas,
      'pode_unidades', case when public.produto_receita_por_sabor(v_prod.id) then null else v_unid end,
      'receita_completa', not exists (select 1 from public.product_recipes rr where rr.product_id = v_prod.id and (rr.quantity <= 0 or rr.aprender)),
      'custo_antes', coalesce((v_custo_antes->>v_pid)::numeric, 0),
      'custo_depois', (select coalesce(p.cost, 0) from public.products p where p.id = v_prod.id));
  end loop;
  return jsonb_build_object('compra_id', v_compra, 'total', v_header, 'produtos', v_out);
end $$;

-- ------------------------------------------------------------------ 2) editing an old purchase
create or replace function public.mercado_salvar(
  p_itens jsonb, p_total numeric default null, p_por_item boolean default true,
  p_desconto numeric default 0, p_itens_orig jsonb default null, p_editar uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  r jsonb; v_novo uuid; v_id uuid; h record; v_desfeita jsonb := '[]';
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_desconto is null or p_desconto < 0 or p_desconto > 1000000 then raise exception 'desconto invalido'; end if;

  if p_editar is not null then
    select * into h from public.mercado_compras where id = p_editar and user_id = u;
    if not found then raise exception 'compra não é sua'; end if;
    -- 23/11/2026: a purchase saved before this date may have manufactured units ("Tô no mercado").
    -- Undoing it takes them back (as always); the new purchase no longer remakes them, so the
    -- answer says what was undone and the screen offers to produce it again.
    select coalesce(jsonb_agg(jsonb_build_object('id', b.product_id, 'nome', p.name, 'unidades', b.unidades) order by p.name), '[]')
      into v_desfeita
      from (select product_id, sum(units_produced) as unidades from public.production_batches
             where mercado_compra_id = p_editar and user_id = u and notes = 'Tô no mercado' group by 1) b
      join public.products p on p.id = b.product_id;
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

  return r || jsonb_build_object('desconto', round(p_desconto, 2), 'producao_desfeita', v_desfeita);
end $$;

-- ------------------------------------------------------------------ 3) initial stock per flavour
-- p_sabores = [{"id": uuid, "unidades": int ≥ 0}]; p_sem_sabor = units without a flavour.
-- The product total becomes p_sem_sabor + the sum of the flavours.
create or replace function public.produto_estoque_inicial(p_produto uuid, p_sem_sabor integer default 0, p_sabores jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); s jsonb; v_vid uuid; v_n numeric; v_total integer;
begin
  if u is null then raise exception 'Faça login.' using hint = 'VANT_LOGIN'; end if;
  perform 1 from public.products where id = p_produto and user_id = u for update;
  if not found then raise exception 'Produto não encontrado.' using hint = 'VANT_PRODUTO_INVALIDO'; end if;
  if p_sem_sabor is null or p_sem_sabor < 0 or p_sem_sabor > 1000000 then
    raise exception 'Quantidade inválida.' using hint = 'VANT_UNIDADES_INVALIDAS';
  end if;
  if p_sabores is null or jsonb_typeof(p_sabores) <> 'array' or jsonb_array_length(p_sabores) > 30 then
    raise exception 'Sabores inválidos.' using hint = 'VANT_SABOR_INVALIDO';
  end if;
  -- only the starting point: once something moved, the stock follows production and sales
  if exists (select 1 from public.producao_itens where product_id = p_produto and user_id = u)
     or exists (select 1 from public.production_batches where product_id = p_produto and user_id = u)
     or exists (select 1 from public.defcon_sales where product_id = p_produto and user_id = u) then
    raise exception 'Esse produto já teve produção ou venda: o estoque agora segue a produção e as vendas.' using hint = 'VANT_ESTOQUE_JA_MOVIMENTADO';
  end if;
  perform 1 from public.product_variants where product_id = p_produto order by id for update;
  for s in select value from jsonb_array_elements(p_sabores) loop
    begin v_vid := (s->>'id')::uuid; exception when others then v_vid := null; end;
    if v_vid is null or not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = p_produto and v.user_id = u) then
      raise exception 'Sabor não encontrado neste produto.' using hint = 'VANT_SABOR_INVALIDO';
    end if;
    v_n := case when jsonb_typeof(s->'unidades') = 'number' then (s->>'unidades')::numeric end;
    if v_n is null or v_n <> trunc(v_n) or v_n < 0 or v_n > 1000000 then
      raise exception 'Quantidade inválida: use um número inteiro.' using hint = 'VANT_UNIDADES_INVALIDAS';
    end if;
    update public.product_variants set stock_quantity = v_n::int, updated_at = now() where id = v_vid;
  end loop;
  select p_sem_sabor + coalesce(sum(stock_quantity), 0) into v_total from public.product_variants where product_id = p_produto;
  update public.products set stock_quantity = v_total, controla_estoque = true, updated_at = now() where id = p_produto;
  return jsonb_build_object('estoque', v_total,
    'sabores', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'estoque', stock_quantity) order by posicao, name), '[]') from public.product_variants where product_id = p_produto));
end $$;

-- ------------------------------------------------------------------ 4) preview of a production
create or replace function public.producao_simular(p_itens jsonb, p_consumo jsonb default null, p_justificativa text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); v jsonb;
begin
  if u is null then raise exception 'Faça login.' using hint = 'VANT_LOGIN'; end if;
  v := public.producao_estado_alvo(u, p_itens, p_consumo, p_justificativa);
  return jsonb_build_object('itens', v->'itens', 'consumo', v->'consumo', 'avisos', v->'avisos', 'ajustes', v->'ajustes',
    'receita_reduzida', v->'receita_reduzida',
    'faltas', (select coalesce(jsonb_agg(jsonb_build_object('ingrediente', g.id, 'nome', g.name, 'unidade', g.unit,
                       'precisa', (c->>'real')::numeric, 'tem', greatest(g.stock_quantity, 0)) order by g.name), '[]')
                 from jsonb_array_elements(v->'consumo') c join public.ingredients g on g.id = (c->>'ingrediente')::uuid
                where g.stock_quantity < (c->>'real')::numeric));
end $$;

-- ------------------------------------------------------------------ 5) recent productions
create or replace function public.producao_recentes(p_limite integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'criado_em' desc), '[]') from (
    select jsonb_build_object('id', r.id, 'status', r.status, 'versao', r.versao, 'criado_em', r.criado_em, 'atualizado_em', r.atualizado_em,
             -- the items of the last version that had items (an undone one shows what it was)
             'itens', (select coalesce(jsonb_agg(jsonb_build_object('produto', i.product_id, 'sabor', i.variant_id, 'unidades', i.unidades,
                                                                    'produto_nome', i.produto_nome, 'sabor_nome', i.sabor_nome) order by i.produto_nome, i.sabor_nome), '[]')
                         from public.producao_itens i
                        where i.evento_id = (select e.id from public.producao_eventos e
                                              where e.registro_id = r.id and exists (select 1 from public.producao_itens i2 where i2.evento_id = e.id)
                                              order by e.versao desc limit 1))) as x
      from public.producao_registros r
     where r.user_id = auth.uid()
     order by r.criado_em desc
     limit least(greatest(coalesce(p_limite, 20), 1), 100)) z
$$;

-- ------------------------------------------------------------------ 6) ingredient cost precision on new purchases
create or replace function pg_temp.mp_trocar(d text, velho text, novo text) returns text language plpgsql as $$
declare n int := (length(d) - length(replace(d, velho, ''))) / length(velho);
begin
  if n <> 1 then raise exception 'trecho encontrado % vezes (esperado 1): %', n, left(velho, 80); end if;
  return replace(d, velho, novo);
end $$;
do $$
declare d text := pg_get_functiondef('public.aplicar_compra_mercadoria()'::regprocedure);
begin
  if left(md5(replace((select prosrc from pg_proc where oid = 'public.aplicar_compra_mercadoria()'::regprocedure), E'\r', '')), 12) <> '103c0241ba71' then
    raise exception 'aplicar_compra_mercadoria mudou desde 23/11; revise antes de aplicar.';
  end if;
  d := pg_temp.mp_trocar(d, 'v_custo_compra := round(new.total_pago / new.quantidade, 4);',
                            'v_custo_compra := round(new.total_pago / new.quantidade, 10); -- 20261123150000 (was 4)');
  d := pg_temp.mp_trocar(d, '/ (v_old_stock + new.quantidade), 4);', '/ (v_old_stock + new.quantidade), 10); -- 20261123150000 (was 4)');
  execute d;
end $$;

revoke all on function public.produto_estoque_inicial(uuid, integer, jsonb) from public, anon;
revoke all on function public.producao_simular(jsonb, jsonb, text) from public, anon;
revoke all on function public.producao_recentes(integer) from public, anon;
grant execute on function public.produto_estoque_inicial(uuid, integer, jsonb) to authenticated;
grant execute on function public.producao_simular(jsonb, jsonb, text) to authenticated;
grant execute on function public.producao_recentes(integer) to authenticated;
