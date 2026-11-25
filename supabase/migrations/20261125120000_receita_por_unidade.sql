-- VANT Receita Inteligente, per-unit costs (25/11/2026, Rick).
-- A recipe line can now be used PER BATCH (1 box of condensed milk per recipe) or PER UNIT PRODUCED
-- (1 bottle, 1 sticker, 1 straw per unit). A product can also carry costs WITHOUT physical stock
-- (labour, fees), which add to the cost and never touch any stock.
--
-- Design: product_recipes.quantity keeps meaning "quantity per batch" for EVERY line, so every
-- existing function that consumes or counts by quantity (Mercado, Produzi, flavours, stock checks,
-- recalc of cost) keeps working unchanged. A per-unit line also remembers its per-unit amount
-- (qtd_por_unidade) and its quantity per batch is kept = qtd_por_unidade × yield:
--   * by produto_salvar_receita when the recipe is saved;
--   * by a trigger when the product's yield changes anywhere else.
-- The only consumer that uses ANOTHER yield (a flavour with its own yield, 23/11) is patched to
-- consume a per-unit line by the units produced (units × qtd_por_unidade).
--
-- Compatibility (Rick's rule 7): nothing existing is rewritten. Old lines get base = NULL
-- ("not classified yet"): they keep being per batch, exactly as today; the app asks the seller to
-- confirm only the ambiguous ones when he edits the recipe. No cost, sale, stock, production,
-- purchase, Open Finance, ranking or subscription row is changed by this migration.
--
-- Objects:
--   1) product_recipes.base ('receita' | 'unidade' | null) and product_recipes.qtd_por_unidade
--   2) products.custos_extras jsonb (default '[]'): [{nome, valor, por: 'unidade'|'receita'}]
--   3) custo_extra_por_unidade(extras, yield): the extras' share of one unit
--   4) produto_salvar_receita: same 3-arg calls keep working; new optional p_extras; per-unit lines
--   5) recalc_custo_produtos_do_ingrediente: includes the extras
--   6) trigger: yield change keeps per-unit lines' quantity per batch in step
--   7) producao_estado_alvo: per-unit base lines consumed by units produced
-- Rollback: supabase/receita-por-unidade/rollback.sql

-- ------------------------------------------------------------------ 1) per-unit lines
alter table public.product_recipes
  add column if not exists base text check (base is null or base in ('receita', 'unidade')),
  add column if not exists qtd_por_unidade numeric check (qtd_por_unidade is null or (qtd_por_unidade >= 0 and qtd_por_unidade <= 100000));
comment on column public.product_recipes.base is 'How the seller measures this line: receita = per batch, unidade = per unit produced; null = old line, not classified (works per batch).';
comment on column public.product_recipes.qtd_por_unidade is 'Per-unit amount of a base=unidade line; quantity (per batch) = qtd_por_unidade × yield.';

-- ------------------------------------------------------------------ 2) costs without stock
alter table public.products
  add column if not exists custos_extras jsonb not null default '[]'::jsonb
    check (jsonb_typeof(custos_extras) = 'array' and jsonb_array_length(custos_extras) <= 20);
comment on column public.products.custos_extras is 'Costs without physical stock (labour, fees): [{nome, valor, por: unidade|receita}]. Never consumed from any stock.';

-- ------------------------------------------------------------------ 3) extras' share of one unit
create or replace function public.custo_extra_por_unidade(p_extras jsonb, p_rende numeric) returns numeric
language sql immutable set search_path to 'public' as $$
  select coalesce(sum(case when e->>'por' = 'receita'
                           then case when coalesce(p_rende, 0) > 0 then (e->>'valor')::numeric / p_rende else 0 end
                           else (e->>'valor')::numeric end), 0)
    from jsonb_array_elements(case when jsonb_typeof(p_extras) = 'array' then p_extras else '[]'::jsonb end) e
   where coalesce(nullif(e->>'valor', '')::numeric, 0) > 0
$$;

-- ------------------------------------------------------------------ 4) saving a recipe
-- The 3-arg function is replaced by one with an optional 4th argument (absent = keep the extras),
-- so an app still on the old version calls it exactly as before.
drop function if exists public.produto_salvar_receita(uuid, jsonb, numeric);
create or replace function public.produto_salvar_receita(p_produto uuid, p_itens jsonb, p_rende numeric, p_extras jsonb default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  it jsonb; e jsonb;
  v_id uuid; v_nome text; v_qtd numeric; v_preco numeric; v_aprender boolean;
  v_base text; v_qpu numeric;
  v_ids uuid[] := '{}';
  v_sem_custo int; v_custo numeric; v_extras jsonb;
begin
  if u is null then raise exception 'login necessario'; end if;
  if not exists (select 1 from public.products p where p.id = p_produto and p.user_id = u) then
    raise exception 'produto não é seu';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'receita invalida'; end if;
  if jsonb_array_length(p_itens) > 40 then raise exception 'ingredientes demais'; end if;

  -- costs without stock: validated and normalised; null = keep what the product has
  if p_extras is not null then
    if jsonb_typeof(p_extras) <> 'array' or jsonb_array_length(p_extras) > 20 then raise exception 'custos invalidos'; end if;
    v_extras := '[]'::jsonb;
    for e in select value from jsonb_array_elements(p_extras) loop
      if left(trim(coalesce(e->>'nome', '')), 60) = '' or coalesce(e->>'por', '') not in ('unidade', 'receita')
         or nullif(e->>'valor', '') is null or (e->>'valor')::numeric < 0 or (e->>'valor')::numeric > 100000 then
        raise exception 'custo invalido';
      end if;
      v_extras := v_extras || jsonb_build_array(jsonb_build_object('nome', left(trim(e->>'nome'), 60), 'valor', (e->>'valor')::numeric, 'por', e->>'por'));
    end loop;
    update public.products set custos_extras = v_extras where id = p_produto;
  end if;
  select coalesce(p.custos_extras, '[]'::jsonb) into v_extras from public.products p where p.id = p_produto;

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
    -- absent = an old app: the line stays unclassified (per batch), as it always was
    v_base := nullif(it->>'por', '');
    if v_base is not null and v_base not in ('receita', 'unidade') then raise exception 'ingrediente invalido'; end if;
    v_qpu := null;
    if v_aprender then v_qtd := 0;
    elsif v_base = 'unidade' and v_qtd is not null then
      -- "1 bottle per unit" in a recipe that yields 5 = 5 bottles per batch
      v_qpu := v_qtd;
      v_qtd := v_qpu * p_rende;
    end if;
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
      -- the same ingredient twice: one line per batch (per-unit memory dropped, the total is kept)
      update public.product_recipes set quantity = quantity + v_qtd, base = 'receita', qtd_por_unidade = null
       where product_id = p_produto and ingredient_id = v_id and variant_id is null;
    else
      insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, aprender, base, qtd_por_unidade)
      values (u, p_produto, v_id, v_qtd, v_aprender, v_base, v_qpu);
      v_ids := array_append(v_ids, v_id);
    end if;
  end loop;

  select count(*) filter (where coalesce(i.cost_per_unit, 0) <= 0 and not r.aprender),
         round(sum(r.quantity * coalesce(i.cost_per_unit, 0)) / p_rende + public.custo_extra_por_unidade(v_extras, p_rende), 2)
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
revoke all on function public.produto_salvar_receita(uuid, jsonb, numeric, jsonb) from public, anon;
grant execute on function public.produto_salvar_receita(uuid, jsonb, numeric, jsonb) to authenticated;

-- ------------------------------------------------------------------ 5) cost when an ingredient price changes
create or replace function public.recalc_custo_produtos_do_ingrediente(p_ingredient_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
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
  -- 25/11: plus the costs without stock (labour, fees); '[]' adds 0, so old products are unchanged
  update public.products p
     set cost = case when p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0
                     then round(sub.custo / p.batch_yield + public.custo_extra_por_unidade(p.custos_extras, p.batch_yield), 2)
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

-- ------------------------------------------------------------------ 6) yield changed elsewhere
create or replace function public.receita_por_unidade_acompanha_rendimento() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.batch_yield, 0) > 0 then
    update public.product_recipes r
       set quantity = r.qtd_por_unidade * new.batch_yield
     where r.product_id = new.id and r.variant_id is null and r.base = 'unidade'
       and r.qtd_por_unidade is not null and r.quantity is distinct from r.qtd_por_unidade * new.batch_yield;
  end if;
  return null;
end $$;
revoke all on function public.receita_por_unidade_acompanha_rendimento() from public, anon, authenticated;
drop trigger if exists receita_por_unidade_rendimento on public.products;
create trigger receita_por_unidade_rendimento
  after update of batch_yield on public.products
  for each row when (old.batch_yield is distinct from new.batch_yield)
  execute function public.receita_por_unidade_acompanha_rendimento();

-- ------------------------------------------------------------------ 7) production with a flavour's own yield
create or replace function pg_temp.rpu_trocar(d text, velho text, novo text) returns text language plpgsql as $$
declare eol text := case when position(E'\r\n' in d) > 0 then E'\r\n' else E'\n' end; n int;
begin
  velho := replace(velho, E'\n', eol); novo := replace(novo, E'\n', eol);
  n := (length(d) - length(replace(d, velho, ''))) / length(velho);
  if n <> 1 then raise exception 'trecho encontrado % vezes (esperado 1): %', n, left(velho, 80); end if;
  return replace(d, velho, novo);
end $$;
do $$
declare d text := pg_get_functiondef('public.producao_estado_alvo(uuid,jsonb,jsonb,text)'::regprocedure);
begin
  if position('20261125120000' in d) > 0 then raise exception 'producao_estado_alvo já alterada por esta migration'; end if;
  -- units / batch yield × quantity per batch, except a per-unit line: units × its per-unit amount
  -- (same number when the flavour uses the product's yield; right when it has its own)
  execute pg_temp.rpu_trocar(d,
    'select r.ingredient_id, b.u / b.y * r.quantity as q',
    'select r.ingredient_id, case when r.base = ''unidade'' and r.qtd_por_unidade is not null then b.u * r.qtd_por_unidade else b.u / b.y * r.quantity end as q -- 20261125120000');
end $$;
