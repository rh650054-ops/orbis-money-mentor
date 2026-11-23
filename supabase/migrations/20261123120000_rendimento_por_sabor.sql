-- Yield per flavour (23/11/2026). DB stage only: nothing in the app sends the new fields yet.
-- Requires Etapa 1 (20261122120000 + 20261122130000) applied first.
--
-- What it changes
--   1) product_variants: batch_yield (null = use the product's) and usa_base (default true = take
--      the base recipe, today's behaviour). Existing flavours get null/true: nothing changes.
--   2) product_recipes: the UNIQUE (product_id, ingredient_id) becomes two partial unique indexes,
--      one for the base and one per flavour. The same ingredient may now be in the base AND in
--      flavours (or in several flavours) without a second stock record. Every row of today is
--      valid under both (the old rule was stricter).
--   3) producao_estado_alvo (Etapa 1, new flow, not in production yet): each item uses its
--      flavour's yield; a flavour with usa_base=false skips the base; an active ingredient with no
--      quantity (zeroed or "aprender") blocks the new production as an incomplete recipe.
--   4) produto_sabores_salvar: accepts optional "rende" and "usa_base" per flavour (absent = keep
--      what is stored). Patched in place from the production body (as 20261026180000 did).
--   5) produto_produzir, produto_produzir_sabores, produto_sabores_distribuir (the old paths, which
--      only know the product's yield): refuse ONLY products with per-flavour data. One line added
--      at the top of each production body; the rest stays byte for byte.
--   6) receita_registrar + trigger on product_variants: yield / usa_base changes go to the recipe log.
-- What it does NOT touch: costs (products.cost, recalc_custo_*), produto_sabores (displayed cost),
-- sales, Mercado (mercado_*), Open Finance, any row of data.
-- Rollback: supabase/rendimento-por-sabor/rollback.sql (refuses while per-flavour data exists).

do $$
begin
  if to_regclass('public.receita_alteracoes') is null or to_regprocedure('public.producao_estado_alvo(uuid,jsonb,jsonb,text)') is null then
    raise exception 'Aplique antes a Etapa 1 (20261122120000 e 20261122130000).';
  end if;
end $$;

-- ------------------------------------------------------------------ 1) columns
alter table public.product_variants
  add column batch_yield numeric check (batch_yield is null or (batch_yield > 0 and batch_yield <= 1000000)),
  add column usa_base boolean not null default true;
comment on column public.product_variants.batch_yield is 'Units per batch of THIS flavour; null = the product''s batch_yield.';
comment on column public.product_variants.usa_base is 'true = the flavour takes the base recipe plus its own rows (default, behaviour before 23/11); false = only its own rows.';

-- ------------------------------------------------------------------ 2) shared ingredients
alter table public.product_recipes drop constraint product_recipes_product_id_ingredient_id_key;
create unique index product_recipes_base_ingrediente_key on public.product_recipes (product_id, ingredient_id) where variant_id is null;
create unique index product_recipes_sabor_ingrediente_key on public.product_recipes (variant_id, ingredient_id) where variant_id is not null;

-- ------------------------------------------------------------------ helper
-- A product the old paths cannot compute: some flavour with its own yield or without the base.
create function public.produto_receita_por_sabor(p_produto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.product_variants v
                  where v.product_id = p_produto and (v.batch_yield is not null or not v.usa_base))
$$;
revoke all on function public.produto_receita_por_sabor(uuid) from public, anon, authenticated;

-- In-place patch helper (this session only): replaces ONE exact occurrence, keeping the
-- function's own line endings (production bodies use CRLF).
create or replace function pg_temp.rps_trocar(d text, velho text, novo text) returns text language plpgsql as $$
declare eol text := case when position(E'\r\n' in d) > 0 then E'\r\n' else E'\n' end; n int;
begin
  velho := replace(velho, E'\n', eol); novo := replace(novo, E'\n', eol);
  n := (length(d) - length(replace(d, velho, ''))) / length(velho);
  if n <> 1 then raise exception 'trecho encontrado % vezes (esperado 1): %', n, left(velho, 80); end if;
  return replace(d, velho, novo);
end $$;

-- ------------------------------------------------------------------ 3) new flow: consumption per flavour
create or replace function public.producao_estado_alvo(p_user uuid, p_itens jsonb, p_consumo jsonb, p_justificativa text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  it jsonb; v_pid uuid; v_vid uuid; v_n numeric; v_iid uuid; v_txt text; v_txt2 text;
  v_itens jsonb := '[]'; v_ovr jsonb := '[]'; v_res jsonb; v_ajustes jsonb; v_abaixo text[]; v_versoes jsonb;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos um produto para produzir.' using hint = 'VANT_ITENS_INVALIDOS';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Máximo de 100 itens por produção.' using hint = 'VANT_ITENS_INVALIDOS';
  end if;

  for it in select value from jsonb_array_elements(p_itens) loop
    begin v_pid := (it->>'produto')::uuid; exception when others then v_pid := null; end;
    if v_pid is null or not exists (select 1 from public.products p where p.id = v_pid and p.user_id = p_user) then
      raise exception 'Produto não encontrado.' using hint = 'VANT_PRODUTO_INVALIDO';
    end if;
    v_vid := null;
    if nullif(it->>'sabor', '') is not null then
      begin v_vid := (it->>'sabor')::uuid; exception when others then v_vid := null; end;
      if v_vid is null or not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = v_pid and v.user_id = p_user) then
        raise exception 'Sabor não encontrado neste produto.' using hint = 'VANT_SABOR_INVALIDO';
      end if;
    end if;
    v_n := case when jsonb_typeof(it->'unidades') = 'number' then (it->>'unidades')::numeric end;
    if v_n is null or v_n <> trunc(v_n) or v_n < 1 or v_n > 1000000 then
      raise exception 'Quantidade inválida: use um número inteiro de 1 a 1.000.000.' using hint = 'VANT_UNIDADES_INVALIDAS';
    end if;
    v_itens := v_itens || jsonb_build_object('produto', v_pid, 'sabor', v_vid, 'unidades', v_n::int);
  end loop;

  -- Only a MANUFACTURED product, with a VALID recipe, can be produced (22/11, approved flow):
  --   * every item needs valid consumption: a base line > 0, or (not per_unit) a line > 0 of the
  --     flavour being produced;
  --   * a product without a recipe (bought ready / resale, or a sheet never filled in) stays
  --     registered and sellable, but its stock grows through the purchase record, never here
  --     (VANT_PRODUTO_SEM_RECEITA);
  --   * a recipe with every ingredient zeroed or removed stays saved as a draft and cannot produce,
  --     with or without a reason (VANT_RECEITA_INCOMPLETA): otherwise one justification would open
  --     unlimited production with no material;
  --   * typed consumption cannot replace a recipe: nothing is invented.
  -- No existing product is changed: the screen will offer to complete the sheet first.
  -- 23/11 (yield per flavour): the rows that apply to an item are the base (when the item has no
  -- flavour, or its flavour uses the base: usa_base, true by default) plus, outside per_unit, the
  -- flavour's own rows. For every product without per-flavour data this is exactly the 22/11 rule.
  with itens as (select x.produto, x.sabor from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid)),
  sem as (
    select p.id, p.name,
           exists (select 1 from public.product_recipes r where r.product_id = p.id)
           or exists (select 1 from public.receita_alteracoes a where a.product_id = p.id and a.campo = 'ingrediente') as teve_receita
      from itens i join public.products p on p.id = i.produto
      left join public.product_variants v on v.id = i.sabor
     where not exists (select 1 from public.product_recipes r where r.product_id = p.id and r.variant_id is null and r.quantity > 0
                         and (i.sabor is null or v.usa_base))
       and not (p.recipe_mode <> 'per_unit' and i.sabor is not null
                and exists (select 1 from public.product_recipes r where r.variant_id = i.sabor and r.quantity > 0))
  )
  select string_agg(distinct name, ', ') filter (where teve_receita), string_agg(distinct name, ', ') filter (where not teve_receita)
    into v_txt, v_txt2 from sem;
  if v_txt2 is not null then
    raise exception '% não tem receita, então não é fabricado pelo app. Produto comprado pronto entra no estoque pelo registro de compra; se você faz esse produto, cadastre a receita para produzir.', v_txt2
      using hint = 'VANT_PRODUTO_SEM_RECEITA';
  end if;
  if v_txt is not null then
    raise exception 'A receita de % está incompleta (nenhum ingrediente com quantidade). Ela continua salva como rascunho; complete a ficha para produzir.', v_txt
      using hint = 'VANT_RECEITA_INCOMPLETA';
  end if;

  -- 23/11: an ACTIVE ingredient without quantity (zeroed, or "aprender" still waiting for the next
  -- purchase) in a row that applies to the item would simply not be consumed. Such a recipe stays
  -- saved as a draft, but it no longer opens production in the new flow. Per-unit products are not
  -- consumed here (their ingredients go at the sale), so they are not checked.
  select string_agg(distinct p.name, ', ') into v_txt
    from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid)
    join public.products p on p.id = x.produto
    left join public.product_variants v on v.id = x.sabor
   where p.recipe_mode <> 'per_unit'
     and exists (select 1 from public.product_recipes r
                  where (r.quantity <= 0 or r.aprender)
                    and ((r.product_id = p.id and r.variant_id is null and (x.sabor is null or v.usa_base))
                         or (x.sabor is not null and r.variant_id = x.sabor)));
  if v_txt is not null then
    raise exception 'A receita de % tem ingrediente sem quantidade. Ela continua salva como rascunho; complete a ficha para produzir.', v_txt
      using hint = 'VANT_RECEITA_INCOMPLETA';
  end if;

  -- a recipe without a yield cannot be converted into ingredients: block instead of producing for free
  -- (23/11: per item, with the flavour's own yield when it has one, else the product's)
  select string_agg(distinct p.name, ', ') into v_txt
    from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid) join public.products p on p.id = x.produto
    left join public.product_variants v on v.id = x.sabor
   where p.recipe_mode <> 'per_unit' and coalesce(v.batch_yield, p.batch_yield, 0) <= 0
     and exists (select 1 from public.product_recipes r where r.product_id = p.id and r.quantity > 0);
  if v_txt is not null then
    raise exception 'A receita de % não tem rendimento por leva. Ajuste a ficha antes de produzir.', v_txt using hint = 'VANT_RECEITA_SEM_RENDIMENTO';
  end if;

  if p_consumo is not null and jsonb_typeof(p_consumo) <> 'null' then
    if jsonb_typeof(p_consumo) <> 'array' then
      raise exception 'Consumo informado inválido.' using hint = 'VANT_CONSUMO_INVALIDO';
    end if;
    for it in select value from jsonb_array_elements(p_consumo) loop
      begin v_iid := (it->>'ingrediente')::uuid; exception when others then v_iid := null; end;
      if v_iid is null or not exists (select 1 from public.ingredients g where g.id = v_iid and g.user_id = p_user) then
        raise exception 'Ingrediente não encontrado.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      v_n := case when jsonb_typeof(it->'quantidade') = 'number' then (it->>'quantidade')::numeric end;
      if v_n is null or v_n < 0 or v_n > 1000000 then
        raise exception 'Quantidade de ingrediente inválida.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      if exists (select 1 from jsonb_array_elements(v_ovr) o where (o->>'ingrediente')::uuid = v_iid) then
        raise exception 'Ingrediente repetido no consumo informado.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      v_ovr := v_ovr || jsonb_build_object('ingrediente', v_iid, 'quantidade', v_n);
    end loop;
  end if;

  with itens as (
    select x.produto, x.sabor, sum(x.unidades)::int as unidades
      from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid, unidades int) group by 1, 2
  ), prod as (
    select i.produto, sum(i.unidades)::numeric as u from itens i group by 1
  ), base as (
    -- 23/11: units that take the base, grouped by the yield they are made with (a flavour's own
    -- yield, else the product's). Without per-flavour data there is one group per product holding
    -- all its units, so the expression below is the 22/11 one, digit for digit.
    select i.produto, coalesce(v.batch_yield, p.batch_yield) as y, sum(i.unidades)::numeric as u
      from itens i join public.products p on p.id = i.produto
      left join public.product_variants v on v.id = i.sabor
     where p.recipe_mode <> 'per_unit' and (i.sabor is null or v.usa_base)
     group by 1, 2
  ), receita as (
    select r.ingredient_id, b.u / b.y * r.quantity as q
      from base b
      join public.product_recipes r on r.product_id = b.produto and r.variant_id is null and r.quantity > 0
     where b.y > 0
    union all
    select r.ingredient_id, i.unidades / coalesce(v.batch_yield, p.batch_yield) * r.quantity
      from itens i join public.products p on p.id = i.produto
      join public.product_variants v on v.id = i.sabor
      join public.product_recipes r on r.variant_id = i.sabor and r.quantity > 0
     where p.recipe_mode <> 'per_unit' and coalesce(v.batch_yield, p.batch_yield) > 0
  ), rec as (
    select ingredient_id, trim_scale(round(sum(q), 6)) as q from receita group by 1
  ), ovr as (
    select x.ingrediente, x.quantidade from jsonb_to_recordset(v_ovr) as x(ingrediente uuid, quantidade numeric)
  ), cons as (
    select coalesce(rec.ingredient_id, ovr.ingrediente) as id, coalesce(rec.q, 0) as receita, coalesce(ovr.quantidade, rec.q) as real
      from rec full join ovr on ovr.ingrediente = rec.ingredient_id
  )
  select jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('produto', i.produto, 'sabor', i.sabor, 'unidades', i.unidades,
                       'produto_nome', p.name, 'sabor_nome', v.name) order by p.name, v.posicao, v.name), '[]')
                from itens i join public.products p on p.id = i.produto left join public.product_variants v on v.id = i.sabor),
    'consumo', (select coalesce(jsonb_agg(jsonb_build_object('ingrediente', c.id, 'nome', g.name, 'unidade', g.unit,
                       'receita', c.receita, 'real', c.real, 'custo', g.cost_per_unit) order by g.name), '[]')
                  from cons c join public.ingredients g on g.id = c.id and g.user_id = p_user
                 where c.real > 0 or c.receita > 0),
    'avisos', (select coalesce(jsonb_agg(distinct a.txt), '[]') from (
                 select p.name || ': baixa os ingredientes na venda, não na produção.' as txt
                   from prod pr join public.products p on p.id = pr.produto
                  where p.recipe_mode = 'per_unit' and exists (select 1 from public.product_recipes r where r.product_id = p.id and r.quantity > 0)
                 ) a))
    into v_res;

  -- typed consumption: floor and justification
  select coalesce(jsonb_agg(jsonb_build_object('ingrediente', c->'ingrediente', 'nome', c->>'nome', 'unidade', c->>'unidade',
                  'receita', (c->>'receita')::numeric, 'real', (c->>'real')::numeric) order by c->>'nome'), '[]'),
         array_agg(format('%s (receita %s %s, mínimo %s %s, informado %s %s)', c->>'nome',
                  public.producao_num((c->>'receita')::numeric), c->>'unidade',
                  public.producao_num((c->>'receita')::numeric * (1 - public.producao_reducao_maxima())), c->>'unidade',
                  public.producao_num((c->>'real')::numeric), c->>'unidade') order by c->>'nome')
           filter (where (c->>'real')::numeric < (c->>'receita')::numeric * (1 - public.producao_reducao_maxima()))
    into v_ajustes, v_abaixo
    from jsonb_array_elements(v_res->'consumo') c
   where (c->>'real')::numeric <> (c->>'receita')::numeric;
  if array_length(v_abaixo, 1) > 0 then
    raise exception 'Consumo abaixo do mínimo da receita: %. Se a receita mudou, corrija a ficha do produto.', array_to_string(v_abaixo, '; ')
      using hint = 'VANT_CONSUMO_ABAIXO_DO_MINIMO';
  end if;
  if jsonb_array_length(v_ajustes) > 0 and (p_justificativa is null or char_length(trim(p_justificativa)) < 5 or char_length(p_justificativa) > 300) then
    raise exception 'O consumo informado é diferente da receita. Explique o motivo (5 a 300 letras).' using hint = 'VANT_JUSTIFICATIVA_OBRIGATORIA';
  end if;

  -- recipe reduced since the product's previous production (new flow): allowed, but explained once
  with prods as (select distinct (i->>'produto')::uuid as produto from jsonb_array_elements(v_res->'itens') i)
  select coalesce(jsonb_object_agg(x.produto, (select max(a.id) from public.receita_alteracoes a where a.product_id = x.produto)), '{}')
    into v_versoes from prods x;
  with prods as (select distinct (i->>'produto')::uuid as produto from jsonb_array_elements(v_res->'itens') i)
  select string_agg(p.name, ', ' order by p.name) into v_txt
    from prods x join public.products p on p.id = x.produto
   where exists (
     select 1 from public.receita_alteracoes a
      where a.product_id = x.produto and a.reduz
        and a.em > coalesce((select max(e.criado_em) from public.producao_eventos e
                               join public.producao_itens pi on pi.evento_id = e.id
                              where e.user_id = p_user and pi.product_id = x.produto), '-infinity'));
  if v_txt is not null and (p_justificativa is null or char_length(trim(p_justificativa)) < 5 or char_length(p_justificativa) > 300) then
    raise exception 'A receita de % foi alterada para gastar menos desde a última produção. Explique o motivo (5 a 300 letras).', v_txt
      using hint = 'VANT_RECEITA_REDUZIDA';
  end if;

  return v_res || jsonb_build_object('ajustes', v_ajustes, 'ajustado', jsonb_array_length(v_ajustes) > 0,
    'receita_reduzida', v_txt is not null, 'receita_versoes', v_versoes,
    'justificativa', case when jsonb_array_length(v_ajustes) > 0 or v_txt is not null then trim(p_justificativa) end);
end $$;

-- ------------------------------------------------------------------ 4) saving a flavour's yield / usa_base
do $$
declare d text := pg_get_functiondef('public.produto_sabores_salvar(uuid,jsonb)'::regprocedure); n text;
begin
  if position('20261123120000' in d) > 0 then raise exception 'produto_sabores_salvar já alterada por esta migration'; end if;
  n := pg_temp.rps_trocar(d, 'v_aprender boolean;', 'v_aprender boolean; v_rende numeric; v_usa_base boolean; v_por_unidade boolean; -- 20261123120000');
  n := pg_temp.rps_trocar(n,
    $t$then raise exception 'produto não é seu'; end if;
$t$,
    $t$then raise exception 'produto não é seu'; end if;
  v_por_unidade := exists (select 1 from public.products p where p.id = p_produto and p.recipe_mode = 'per_unit'); -- 20261123120000
$t$);
  n := pg_temp.rps_trocar(n,
    $t$    v_emoji := left(coalesce(nullif(trim(s->>'emoji'), ''), '🥤'), 8);
$t$,
    $t$    v_emoji := left(coalesce(nullif(trim(s->>'emoji'), ''), '🥤'), 8);
    -- 20261123120000 <<  optional yield of the flavour and whether it takes the base (absent = keep)
    v_rende := null; v_usa_base := true;
    if s ? 'rende' and jsonb_typeof(s->'rende') <> 'null' then
      if jsonb_typeof(s->'rende') <> 'number' or (s->>'rende')::numeric <= 0 or (s->>'rende')::numeric > 1000000 then
        raise exception 'Rendimento do sabor % inválido: use um número maior que zero.', v_nome using hint = 'VANT_SABOR_RENDE_INVALIDO';
      end if;
      v_rende := (s->>'rende')::numeric;
    end if;
    if s ? 'usa_base' then
      if jsonb_typeof(s->'usa_base') <> 'boolean' then
        raise exception 'Informe se o sabor % usa a receita base.', v_nome using hint = 'VANT_SABOR_USA_BASE_INVALIDO';
      end if;
      v_usa_base := (s->>'usa_base')::boolean;
    end if;
    if v_por_unidade and (v_rende is not null or not v_usa_base) then
      raise exception 'Produto com receita por unidade não tem rendimento nem receita própria por sabor.' using hint = 'VANT_SABOR_POR_UNIDADE';
    end if;
    -- 20261123120000 >>
$t$);
  n := pg_temp.rps_trocar(n,
    $t$insert into public.product_variants (user_id, product_id, name, emoji, posicao)
      values (u, p_produto, v_nome, v_emoji, v_pos) returning id into v_vid;$t$,
    $t$insert into public.product_variants (user_id, product_id, name, emoji, posicao, batch_yield, usa_base)
      values (u, p_produto, v_nome, v_emoji, v_pos, v_rende, v_usa_base) returning id into v_vid;$t$);
  n := pg_temp.rps_trocar(n,
    $t$posicao = v_pos, updated_at = now() where id = v_vid;$t$,
    $t$posicao = v_pos, batch_yield = case when s ? 'rende' then v_rende else batch_yield end, usa_base = case when s ? 'usa_base' then v_usa_base else usa_base end, updated_at = now() where id = v_vid;$t$);
  execute n;
end $$;

-- ------------------------------------------------------------------ 5) old paths: refuse per-flavour products only
do $$
declare f text; d text;
begin
  foreach f in array array['public.produto_produzir(uuid,numeric)', 'public.produto_produzir_sabores(uuid,jsonb)', 'public.produto_sabores_distribuir(uuid,jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('20261123120000' in d) > 0 then raise exception '% já alterada por esta migration', f; end if;
    execute pg_temp.rps_trocar(d,
      $t$  if not found then raise exception 'produto não é seu'; end if;
$t$,
      $t$  if not found then raise exception 'produto não é seu'; end if;
  if public.produto_receita_por_sabor(p_produto) then raise exception 'Este produto tem rendimento ou receita própria por sabor. Registre a produção pela tela nova.' using hint = 'VANT_RECEITA_POR_SABOR'; end if; -- 20261123120000
$t$);
  end loop;
end $$;

-- ------------------------------------------------------------------ 6) recipe log
create or replace function public.receita_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ctx text; v_user uuid; v_reduz boolean; v_op text; v_antes numeric; v_depois numeric;
begin
  -- wiping a whole account is not a recipe change
  get diagnostics v_ctx = pg_context;
  if v_ctx ~ '(apagar_dados_do_usuario|conta_teste_zerar)' then return null; end if;

  if tg_table_name = 'product_recipes' then
    v_user := coalesce(new.user_id, old.user_id);
    if not exists (select 1 from auth.users a where a.id = v_user) then return null; end if;
    if tg_op = 'INSERT' then
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, new.product_id, new.variant_id, new.ingredient_id, 'ingrediente', 'incluiu', null, new.quantity::text, false, auth.uid());
    elsif tg_op = 'DELETE' then
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, old.product_id, old.variant_id, old.ingredient_id, 'ingrediente', 'removeu', old.quantity::text, null, old.quantity > 0, auth.uid());
    elsif row(new.product_id, new.variant_id, new.ingredient_id, new.quantity) is distinct from row(old.product_id, old.variant_id, old.ingredient_id, old.quantity) then
      -- moving the row to another ingredient/flavour/product = removing it from where it was
      v_reduz := new.quantity < old.quantity or new.ingredient_id <> old.ingredient_id
              or new.product_id <> old.product_id or new.variant_id is distinct from old.variant_id;
      insert into public.receita_alteracoes (user_id, product_id, variant_id, ingredient_id, campo, operacao, antes, depois, reduz, por)
      values (v_user, old.product_id, old.variant_id, old.ingredient_id, 'ingrediente', 'alterou', old.quantity::text,
              case when new.ingredient_id = old.ingredient_id and new.product_id = old.product_id and new.variant_id is not distinct from old.variant_id
                   then new.quantity::text else format('%s em %s/%s/%s', new.quantity, new.product_id, coalesce(new.variant_id::text, '-'), new.ingredient_id) end,
              v_reduz, auth.uid());
    end if;
    return null;
  end if;

  -- 23/11: a flavour's own yield and whether it uses the base (trigger on product_variants)
  if tg_table_name = 'product_variants' then
    if not exists (select 1 from auth.users a where a.id = new.user_id) then return null; end if;
    if tg_op = 'INSERT' then
      -- a new flavour: nothing was produced with it yet; its recipe rows log themselves
      if new.batch_yield is not null then
        insert into public.receita_alteracoes (user_id, product_id, variant_id, campo, operacao, antes, depois, reduz, por)
        values (new.user_id, new.product_id, new.id, 'rendimento', 'incluiu', null, new.batch_yield::text, false, auth.uid());
      end if;
      if not new.usa_base then
        insert into public.receita_alteracoes (user_id, product_id, variant_id, campo, operacao, antes, depois, reduz, por)
        values (new.user_id, new.product_id, new.id, 'modo', 'incluiu', null, 'receita_propria', false, auth.uid());
      end if;
      return null;
    end if;
    if new.batch_yield is distinct from old.batch_yield then
      -- compared as the yield actually used: the flavour's own, else the product's
      select coalesce(old.batch_yield, p.batch_yield, 0), coalesce(new.batch_yield, p.batch_yield, 0)
        into v_antes, v_depois from public.products p where p.id = new.product_id;
      v_reduz := v_depois > 0 and (v_antes <= 0 or v_depois > v_antes);
      insert into public.receita_alteracoes (user_id, product_id, variant_id, campo, operacao, antes, depois, reduz, por)
      values (new.user_id, new.product_id, new.id, 'rendimento', 'alterou', old.batch_yield::text, new.batch_yield::text, v_reduz, auth.uid());
    end if;
    if new.usa_base is distinct from old.usa_base then
      -- leaving the base = this flavour stops taking the base ingredients
      insert into public.receita_alteracoes (user_id, product_id, variant_id, campo, operacao, antes, depois, reduz, por)
      values (new.user_id, new.product_id, new.id, 'modo', 'alterou',
              case when old.usa_base then 'usa_base' else 'receita_propria' end,
              case when new.usa_base then 'usa_base' else 'receita_propria' end,
              old.usa_base and not new.usa_base, auth.uid());
    end if;
    return null;
  end if;

  -- products: only yield and mode (the trigger's WHEN already filtered other columns)
  if not exists (select 1 from auth.users a where a.id = new.user_id) then return null; end if;
  if new.batch_yield is distinct from old.batch_yield then
    -- more units from the same batch = less of each ingredient per unit (also a first yield set
    -- on a recipe that had none: production was blocked before, and now consumes per this yield)
    v_reduz := coalesce(new.batch_yield, 0) > 0 and (coalesce(old.batch_yield, 0) <= 0 or new.batch_yield > old.batch_yield);
    insert into public.receita_alteracoes (user_id, product_id, campo, operacao, antes, depois, reduz, por)
    values (new.user_id, new.id, 'rendimento', 'alterou', old.batch_yield::text, new.batch_yield::text, v_reduz, auth.uid());
  end if;
  if new.recipe_mode is distinct from old.recipe_mode then
    -- leaving 'batch' = production stops taking ingredients
    v_reduz := old.recipe_mode = 'batch';
    insert into public.receita_alteracoes (user_id, product_id, campo, operacao, antes, depois, reduz, por)
    values (new.user_id, new.id, 'modo', 'alterou', old.recipe_mode, new.recipe_mode, v_reduz, auth.uid());
  end if;
  return null;
end $$;
create trigger receita_alteracoes_registrar
  after insert or update of batch_yield, usa_base on public.product_variants
  for each row execute function public.receita_registrar();
