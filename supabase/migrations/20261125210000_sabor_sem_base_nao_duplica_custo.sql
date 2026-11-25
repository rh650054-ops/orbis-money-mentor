-- 25/11/2026 (Rick): the cost shown for a flavour that does NOT use the base recipe (usa_base = false)
-- added the product's base cost to the flavour's own full recipe — a flavour like that was shown at
-- about twice its real cost. Now: its own recipe ÷ its yield + the product's costs without stock.
-- Flavours that use the base keep exactly the previous formula. Display only: sales keep using
-- products.cost. Applied in production on 25/11 together with a one-off data correction of one
-- account (labour moved to costs without stock, packaging per bottle), authorized by the owner and
-- backed up in public.backup_20261125_estoque (not reproduced here: account data).
create or replace function public.produto_sabores(p_produto uuid)
returns table(id uuid, nome text, emoji text, estoque integer, custo numeric, extras jsonb)
language sql stable security definer set search_path to 'public' as $function$
  select v.id, v.name, v.emoji, v.stock_quantity,
    round(case when coalesce(v.usa_base, true)
               then coalesce(p.cost, 0) + coalesce(lin.custo, 0) / greatest(coalesce(p.batch_yield, 0), 1)
               else coalesce(lin.custo, 0) / greatest(coalesce(v.batch_yield, p.batch_yield, 0), 1)
                    + public.custo_extra_por_unidade(p.custos_extras, coalesce(v.batch_yield, p.batch_yield)) end, 2),
    coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.name, 'qtd', r.quantity, 'preco', coalesce(i.cost_per_unit, 0),
        'unidade', coalesce(i.unit, 'un'), 'pacote', coalesce(i.pacote_qtd, 1), 'estoque', coalesce(i.stock_quantity, 0), 'aprender', r.aprender) order by r.created_at)
      from public.product_recipes r join public.ingredients i on i.id = r.ingredient_id where r.variant_id = v.id), '[]'::jsonb)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join lateral (select sum(r.quantity * coalesce(i.cost_per_unit, 0)) as custo
                       from public.product_recipes r join public.ingredients i on i.id = r.ingredient_id
                      where r.variant_id = v.id) lin on true
  where v.product_id = p_produto and v.user_id = auth.uid()
  order by v.posicao, v.created_at;
$function$;
