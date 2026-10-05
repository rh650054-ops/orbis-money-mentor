-- ============================================================
-- CUSTO DO PRODUTO PELAS NOTAS FISCAIS — 05/10/2026
-- Pedido do Rick: "tiro foto da nota do Atacadão, falo que vou fazer 100 batidas com
-- essa mercadoria, mostro a nota do outro lugar também… e no final você me passa o
-- custo certinho do produto, com base em tudo que eu gastei."
--
-- O app lê as notas (edge function nota-ler), ele marca o que foi mercadoria e diz
-- como pagou cada uma (dinheiro, cartão, Pix ou dividido). Aqui:
--   1) cria o produto se for novo;
--   2) grava UMA compra em compras_mercadoria por nota e por forma de pagamento — o
--      trigger que já existe (aplicar_compra_mercadoria) atualiza o custo do produto,
--      soma o estoque e lança o valor no custo do dia (sai do lucro);
--      a quantidade de cada linha é proporcional ao valor, então o custo por unidade
--      fica exatamente total ÷ rendimento;
--   3) acha no extrato do banco a saída do cartão/Pix com o mesmo valor (até 2 dias
--      depois da nota) e marca como Mercadoria, travada — o Raio-X e o rastreador
--      param de contar como "mercado" e não contam duas vezes.
-- Security invoker: tudo roda com o login do próprio vendedor (RLS).
-- ============================================================

create or replace function public.custo_notas_salvar(
  p_product_id uuid, p_nome text, p_rendimento numeric, p_notas jsonb
) returns jsonb language plpgsql security invoker set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_prod uuid := p_product_id;
  v_total numeric := 0;
  v_nota jsonb; v_parte jsonb;
  v_valor numeric; v_banco numeric; v_tipo text; v_data date; v_loja text;
  v_conc int := 0; v_n int := 0; v_tx uuid;
  v_custo numeric;
begin
  if v_uid is null then raise exception 'login necessario'; end if;
  if p_rendimento is null or p_rendimento <= 0 or p_rendimento > 1000000 then raise exception 'rendimento invalido'; end if;
  if jsonb_typeof(p_notas) <> 'array' or jsonb_array_length(p_notas) = 0 then raise exception 'sem notas'; end if;
  if jsonb_array_length(p_notas) > 20 then raise exception 'notas demais'; end if;

  select coalesce(sum((pt->>'valor')::numeric), 0) into v_total
    from jsonb_array_elements(p_notas) n, jsonb_array_elements(n->'partes') pt
   where (pt->>'valor')::numeric > 0;
  if v_total <= 0 or v_total > 1000000 then raise exception 'total invalido'; end if;

  if v_prod is null then
    if coalesce(trim(p_nome), '') = '' then raise exception 'produto sem nome'; end if;
    insert into public.products (user_id, name, cost, sale_price, stock_quantity, is_active)
    values (v_uid, left(trim(p_nome), 80), 0, 0, 0, true)
    returning id into v_prod;
  elsif not exists (select 1 from public.products where id = v_prod and user_id = v_uid) then
    raise exception 'produto nao encontrado';
  end if;

  for v_nota in select * from jsonb_array_elements(p_notas) loop
    v_loja := left(coalesce(nullif(trim(v_nota->>'loja'), ''), 'Nota fiscal'), 60);
    v_data := case when (v_nota->>'data') ~ '^\d{4}-\d{2}-\d{2}$' then (v_nota->>'data')::date
                   else (now() at time zone 'America/Sao_Paulo')::date end;
    for v_parte in select * from jsonb_array_elements(v_nota->'partes') loop
      v_valor := round((v_parte->>'valor')::numeric, 2);
      v_tipo := coalesce(v_parte->>'tipo', 'outro');
      -- valor que aparece no banco (a nota inteira no cartão, mesmo se parte dos itens
      -- não era mercadoria); sem isso, usa o próprio valor
      v_banco := round(coalesce((v_parte->>'valor_banco')::numeric, v_valor), 2);
      continue when v_valor is null or v_valor <= 0;
      insert into public.compras_mercadoria
        (user_id, item_tipo, product_id, quantidade, total_pago, fornecedor, data, notas, lancar_custo_dia)
      values (v_uid, 'produto', v_prod, round(p_rendimento * v_valor / v_total, 4), v_valor,
              v_loja, v_data,
              'Nota fiscal · ' || case v_tipo when 'dinheiro' then 'dinheiro' when 'pix' then 'Pix' else 'cartão' end, true);
      v_n := v_n + 1;

      -- o que saiu do banco (cartão/Pix) vira Mercadoria no extrato, travado
      if v_tipo <> 'dinheiro' then
        select l.id into v_tx from public.extrato_lancamentos l
         where l.user_id = v_uid and l.tipo = 'saida' and l.valor = v_banco
           and l.data between v_data and v_data + 2
           and l.categoria <> 'mercadoria' and l.movimento = 'normal'
         order by abs(l.data - v_data), l.data limit 1;
        if v_tx is not null then
          perform set_config('vant.mover', '1', true);
          update public.extrato_lancamentos
             set categoria = 'mercadoria', esfera = 'corre', confianca = 'usuario', categoria_fixa = true
           where id = v_tx and user_id = v_uid;
          perform set_config('vant.mover', '0', true);
          v_conc := v_conc + 1;
          v_tx := null;
        end if;
      end if;
    end loop;
  end loop;

  select cost into v_custo from public.products where id = v_prod;
  return jsonb_build_object(
    'product_id', v_prod,
    'total', v_total,
    'rendimento', p_rendimento,
    'custo_unidade', round(v_total / p_rendimento, 2),
    'custo_produto', v_custo,
    'compras', v_n,
    'conciliados', v_conc
  );
end $$;

grant execute on function public.custo_notas_salvar(uuid, text, numeric, jsonb) to authenticated;
