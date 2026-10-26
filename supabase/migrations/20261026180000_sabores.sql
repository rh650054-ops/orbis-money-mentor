-- ============================================================
-- SABORES (Rick, 26/10/2026): um produto, uma receita BASE e vários sabores.
--
-- "Eu faço batida de morango e maracujá. Teria que ter isso, em vez de cadastrar
-- duas batidas e colocar tudo de novo."
--
-- • product_variants: os sabores de um produto (nome, emoji, estoque por sabor).
-- • product_recipes.variant_id: NULL = ingrediente da BASE (vai em todos os sabores);
--   preenchido = só daquele sabor (morango congelado, Nutella…).
-- • Custo de cada unidade do sabor = custo da base (products.cost) + extras do sabor ÷ rende.
-- • defcon_sales.variant_id: venda com sabor escolhido tira do estoque do sabor. Venda sem
--   sabor escolhido tira do sabor que tem MAIS estoque (até o Foco perguntar o sabor).
-- • Produzir e distribuir: produto_produzir_sabores (faz N de cada sabor: base e extras
--   baixam, estoque sobe) e produto_sabores_distribuir (divide entre sabores o que o
--   "Tô no mercado" já produziu pela base).
-- • Tudo que contava a receita (Tô no mercado, Produzi, custo pelo ingrediente, desfazer
--   compra) passa a olhar só a BASE (variant_id is null). Produto sem sabor: nada muda.
-- Nada é apagado.
-- ============================================================

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🥤' check (char_length(emoji) <= 8),
  stock_quantity integer not null default 0,
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_product on public.product_variants (product_id);
alter table public.product_variants enable row level security;
drop policy if exists product_variants_own on public.product_variants;
create policy product_variants_own on public.product_variants for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.product_variants from anon;
grant select, insert, update, delete on public.product_variants to authenticated;

alter table public.product_recipes add column if not exists variant_id uuid references public.product_variants (id) on delete cascade;
create index if not exists product_recipes_variant on public.product_recipes (variant_id);
alter table public.defcon_sales add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

-- ------------------------------------------------------------
-- A receita BASE: só mexe nas linhas sem sabor. Custo do produto = base ÷ rende.
-- ------------------------------------------------------------
create or replace function public.produto_salvar_receita(p_produto uuid, p_itens jsonb, p_rende numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  it jsonb;
  v_id uuid; v_nome text; v_qtd numeric; v_preco numeric;
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
    if v_nome = '' or v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000 then
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
      insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p_produto, v_id, v_qtd);
      v_ids := array_append(v_ids, v_id);
    end if;
  end loop;

  select count(*) filter (where coalesce(i.cost_per_unit, 0) <= 0),
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

create or replace function public.recalc_custo_produtos_do_ingrediente(p_ingredient_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
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
end $function$;

-- Tô no mercado, Produzi e desfazer compra: contam levas só pela BASE
do $$
declare d text; n text; f text;
begin
  foreach f in array array['mercado_concluir', 'produto_produzir', 'mercado_desfazer'] loop
    continue when not exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace);
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = f and p.pronamespace = 'public'::regnamespace;
    continue when position('rr.variant_id is null' in d) > 0;
    n := regexp_replace(d, 'where rr\.product_id = v_prod\.id and rr\.quantity > 0 loop',
                           'where rr.product_id = v_prod.id and rr.quantity > 0 and rr.variant_id is null loop', 'g');
    n := regexp_replace(n, 'where rr\.product_id = p_produto and rr\.quantity > 0 loop',
                           'where rr.product_id = p_produto and rr.quantity > 0 and rr.variant_id is null loop', 'g');
    n := regexp_replace(n, 'from public\.product_recipes rr where rr\.product_id = b\.product_id loop',
                           'from public.product_recipes rr where rr.product_id = b.product_id and rr.variant_id is null loop', 'g');
    if n <> d then execute n; end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Os sabores do produto, com estoque e custo de cada unidade
-- ------------------------------------------------------------
create or replace function public.produto_sabores(p_produto uuid)
returns table(id uuid, nome text, emoji text, estoque integer, custo numeric, extras jsonb)
language sql stable security definer set search_path to 'public' as $$
  select v.id, v.name, v.emoji, v.stock_quantity,
         round(coalesce(p.cost, 0) + coalesce((
           select sum(r.quantity * coalesce(i.cost_per_unit, 0))
             from public.product_recipes r join public.ingredients i on i.id = r.ingredient_id
            where r.variant_id = v.id), 0) / greatest(coalesce(p.batch_yield, 0), 1), 2),
         coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.name, 'qtd', r.quantity, 'preco', coalesce(i.cost_per_unit, 0),
                                                       'unidade', coalesce(i.unit, 'un'), 'pacote', coalesce(i.pacote_qtd, 1), 'estoque', coalesce(i.stock_quantity, 0))
                                    order by r.created_at)
                     from public.product_recipes r join public.ingredients i on i.id = r.ingredient_id
                    where r.variant_id = v.id), '[]'::jsonb)
    from public.product_variants v join public.products p on p.id = v.product_id
   where v.product_id = p_produto and v.user_id = auth.uid()
   order by v.posicao, v.created_at;
$$;
revoke all on function public.produto_sabores(uuid) from public, anon;
grant execute on function public.produto_sabores(uuid) to authenticated;

-- ------------------------------------------------------------
-- Salvar os sabores: [{id?, nome, emoji, itens:[{id?, nome, qtd, preco}]}]
-- Sabor que saiu da lista é apagado (o estoque dele volta pro total do produto, que
-- não muda; vendas antigas ficam sem sabor).
-- ------------------------------------------------------------
create or replace function public.produto_sabores_salvar(p_produto uuid, p_sabores jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  s jsonb; it jsonb;
  v_vid uuid; v_nome text; v_emoji text; v_pos int := 0;
  v_ids uuid[] := '{}';
  v_iid uuid; v_inome text; v_qtd numeric; v_preco numeric;
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
        continue when v_inome = '' or v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000;
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
          insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p_produto, v_iid, v_qtd, v_vid);
        end if;
      end loop;
    end if;
  end loop;

  delete from public.product_variants v where v.product_id = p_produto and v.user_id = u and not (v.id = any (v_ids));
  return jsonb_build_object('sabores', coalesce(array_length(v_ids, 1), 0));
end $$;
revoke all on function public.produto_sabores_salvar(uuid, jsonb) from public, anon;
grant execute on function public.produto_sabores_salvar(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- "Produzi": N de cada sabor. Base baixa pelo total, extras pelo sabor.
-- p_sabores: [{id, unidades}]
-- ------------------------------------------------------------
create or replace function public.produto_produzir_sabores(p_produto uuid, p_sabores jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
end $$;
revoke all on function public.produto_produzir_sabores(uuid, jsonb) from public, anon;
grant execute on function public.produto_produzir_sabores(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Distribuir entre sabores o que já está no estoque do produto sem sabor (ex.: o que o
-- "Tô no mercado" produziu pela base). Só os extras baixam. p_sabores: [{id, unidades}]
-- ------------------------------------------------------------
create or replace function public.produto_sabores_distribuir(p_produto uuid, p_sabores jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
end $$;
revoke all on function public.produto_sabores_distribuir(uuid, jsonb) from public, anon;
grant execute on function public.produto_sabores_distribuir(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Venda no Foco: tira do sabor escolhido; sem sabor, do que tem mais estoque.
-- ------------------------------------------------------------
create or replace function public.defcon_venda_baixa_estoque()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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
end $function$;
