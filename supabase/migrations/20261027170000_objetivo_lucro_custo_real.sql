-- Profit challenge v3 (Rick, 27/10/2026): cost per unit is the recipe cost (which already
-- includes production) plus the average calote lost per unit sold. The bank's outflow
-- per unit stays as a reference only: 60 days of "mercadoria" include stock bought and
-- not yet sold, so it overstates the cost. Also ships the seller's nickname so the AI
-- speaks to him by name.

create or replace function public.objetivo_lucro_base(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - 59;
  v_unid numeric; v_valor numeric; v_dias int; v_recorde numeric; v_recorde_dia date;
  v_primeira date; v_janela int;
  v_custo_receita numeric; v_preco numeric; v_estoque numeric; v_nome text; v_apelido text;
  v_saidas numeric; v_banco boolean; v_pessoal numeric; v_entradas_corre numeric;
  v_ticket numeric; v_custo numeric; v_fonte text; v_calote_unid_medio numeric;
  v_calote numeric; v_calote_unid int; v_calote_dias int; v_recuperado numeric;
  v_transporte numeric; v_comida numeric;
  v_cats jsonb; v_semana jsonb; v_produtos jsonb; v_quinzenas jsonb;
begin
  with vd as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d, coalesce(qty, 1) as q, amount
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
  ), dia as (select d, sum(q) as u from vd group by d)
  select coalesce((select sum(q) from vd), 0), coalesce((select sum(amount) from vd), 0),
         (select count(*) from dia where u > 0), coalesce((select max(u) from dia), 0),
         (select d from dia order by u desc, d desc limit 1)
    into v_unid, v_valor, v_dias, v_recorde, v_recorde_dia;

  select min((created_at at time zone 'America/Sao_Paulo')::date) into v_primeira
  from defcon_sales where user_id = p_user and method <> 'gorjeta';
  v_janela := least(60, greatest(1, hoje - coalesce(v_primeira, hoje) + 1));

  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'unid_dia', u, 'dias', d) order by dow), '[]'::jsonb) into v_semana
  from (
    select extract(dow from (created_at at time zone 'America/Sao_Paulo'))::int as dow,
           round(sum(coalesce(qty, 1))::numeric / count(distinct (created_at at time zone 'America/Sao_Paulo')::date), 1) as u,
           count(distinct (created_at at time zone 'America/Sao_Paulo')::date)::int as d
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
    group by 1
  ) s;

  select jsonb_build_object(
    'ultimos15', coalesce((select sum(coalesce(qty, 1)) from defcon_sales where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
                           and (created_at at time zone 'America/Sao_Paulo')::date between hoje - 14 and hoje), 0),
    'anteriores15', coalesce((select sum(coalesce(qty, 1)) from defcon_sales where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
                              and (created_at at time zone 'America/Sao_Paulo')::date between hoje - 29 and hoje - 15), 0)
  ) into v_quinzenas;

  select avg(nullif(cost, 0)), avg(nullif(sale_price, 0)),
         coalesce(sum(greatest(stock_quantity, 0)) filter (where coalesce(controla_estoque, true)), 0),
         case when count(*) = 1 then max(name) end
    into v_custo_receita, v_preco, v_estoque, v_nome
  from products where user_id = p_user and coalesce(is_active, true);
  select nickname into v_apelido from profiles where user_id = p_user limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('nome', p.name, 'preco', p.sale_price, 'custo', p.cost, 'estoque', p.stock_quantity,
           'vendidas', coalesce((select sum(coalesce(qty, 1)) from defcon_sales d where d.user_id = p_user and d.product_id = p.id and d.method <> 'gorjeta'
                                 and (d.created_at at time zone 'America/Sao_Paulo')::date between de and hoje), 0)) order by p.name), '[]'::jsonb)
    into v_produtos
  from products p where p.user_id = p_user and coalesce(p.is_active, true);

  select coalesce(sum(total_debt), 0), coalesce(sum(unpaid_units), 0), count(*) filter (where coalesce(total_debt, 0) > 0),
         coalesce(sum(transport_cost), 0), coalesce(sum(food_cost), 0)
    into v_calote, v_calote_unid, v_calote_dias, v_transporte, v_comida
  from daily_sales where user_id = p_user and date between de and hoje;
  select coalesce(sum(amount), 0) into v_recuperado from late_pix_entries where user_id = p_user and sale_date between de and hoje;

  select exists (select 1 from bank_connections where user_id = p_user) into v_banco;
  select coalesce(sum(abs(valor)), 0) into v_saidas
  from extrato_lancamentos
  where user_id = p_user and esfera = 'corre' and tipo = 'saida' and movimento = 'normal'
    and not coalesce(fora_analise, false) and data between de and hoje;
  select coalesce(sum(abs(valor)), 0) into v_entradas_corre
  from extrato_lancamentos
  where user_id = p_user and esfera = 'corre' and tipo = 'entrada' and movimento = 'normal'
    and not coalesce(fora_analise, false) and data between de and hoje;
  select coalesce(sum(abs(valor)), 0) into v_pessoal
  from extrato_lancamentos
  where user_id = p_user and esfera = 'pessoal' and tipo = 'saida' and movimento = 'normal'
    and not coalesce(fora_analise, false) and data between de and hoje;
  select coalesce(jsonb_agg(jsonb_build_object('categoria', c, 'valor', v, 'n', n) order by v desc), '[]'::jsonb) into v_cats
  from (
    select coalesce(categoria, 'outros') as c, round(sum(abs(valor))::numeric, 2) as v, count(*)::int as n
    from extrato_lancamentos
    where user_id = p_user and esfera = 'corre' and tipo = 'saida' and movimento = 'normal'
      and not coalesce(fora_analise, false) and data between de and hoje
    group by 1 order by 2 desc limit 8
  ) c;

  v_ticket := case when v_unid > 0 then v_valor / v_unid else coalesce(v_preco, 0) end;
  -- Calote lost, spread over every unit sold: the real "tax" of selling on the street.
  v_calote_unid_medio := case when v_unid > 0 then greatest(0, v_calote - v_recuperado) / v_unid else 0 end;
  if coalesce(v_custo_receita, 0) > 0 then
    v_custo := v_custo_receita + v_calote_unid_medio; v_fonte := 'receita';
  elsif v_banco and v_saidas > 0 and v_unid >= 20 and v_saidas / v_unid < v_ticket * 0.9 then
    v_custo := v_saidas / v_unid + v_calote_unid_medio; v_fonte := 'extrato';
  else
    v_custo := v_calote_unid_medio; v_fonte := 'sem_custo';
  end if;

  return jsonb_build_object(
    'hoje', hoje, 'apelido', v_apelido, 'janela_dias', v_janela, 'dias_vendidos', v_dias, 'unidades', v_unid,
    'vendas', round(v_valor, 2),
    'unid_dia', case when v_dias > 0 then round(v_unid / v_dias, 1) else 0 end,
    'recorde_dia', v_recorde, 'recorde_data', v_recorde_dia,
    'ticket', round(v_ticket, 2), 'custo_unid', round(v_custo, 2),
    'custo_receita', round(coalesce(v_custo_receita, 0), 2),
    'calote_unid', round(v_calote_unid_medio, 2),
    'custo_extrato', case when v_unid > 0 and v_saidas > 0 then round(v_saidas / v_unid, 2) else null end,
    'gastos_corre', round(v_saidas, 2), 'entradas_corre', round(v_entradas_corre, 2),
    'gastos_pessoais', round(v_pessoal, 2),
    'categorias', v_cats,
    'fonte_custo', v_fonte, 'banco', v_banco,
    'estoque', v_estoque, 'produto_nome', v_nome, 'produtos', v_produtos,
    'frequencia', round(v_dias::numeric / v_janela, 3),
    'semana', v_semana, 'quinzenas', v_quinzenas,
    'calote', jsonb_build_object('valor', round(v_calote, 2), 'unidades', v_calote_unid, 'dias', v_calote_dias,
                                 'recuperado', round(v_recuperado, 2), 'perdido', round(greatest(0, v_calote - v_recuperado), 2),
                                 'pct', case when v_valor + v_calote > 0 then round(v_calote / (v_valor + v_calote) * 100, 1) else 0 end),
    'transporte', round(v_transporte, 2), 'alimentacao', round(v_comida, 2)
  );
end;
$$;
