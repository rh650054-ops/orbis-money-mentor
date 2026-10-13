-- ============================================================
-- "TÔ NO MERCADO" — 13/10/2026 (decisões do Rick, 12/10)
--
-- No mercado o vendedor anota o que está comprando ("57 leite condensado").
-- Ao concluir, numa transação só (mercado_concluir):
--   1) grava o cabeçalho da compra (mercado_compras);
--   2) cada linha COM VALOR vira uma compra em compras_mercadoria — o gatilho
--      que já existe (aplicar_compra_mercadoria) soma o estoque, recalcula o
--      custo médio e, para ingrediente, o custo dos produtos da receita.
--      Linha SEM valor só soma o estoque direto: não vira "gasto" inventado no
--      rastreador e não puxa o custo médio para zero;
--   3) "sobe na hora": o ingrediente comprado vira produto pronto. Para cada
--      produto em lote (recipe_mode='batch'), receitas = o que dá pra fechar
--      com a parte da compra destinada a ele + o que já tinha no estoque de
--      ingredientes. Consome os ingredientes, soma as unidades no produto e
--      registra o lote em production_batches.
-- Também corrige recalc_custo_produtos_do_ingrediente: em produto de lote o
-- custo da receita é do lote inteiro; o custo do produto é por unidade
-- (÷ batch_yield).
-- Colunas conta/banco de mercado_compras ficam para o Open Finance.
-- Idempotente, sem comandos de apagar dados.
-- ============================================================

create table if not exists public.mercado_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  total numeric not null default 0,
  por_item boolean not null default true,
  criada_em timestamptz not null default now(),
  conta_id uuid null,
  banco_transacao_id text null,
  total_banco numeric null,
  conferida_em timestamptz null
);

create index if not exists mercado_compras_user_idx on public.mercado_compras (user_id, criada_em desc);

alter table public.mercado_compras enable row level security;

do $$ begin
  create policy "mercado_compras_select_own" on public.mercado_compras for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "mercado_compras_insert_own" on public.mercado_compras for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "mercado_compras_update_own" on public.mercado_compras for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "mercado_compras_delete_own" on public.mercado_compras for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

alter table public.compras_mercadoria
  add column if not exists mercado_compra_id uuid references public.mercado_compras (id) on delete set null;

create index if not exists compras_mercadoria_mercado_compra_idx
  on public.compras_mercadoria (mercado_compra_id) where mercado_compra_id is not null;

-- ------------------------------------------------------------
-- Custo do produto a partir dos ingredientes: em lote, divide pelo rendimento.
-- ------------------------------------------------------------
create or replace function public.recalc_custo_produtos_do_ingrediente(p_ingredient_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dono uuid;
begin
  select i.user_id into v_dono from public.ingredients i where i.id = p_ingredient_id;
  if v_dono is null then return; end if;
  if not (auth.uid() is null or auth.uid() = v_dono
          or auth.role() = 'service_role' or public.is_orbis_admin()) then
    raise exception 'sem permissao';
  end if;

  update public.products p
     set cost = case when p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0
                     then round(sub.custo / p.batch_yield, 2)
                     else round(sub.custo, 2) end,
         updated_at = now()
    from (select r.product_id,
                 sum(r.quantity * coalesce(i.cost_per_unit, 0))::numeric as custo
            from public.product_recipes r
            join public.ingredients i on i.id = r.ingredient_id
           where r.product_id in (select r2.product_id from public.product_recipes r2
                                   where r2.ingredient_id = p_ingredient_id)
           group by r.product_id) sub
   where p.id = sub.product_id and p.user_id = v_dono;
end $$;

-- ------------------------------------------------------------
-- mercado_concluir(itens, total, por_item)
--   itens: [{ tipo: 'ingrediente'|'produto'|'novo', id, nome, qtd, preco_unit, para: [product ids] }]
--   A mesma conta roda no app (src/features/produtos/lib/mercado.ts) para a prévia.
-- ------------------------------------------------------------
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
  v_aloc jsonb := '{}';   -- "ingrediente:produto" -> quantidade destinada
  v_pool jsonb := '{}';   -- ingrediente -> estoque que já existia antes da compra
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

  -- (0) valida e normaliza as linhas ------------------------------------------
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

    -- ingrediente de UMA receita em lote só: vai pra ela mesmo sem escolher
    -- (item digitado à mão nunca entra em receita, igual à prévia do app)
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

  -- (1) quanto cada linha custou ----------------------------------------------
  -- 0 = sem valor (só soma estoque, não mexe no custo médio)
  if p_por_item then
    for k in 1..n loop
      if coalesce(l_preco[k], 0) > 0 then
        l_total[k] := round(l_qtd[k] * l_preco[k], 2);
        v_header := v_header + l_total[k];
      end if;
    end loop;
  elsif coalesce(p_total, 0) > 0 then
    -- "só o total": reparte pelo peso qtd × custo atual (sem custo nenhum: pela qtd)
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

  -- (2) produtos que vão receber a conversão, na ordem em que aparecem --------
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

  -- estoque de ingrediente que já existia (linhas + ingredientes das receitas)
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

  -- (3) cabeçalho + uma compra por linha --------------------------------------
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

  -- (4) "sobe na hora": ingrediente vira produto pronto -----------------------
  foreach v_pid in array v_cands::text[] loop
    select p.id, p.name, p.batch_yield into v_prod
      from public.products p
     where p.id = v_pid::uuid and p.user_id = u
       and p.recipe_mode = 'batch' and coalesce(p.batch_yield, 0) > 0;
    continue when not found;

    v_receitas := null;
    for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr
              where rr.product_id = v_prod.id and rr.quantity > 0 loop
      v_disp := coalesce((v_aloc->>(r.ingredient_id::text || ':' || v_pid))::numeric, 0)
              + coalesce((v_pool->>r.ingredient_id::text)::numeric, 0);
      v_x := floor(v_disp / r.quantity + 0.000000001);
      v_receitas := least(coalesce(v_receitas, v_x), v_x);
    end loop;
    v_receitas := greatest(coalesce(v_receitas, 0), 0);
    v_unid := round(v_receitas * v_prod.batch_yield);

    if v_receitas > 0 then
      for r in select rr.ingredient_id, rr.quantity from public.product_recipes rr
                where rr.product_id = v_prod.id and rr.quantity > 0 loop
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
end $$;

revoke all on function public.mercado_concluir(jsonb, numeric, boolean) from public, anon;
grant execute on function public.mercado_concluir(jsonb, numeric, boolean) to authenticated;
