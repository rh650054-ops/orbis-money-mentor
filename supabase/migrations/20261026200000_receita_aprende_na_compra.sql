-- ============================================================
-- A RECEITA APRENDE NA COMPRA (Rick, 26/10/2026)
-- "Eu uso polpa, não sei se são 200 g. Quando eu comprar 5 kg de maracujá pra fazer
--  100 batidas, o app descobre quanto vai em cada uma."
-- • product_recipes.aprender = true: ingrediente sem quantidade (quantity 0) até a 1ª compra.
--   Quem conta levas (Tô no mercado, Produzi) já ignora quantity 0, então ele não trava nada.
-- • mercado_aprender(compra, produto, unidades): pra cada item da compra que é ingrediente
--   do produto com aprender = true → quantidade por leva = comprado ÷ (unidades ÷ rende),
--   aprender vira false e o custo do produto é recalculado. Devolve o que aprendeu.
-- Nada é apagado.
-- ============================================================
alter table public.product_recipes add column if not exists aprender boolean not null default false;

-- produto_salvar_receita: aceita item {"aprender": true} com qtd 0
do $$
declare d text := pg_get_functiondef('public.produto_salvar_receita(uuid,jsonb,numeric)'::regprocedure); n text;
begin
  if position('aprender' in d) > 0 then return; end if;
  n := replace(d,
    $x$    if v_nome = '' or v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000 then
      raise exception 'ingrediente invalido';
    end if;$x$,
    $x$    v_aprender := coalesce((it->>'aprender')::boolean, false);
    if v_aprender then v_qtd := 0; end if;
    if v_nome = '' or v_qtd is null or v_qtd < 0 or (v_qtd = 0 and not v_aprender) or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000 then
      raise exception 'ingrediente invalido';
    end if;$x$);
  n := replace(n, 'v_sem_custo int; v_custo numeric;', 'v_sem_custo int; v_custo numeric; v_aprender boolean;');
  n := replace(n,
    'insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (u, p_produto, v_id, v_qtd);',
    'insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, aprender) values (u, p_produto, v_id, v_qtd, v_aprender);');
  if n = d then raise exception 'produto_salvar_receita: trecho não encontrado'; end if;
  execute n;
end $$;

-- produto_sabores_salvar: mesma coisa nos extras do sabor
do $$
declare d text := pg_get_functiondef('public.produto_sabores_salvar(uuid,jsonb)'::regprocedure); n text;
begin
  if position('aprender' in d) > 0 then return; end if;
  n := replace(d,
    $x$        continue when v_inome = '' or v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000;$x$,
    $x$        v_aprender := coalesce((it->>'aprender')::boolean, false);
        if v_aprender then v_qtd := 0; end if;
        continue when v_inome = '' or v_qtd is null or v_qtd < 0 or (v_qtd = 0 and not v_aprender) or v_qtd > 100000 or v_preco < 0 or v_preco > 1000000;$x$);
  n := replace(n, 'v_iid uuid; v_inome text; v_qtd numeric; v_preco numeric;', 'v_iid uuid; v_inome text; v_qtd numeric; v_preco numeric; v_aprender boolean;');
  n := replace(n,
    'insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (u, p_produto, v_iid, v_qtd, v_vid);',
    'insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id, aprender) values (u, p_produto, v_iid, v_qtd, v_vid, v_aprender);');
  if n = d then raise exception 'produto_sabores_salvar: trecho não encontrado'; end if;
  execute n;
end $$;

-- produto_sabores: devolve aprender nos extras
do $$
declare d text := pg_get_functiondef('public.produto_sabores(uuid)'::regprocedure); n text;
begin
  if position('aprender' in d) > 0 then return; end if;
  n := replace(d, $x$'estoque', coalesce(i.stock_quantity, 0))$x$, $x$'estoque', coalesce(i.stock_quantity, 0), 'aprender', r.aprender)$x$);
  if n = d then raise exception 'produto_sabores: trecho não encontrado'; end if;
  execute n;
end $$;

create or replace function public.mercado_aprender(p_compra uuid, p_produto uuid, p_unidades numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
end $$;
revoke all on function public.mercado_aprender(uuid, uuid, numeric) from public, anon;
grant execute on function public.mercado_aprender(uuid, uuid, numeric) to authenticated;
