-- Profit challenge v2 (Rick, 27/10/2026): the analysis is done by the AI.
-- objetivo_lucro_base now ships everything the AI reads: bank outflows by category,
-- calotes (unpaid + recovered), units per weekday, products with cost/price/stock,
-- personal outflows. objetivo_lucro_criar stores the AI plan; objetivo_lucro_atual
-- returns the profit per day of the challenge for the card's day strip.

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
  v_custo_receita numeric; v_preco numeric; v_estoque numeric; v_nome text;
  v_saidas numeric; v_banco boolean; v_pessoal numeric; v_entradas_corre numeric;
  v_ticket numeric; v_custo numeric; v_fonte text;
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

  -- Units per weekday (average on the days he sold) — the AI picks the strong days.
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

  -- Last 15 days vs the 15 before: is he going up or down?
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

  select coalesce(jsonb_agg(jsonb_build_object('nome', p.name, 'preco', p.sale_price, 'custo', p.cost, 'estoque', p.stock_quantity,
           'vendidas', coalesce((select sum(coalesce(qty, 1)) from defcon_sales d where d.user_id = p_user and d.product_id = p.id and d.method <> 'gorjeta'
                                 and (d.created_at at time zone 'America/Sao_Paulo')::date between de and hoje), 0)) order by p.name), '[]'::jsonb)
    into v_produtos
  from products p where p.user_id = p_user and coalesce(p.is_active, true);

  -- Calotes: what was sold and not paid, and what came back later.
  select coalesce(sum(total_debt), 0), coalesce(sum(unpaid_units), 0), count(*) filter (where coalesce(total_debt, 0) > 0),
         coalesce(sum(transport_cost), 0), coalesce(sum(food_cost), 0)
    into v_calote, v_calote_unid, v_calote_dias, v_transporte, v_comida
  from daily_sales where user_id = p_user and date between de and hoje;
  select coalesce(sum(amount), 0) into v_recuperado from late_pix_entries where user_id = p_user and sale_date between de and hoje;

  -- Bank (Open Finance): outflows of the "corre" by category, income of the corre, personal outflows.
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
  if v_banco and v_saidas > 0 and v_unid >= 20 and v_saidas / v_unid < v_ticket * 0.9 then
    v_custo := v_saidas / v_unid; v_fonte := 'extrato';
  else
    v_custo := coalesce(v_custo_receita, 0); v_fonte := 'receita';
  end if;

  return jsonb_build_object(
    'hoje', hoje, 'janela_dias', v_janela, 'dias_vendidos', v_dias, 'unidades', v_unid,
    'vendas', round(v_valor, 2),
    'unid_dia', case when v_dias > 0 then round(v_unid / v_dias, 1) else 0 end,
    'recorde_dia', v_recorde, 'recorde_data', v_recorde_dia,
    'ticket', round(v_ticket, 2), 'custo_unid', round(v_custo, 2),
    'custo_receita', round(coalesce(v_custo_receita, 0), 2),
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

-- The AI plan (jsonb) is stored with the challenge so the card can show it.
drop function if exists public.objetivo_lucro_criar(numeric, int, int);
create or replace function public.objetivo_lucro_criar(p_alvo numeric, p_dias int, p_dias_trabalho int, p_ia jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  b jsonb; v_id uuid;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_alvo is null or p_alvo <= 0 or p_alvo > 1000000 then raise exception 'valor inválido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'prazo inválido'; end if;
  if p_dias_trabalho is null or p_dias_trabalho < 1 or p_dias_trabalho > p_dias then raise exception 'dias de trabalho inválidos'; end if;
  b := public.objetivo_lucro_base(u);
  if p_ia is not null then b := b || jsonb_build_object('ia', p_ia); end if;
  update objetivos_lucro set status = 'encerrado' where user_id = u and status = 'ativo';
  insert into objetivos_lucro (user_id, alvo, inicio, fim, dias_trabalho, custo_unid, lucro_unid, analise)
  values (u, round(p_alvo, 2), hoje, hoje + p_dias - 1, p_dias_trabalho,
          (b->>'custo_unid')::numeric,
          greatest(0, (b->>'ticket')::numeric - (b->>'custo_unid')::numeric), b)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.objetivo_lucro_criar(numeric, int, int, jsonb) to authenticated;

create or replace function public.objetivo_lucro_atual()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  o objetivos_lucro%rowtype;
  v_valor_antes numeric; v_unid_antes numeric; v_dias_antes int;
  v_valor_hoje numeric; v_unid_hoje numeric;
  v_lucro_antes numeric; v_lucro_hoje numeric; v_lucro numeric;
  v_rest int; v_precisa numeric; v_unid_meta numeric; v_dias jsonb;
begin
  if u is null then return null; end if;
  select * into o from objetivos_lucro
  where user_id = u and (status = 'ativo' or (status = 'concluido' and fim >= hoje - 3)
                         or (status = 'encerrado' and fim between hoje - 3 and hoje - 1))
  order by (status = 'ativo') desc, criado_em desc limit 1;
  if not found then return null; end if;

  with vd as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d, amount,
           case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end as q
    from defcon_sales
    where user_id = u and (created_at at time zone 'America/Sao_Paulo')::date between o.inicio and least(hoje, o.fim)
  )
  select coalesce(sum(amount) filter (where d < hoje), 0), coalesce(sum(q) filter (where d < hoje), 0),
         count(distinct d) filter (where d < hoje and q > 0),
         coalesce(sum(amount) filter (where d = hoje), 0), coalesce(sum(q) filter (where d = hoje), 0),
         coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'unid', uq, 'lucro', round(va - uq * o.custo_unid, 2)) order by d)
                   from (select d, sum(q) uq, sum(amount) va from vd group by d) x), '[]'::jsonb)
    into v_valor_antes, v_unid_antes, v_dias_antes, v_valor_hoje, v_unid_hoje, v_dias
  from vd;

  v_lucro_antes := v_valor_antes - v_unid_antes * o.custo_unid;
  v_lucro_hoje := v_valor_hoje - v_unid_hoje * o.custo_unid;
  v_lucro := v_lucro_antes + v_lucro_hoje;

  if o.status <> 'ativo' then
    null;
  elsif v_lucro >= o.alvo then
    update objetivos_lucro set status = 'concluido' where id = o.id;
    o.status := 'concluido';
  elsif hoje > o.fim then
    update objetivos_lucro set status = 'encerrado' where id = o.id;
    o.status := 'encerrado';
  end if;

  v_rest := greatest(1, o.dias_trabalho - v_dias_antes);
  v_precisa := greatest(0, o.alvo - v_lucro_antes) / v_rest;
  v_unid_meta := case when o.lucro_unid > 0 then ceil(v_precisa / o.lucro_unid) else null end;

  return jsonb_build_object(
    'id', o.id, 'alvo', o.alvo, 'inicio', o.inicio, 'fim', o.fim, 'status', o.status,
    'dias_periodo', o.fim - o.inicio + 1,
    'dia_atual', least(o.fim - o.inicio + 1, hoje - o.inicio + 1),
    'dias_trabalho', o.dias_trabalho, 'dias_trabalhados', v_dias_antes + case when v_unid_hoje > 0 then 1 else 0 end,
    'custo_unid', o.custo_unid, 'lucro_unid', o.lucro_unid,
    'lucro', round(v_lucro, 2), 'vendas', round(v_valor_antes + v_valor_hoje, 2),
    'unidades', v_unid_antes + v_unid_hoje,
    'hoje', jsonb_build_object('precisa', round(v_precisa, 2), 'unid_meta', v_unid_meta,
                               'unid', v_unid_hoje, 'lucro', round(v_lucro_hoje, 2)),
    'dias', v_dias,
    'analise', o.analise
  );
end;
$$;
