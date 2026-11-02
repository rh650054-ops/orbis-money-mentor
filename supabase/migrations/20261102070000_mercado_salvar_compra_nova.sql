-- 02/11/2026 (Play Store user: "Não consegui concluir a compra" in Tô no mercado).
-- mercado_salvar read h.produto_id at the end even for a NEW purchase (p_editar null), when the
-- record h was never assigned → 'record "h" is not assigned yet' → the whole purchase rolled back.
-- PL/pgSQL evaluates every field of the condition, so the `p_editar is not null and ...` guard
-- did not help. Fix: only touch h inside an `if p_editar is not null` block. Nothing else changes.
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
  if p_editar is not null then
    if h.produto_id is not null and coalesce(h.unidades_previstas, 0) > 0 then
      update public.products p set cost = round(m.total / h.unidades_previstas, 2), updated_at = now()
        from public.mercado_compras m where m.id = p_editar and p.id = h.produto_id and p.user_id = u and m.total > 0;
    end if;
  end if;

  return r || jsonb_build_object('desconto', round(p_desconto, 2));
end $$;
revoke all on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) from public, anon;
grant execute on function public.mercado_salvar(jsonb, numeric, boolean, numeric, jsonb, uuid) to authenticated;
