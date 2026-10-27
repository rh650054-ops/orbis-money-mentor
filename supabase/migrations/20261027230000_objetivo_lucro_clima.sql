-- Profit challenge v6 (Rick, 27/10/2026): weather in the plan. How much a rainy day costs
-- THIS seller: average units on days with ≥ 2 mm of rain vs dry days, from clima_dia (the
-- weather the app recorded for him each day) joined with his DEFCON sales of the last 90 days.
-- The app uses the factor to move the mission's units away from rainy days in the forecast.

create or replace function public.objetivo_lucro_clima()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with preco as (
    select avg(nullif(sale_price, 0)) p from products where user_id = auth.uid() and coalesce(is_active, true)
  ), v as (
    select (created_at at time zone 'America/Sao_Paulo')::date d,
           sum(public.vant_unid_inferida(amount, qty, product_id is not null, (select p from preco))) u
    from defcon_sales
    where user_id = auth.uid() and method <> 'gorjeta' and not coalesce(late, false)
      and created_at >= now() - interval '90 days'
    group by 1
  ), j as (
    select v.u, coalesce(c.chuva_mm, 0) >= 2 as chuva
    from v join clima_dia c on c.user_id = auth.uid() and c.data = v.d
  )
  select jsonb_build_object(
    'dias_chuva', count(*) filter (where chuva),
    'dias_seco', count(*) filter (where not chuva),
    'unid_chuva', round(avg(u) filter (where chuva), 1),
    'unid_seco', round(avg(u) filter (where not chuva), 1),
    -- Only trust his own factor with 3+ days on each side; otherwise a conservative 0.7.
    'fator', case when count(*) filter (where chuva) >= 3 and count(*) filter (where not chuva) >= 3
                       and avg(u) filter (where not chuva) > 0
                  then round(least(1, greatest(0.2, avg(u) filter (where chuva) / avg(u) filter (where not chuva))), 2)
                  else 0.7 end,
    'proprio', count(*) filter (where chuva) >= 3 and count(*) filter (where not chuva) >= 3
  )
  from j
  where auth.uid() is not null;
$$;

revoke all on function public.objetivo_lucro_clima() from public, anon;
grant execute on function public.objetivo_lucro_clima() to authenticated;
