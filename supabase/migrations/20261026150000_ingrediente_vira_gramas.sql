-- ============================================================
-- INGREDIENTE QUE PASSA DE "UNIDADE" PRA GRAMAS/ML (Rick, 26/10/2026)
-- Nutella (pote de 650 g por R$ 55) e maracujá (1 kg) foram comprados como "1 un".
-- Na receita ele usa 30 g de Nutella e 200 g de maracujá por leva. Ao trocar a
-- unidade pra g/kg/ml/l com o tamanho da compra (pacote), o estoque e o custo
-- continuavam contados em POTES: 2 potes viravam "2 g" e o grama custava R$ 50.
-- Agora, quando um ingrediente sai de 'un' pra uma medida, o estoque e o custo são
-- convertidos pelo tamanho da compra: 2 potes × 650 g = 1.300 g; R$ 50,73 ÷ 650 = R$ 0,078/g.
-- Mesma medida com pacote diferente (g → g): não converte (grama continua grama).
-- Nada é apagado.
-- ============================================================
create or replace function public.ingredientes_definir_compra(p_itens jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  u uuid := auth.uid();
  it jsonb;
  v_un text; v_pac numeric; v_n integer := 0; v_k integer;
  r record;
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 40 then
    raise exception 'itens invalidos';
  end if;
  for it in select value from jsonb_array_elements(p_itens) loop
    v_un := lower(coalesce(it->>'unidade', 'un'));
    if v_un not in ('un', 'g', 'kg', 'ml', 'l') then v_un := 'un'; end if;
    v_pac := coalesce(nullif(it->>'pacote', '')::numeric, 1);
    if v_pac <= 0 or v_pac > 1000000 then v_pac := 1; end if;
    for r in select i.id, lower(coalesce(i.unit, 'un')) as unit, greatest(coalesce(i.pacote_qtd, 1), 1) as pac
               from public.ingredients i
              where i.user_id = u and lower(trim(i.name)) = lower(trim(coalesce(it->>'nome', '')))
              for update loop
      if r.unit = 'un' and v_un <> 'un' and v_pac > 1 then
        -- estoque e custo estavam em embalagens: passa pra medida (g, ml…)
        update public.ingredients
           set unit = v_un, pacote_qtd = v_pac,
               stock_quantity = round(coalesce(stock_quantity, 0) / r.pac * v_pac, 3),
               cost_per_unit = round(coalesce(cost_per_unit, 0) * r.pac / v_pac, 6),
               updated_at = now()
         where id = r.id;
        perform public.recalc_custo_produtos_do_ingrediente(r.id);
      else
        update public.ingredients set unit = v_un, pacote_qtd = v_pac, updated_at = now() where id = r.id;
      end if;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $function$;
