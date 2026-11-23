-- Rollback of 20261123120000_rendimento_por_sabor.sql (yield per flavour).
-- Puts back exactly what that migration changed and nothing else. Data is never deleted:
--   * refuses while any flavour has its own yield or no base (batch_yield / usa_base would be lost);
--   * refuses while an ingredient appears twice in one product (base + flavour, or two flavours):
--     the old UNIQUE (product_id, ingredient_id) could not come back without deleting recipe rows;
--   * rows the new trigger wrote to receita_alteracoes stay (history is append-only).
-- Run it BEFORE the Etapa 1 rollback (producao-integridade/rollback-etapa1.sql), never after.
-- A second run is harmless.
begin;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_variants' and column_name = 'usa_base') then
    if exists (select 1 from public.product_variants where batch_yield is not null or not usa_base) then
      raise exception 'Rollback recusado: há sabores com rendimento próprio ou sem a receita base. Volte esses sabores ao padrão (rendimento do produto, usa a base) antes, com autorização.';
    end if;
  end if;
  if exists (select 1 from public.product_recipes group by product_id, ingredient_id having count(*) > 1) then
    raise exception 'Rollback recusado: há ingrediente repetido no mesmo produto (base e sabor, ou dois sabores). A regra antiga não aceita isso; nada foi apagado.';
  end if;
end $$;

create or replace function pg_temp.rps_trocar(d text, velho text, novo text) returns text language plpgsql as $$
declare eol text := case when position(E'\r\n' in d) > 0 then E'\r\n' else E'\n' end; n int;
begin
  velho := replace(velho, E'\n', eol); novo := replace(novo, E'\n', eol);
  n := (length(d) - length(replace(d, velho, ''))) / length(velho);
  if n <> 1 then raise exception 'trecho encontrado % vezes (esperado 1): %', n, left(velho, 80); end if;
  return replace(d, velho, novo);
end $$;

-- old paths: remove the one guard line
do $$
declare f text; d text;
begin
  foreach f in array array['public.produto_produzir(uuid,numeric)', 'public.produto_produzir_sabores(uuid,jsonb)', 'public.produto_sabores_distribuir(uuid,jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    continue when position('20261123120000' in d) = 0;
    d := pg_temp.rps_trocar(d,
      $t$  if not found then raise exception 'produto não é seu'; end if;
  if public.produto_receita_por_sabor(p_produto) then raise exception 'Este produto tem rendimento ou receita própria por sabor. Registre a produção pela tela nova.' using hint = 'VANT_RECEITA_POR_SABOR'; end if; -- 20261123120000
$t$,
      $t$  if not found then raise exception 'produto não é seu'; end if;
$t$);
    if position('20261123120000' in d) > 0 then raise exception '% ainda tem trecho desta migration', f; end if;
    execute d;
  end loop;
end $$;

-- produto_sabores_salvar: the five edits, reversed
do $$
declare d text := pg_get_functiondef('public.produto_sabores_salvar(uuid,jsonb)'::regprocedure); n text;
begin
  if position('20261123120000' in d) = 0 then return; end if;
  n := pg_temp.rps_trocar(d,
    $t$posicao = v_pos, batch_yield = case when s ? 'rende' then v_rende else batch_yield end, usa_base = case when s ? 'usa_base' then v_usa_base else usa_base end, updated_at = now() where id = v_vid;$t$,
    $t$posicao = v_pos, updated_at = now() where id = v_vid;$t$);
  n := pg_temp.rps_trocar(n,
    $t$insert into public.product_variants (user_id, product_id, name, emoji, posicao, batch_yield, usa_base)
      values (u, p_produto, v_nome, v_emoji, v_pos, v_rende, v_usa_base) returning id into v_vid;$t$,
    $t$insert into public.product_variants (user_id, product_id, name, emoji, posicao)
      values (u, p_produto, v_nome, v_emoji, v_pos) returning id into v_vid;$t$);
  n := pg_temp.rps_trocar(n,
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
$t$,
    $t$    v_emoji := left(coalesce(nullif(trim(s->>'emoji'), ''), '🥤'), 8);
$t$);
  n := pg_temp.rps_trocar(n,
    $t$then raise exception 'produto não é seu'; end if;
  v_por_unidade := exists (select 1 from public.products p where p.id = p_produto and p.recipe_mode = 'per_unit'); -- 20261123120000
$t$,
    $t$then raise exception 'produto não é seu'; end if;
$t$);
  n := pg_temp.rps_trocar(n, 'v_aprender boolean; v_rende numeric; v_usa_base boolean; v_por_unidade boolean; -- 20261123120000', 'v_aprender boolean;');
  if position('20261123120000' in n) > 0 then raise exception 'produto_sabores_salvar ainda tem trecho desta migration'; end if;
  execute n;
end $$;
drop function if exists public.produto_receita_por_sabor(uuid);

-- recipe log: back to Etapa 1 (rows already written stay)
drop trigger if exists receita_alteracoes_registrar on public.product_variants;
create or replace function public.receita_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ctx text; v_user uuid; v_reduz boolean; v_op text;
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

-- new flow: back to the Etapa 1 consumption (product yield only)
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
  with itens as (select x.produto, x.sabor from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid)),
  sem as (
    select p.id, p.name,
           exists (select 1 from public.product_recipes r where r.product_id = p.id)
           or exists (select 1 from public.receita_alteracoes a where a.product_id = p.id and a.campo = 'ingrediente') as teve_receita
      from itens i join public.products p on p.id = i.produto
     where not exists (select 1 from public.product_recipes r where r.product_id = p.id and r.variant_id is null and r.quantity > 0)
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

  -- a recipe without a yield cannot be converted into ingredients: block instead of producing for free
  select string_agg(distinct p.name, ', ') into v_txt
    from jsonb_to_recordset(v_itens) as x(produto uuid) join public.products p on p.id = x.produto
   where p.recipe_mode <> 'per_unit' and coalesce(p.batch_yield, 0) <= 0
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
  ), receita as (
    select r.ingredient_id, pr.u / p.batch_yield * r.quantity as q
      from prod pr join public.products p on p.id = pr.produto
      join public.product_recipes r on r.product_id = p.id and r.variant_id is null and r.quantity > 0
     where p.recipe_mode <> 'per_unit' and p.batch_yield > 0
    union all
    select r.ingredient_id, i.unidades / p.batch_yield * r.quantity
      from itens i join public.products p on p.id = i.produto
      join public.product_recipes r on r.variant_id = i.sabor and r.quantity > 0
     where i.sabor is not null and p.recipe_mode <> 'per_unit' and p.batch_yield > 0
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

-- shared ingredients: back to one row per ingredient per product (guarded above)
drop index if exists public.product_recipes_base_ingrediente_key;
drop index if exists public.product_recipes_sabor_ingrediente_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.product_recipes'::regclass and conname = 'product_recipes_product_id_ingredient_id_key') then
    alter table public.product_recipes add constraint product_recipes_product_id_ingredient_id_key unique (product_id, ingredient_id);
  end if;
end $$;

-- columns (all null / true at this point: checked above)
alter table public.product_variants drop column if exists batch_yield, drop column if exists usa_base;
commit;
