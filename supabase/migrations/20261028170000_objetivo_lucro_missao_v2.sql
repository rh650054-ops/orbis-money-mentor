-- Profit mission v2 (Rick, 28/10/2026).
--
-- 1) Calote measured only where the bank really covers it. Pluggy backfills history before the
--    connection date, but with gaps (days with R$ 500 of app Pix and one R$ 13 bank entry), and
--    weekly transfers of R$ 300-700 are not street sales. So: coverage starts on the day the bank
--    was connected, days the bank reported nothing are left out of both sides, and only sale-sized
--    entries (<= 2x his biggest app sale) count as "money that landed". Per-day table for the UI,
--    both estimates (bank / app) returned, and the seller can pick which one the mission uses.
-- 2) The mission stores the day-by-day plan the seller accepted (which days, how many units each)
--    and the daily target rebalances every day over the planned days still ahead.

alter table public.objetivos_lucro add column if not exists plano jsonb;
alter table public.objetivos_lucro add column if not exists calote_fonte text;

-- ---------------------------------------------------------------------------------------------
-- new signatures (a default parameter would make the 1-arg call ambiguous with the old ones)
drop function if exists public.objetivo_lucro_analise();
drop function if exists public.objetivo_lucro_base(uuid);

create or replace function public.objetivo_lucro_base(p_user uuid, p_calote_fonte text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - 59;
  v_unid numeric; v_valor numeric; v_dias int; v_recorde numeric; v_recorde_dia date;
  v_primeira date; v_janela int;
  v_custo_receita numeric; v_preco numeric; v_estoque numeric; v_nome text; v_apelido text;
  v_saidas numeric; v_banco boolean; v_pessoal numeric; v_entradas_corre numeric;
  v_ticket numeric; v_custo numeric; v_fonte text; v_calote_unid_medio numeric;
  v_calote numeric; v_calote_unid int; v_calote_dias int; v_recuperado numeric;
  v_transporte numeric; v_comida numeric; v_app_pix numeric; v_calote_banco numeric; v_calote_usado numeric; v_calote_fonte text;
  v_cats jsonb; v_semana jsonb; v_produtos jsonb; v_quinzenas jsonb; v_mix jsonb; v_vendas_n int;
  -- 28/10: bank coverage
  v_banco_desde date; v_desde date; v_max_venda numeric; v_teto numeric;
  v_app_pix_cob numeric; v_bank_cob numeric; v_cob_dias int; v_unid_cob numeric; v_calote_dias_tab jsonb;
  v_calote_app numeric; v_banco_unid numeric; v_app_unid numeric; v_banco_por_dia numeric; v_app_por_dia numeric; v_por_dia numeric;
begin
  select avg(nullif(cost, 0)), avg(nullif(sale_price, 0)),
         coalesce(sum(greatest(stock_quantity, 0)) filter (where coalesce(controla_estoque, true)), 0),
         case when count(*) = 1 then max(name) end
    into v_custo_receita, v_preco, v_estoque, v_nome
  from products where user_id = p_user and coalesce(is_active, true);

  with vd as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d, public.vant_unid_inferida(amount, qty, product_id is not null, v_preco) as q, amount
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
  ), dia as (select d, sum(q) as u from vd group by d)
  select coalesce((select sum(q) from vd), 0), coalesce((select sum(amount) from vd), 0),
         (select count(*) from dia where u > 0), coalesce((select max(u) from dia), 0),
         (select d from dia order by u desc, d desc limit 1)
    into v_unid, v_valor, v_dias, v_recorde, v_recorde_dia;

  with vd as (
    select public.vant_unid_inferida(amount, qty, product_id is not null, v_preco) as q, amount from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
  )
  select count(*), jsonb_build_object(
      'um', round(100.0 * count(*) filter (where q = 1) / greatest(1, count(*))),
      'dois', round(100.0 * count(*) filter (where q = 2) / greatest(1, count(*))),
      'tres', round(100.0 * count(*) filter (where q >= 3) / greatest(1, count(*))),
      'preco_um', round(avg(amount) filter (where q = 1), 2),
      'preco_dois', round(avg(amount) filter (where q = 2), 2),
      'unid_por_venda', round(sum(q)::numeric / greatest(1, count(*)), 2),
      'ticket_venda', round(sum(amount) / greatest(1, count(*)), 2))
    into v_vendas_n, v_mix from vd;

  select min((created_at at time zone 'America/Sao_Paulo')::date) into v_primeira
  from defcon_sales where user_id = p_user and method <> 'gorjeta';
  v_janela := least(60, greatest(1, hoje - coalesce(v_primeira, hoje) + 1));

  select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'unid_dia', u, 'dias', d) order by dow), '[]'::jsonb) into v_semana
  from (
    select extract(dow from (created_at at time zone 'America/Sao_Paulo'))::int as dow,
           round(sum(public.vant_unid_inferida(amount, qty, product_id is not null, v_preco))::numeric / count(distinct (created_at at time zone 'America/Sao_Paulo')::date), 1) as u,
           count(distinct (created_at at time zone 'America/Sao_Paulo')::date)::int as d
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje
    group by 1
  ) s;

  select jsonb_build_object(
    'ultimos15', coalesce((select sum(public.vant_unid_inferida(amount, qty, product_id is not null, v_preco)) from defcon_sales where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
                           and (created_at at time zone 'America/Sao_Paulo')::date between hoje - 14 and hoje), 0),
    'anteriores15', coalesce((select sum(public.vant_unid_inferida(amount, qty, product_id is not null, v_preco)) from defcon_sales where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
                              and (created_at at time zone 'America/Sao_Paulo')::date between hoje - 29 and hoje - 15), 0)
  ) into v_quinzenas;

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
  select coalesce(sum(amount), 0) into v_app_pix from defcon_sales
  where user_id = p_user and method in ('pix', 'cartao') and not coalesce(late, false)
    and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje;

  select min(created_at at time zone 'America/Sao_Paulo')::date into v_banco_desde from bank_connections where user_id = p_user;
  v_banco := v_banco_desde is not null;
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

  -- 28/10: calote by the bank, only where the bank covers it ----------------------------------
  v_desde := greatest(de, coalesce(v_banco_desde, hoje + 1));
  select coalesce(max(amount), 0) into v_max_venda from defcon_sales
   where user_id = p_user and method in ('pix', 'cartao') and (created_at at time zone 'America/Sao_Paulo')::date between de and hoje;
  v_teto := greatest(150, v_max_venda * 2);
  with dias_banco as (
    select distinct data as d from extrato_lancamentos where user_id = p_user and data between v_desde and hoje
  ), app as (
    select (created_at at time zone 'America/Sao_Paulo')::date as d,
           sum(amount) filter (where method in ('pix', 'cartao')) as pix,
           sum(public.vant_unid_inferida(amount, qty, product_id is not null, v_preco)) as unid
    from defcon_sales
    where user_id = p_user and method <> 'gorjeta' and not coalesce(late, false)
      and (created_at at time zone 'America/Sao_Paulo')::date between v_desde and hoje
    group by 1
  ), bk as (
    select data as d, sum(abs(valor)) as v
    from extrato_lancamentos
    where user_id = p_user and esfera = 'corre' and tipo = 'entrada' and movimento = 'normal'
      and not coalesce(fora_analise, false) and abs(valor) <= v_teto and data between v_desde and hoje
    group by 1
  ), cob as (
    -- sold days the bank reported something on (a day with no bank record at all is a sync gap)
    select app.d, coalesce(app.pix, 0) as pix, coalesce(app.unid, 0) as unid, coalesce(bk.v, 0) as banco
    from app join dias_banco db on db.d = app.d left join bk on bk.d = app.d
    where coalesce(app.unid, 0) > 0
  )
  select coalesce((select sum(pix) from cob), 0), coalesce((select sum(v) from bk), 0),
         coalesce((select count(*) from cob), 0), coalesce((select sum(unid) from cob), 0),
         coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'app', round(pix, 2), 'banco', round(banco, 2), 'dif', round(pix - banco, 2)) order by d)
                     from (select * from cob order by d desc limit 14) u), '[]'::jsonb)
    into v_app_pix_cob, v_bank_cob, v_cob_dias, v_unid_cob, v_calote_dias_tab;

  v_calote_app := greatest(0, v_calote - v_recuperado);
  v_calote_banco := case when v_banco and v_cob_dias >= 5 and v_app_pix_cob > 0 then greatest(0, v_app_pix_cob - v_bank_cob) else null end;
  v_banco_unid := case when v_calote_banco is not null and v_unid_cob > 0 then v_calote_banco / v_unid_cob else null end;
  v_app_unid := case when v_unid > 0 then v_calote_app / v_unid else 0 end;
  v_banco_por_dia := case when v_calote_banco is not null and v_cob_dias > 0 then v_calote_banco / v_cob_dias else null end;
  v_app_por_dia := case when v_dias > 0 then v_calote_app / v_dias else 0 end;
  -- the seller's choice wins; otherwise the bank when it covers enough days, else the app
  v_calote_fonte := case when p_calote_fonte = 'app' then 'app'
                         when p_calote_fonte = 'banco' and v_calote_banco is not null then 'banco'
                         when v_calote_banco is not null then 'banco' else 'app' end;
  if v_calote_fonte = 'banco' then
    v_calote_usado := v_calote_banco; v_calote_unid_medio := v_banco_unid; v_por_dia := v_banco_por_dia;
  else
    v_calote_usado := v_calote_app; v_calote_unid_medio := v_app_unid; v_por_dia := v_app_por_dia;
  end if;

  v_ticket := case when v_unid > 0 then v_valor / v_unid else coalesce(v_preco, 0) end;
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
    'combos', v_mix, 'vendas_dia', case when v_dias > 0 then round(v_vendas_n::numeric / v_dias, 1) else 0 end,
    'preco_tabela', round(coalesce(v_preco, 0), 2),
    'calote', jsonb_build_object('valor', round(v_calote, 2), 'unidades', v_calote_unid, 'dias', v_calote_dias,
                                 'recuperado', round(v_recuperado, 2), 'perdido', round(v_calote_app, 2),
                                 'pct', case when v_valor + v_calote > 0 then round(v_calote / (v_valor + v_calote) * 100, 1) else 0 end,
                                 'estimado_banco', case when v_calote_banco is null then null else round(v_calote_banco, 2) end,
                                 'app_pix', round(v_app_pix, 2),
                                 'usado', round(v_calote_usado, 2), 'fonte', v_calote_fonte,
                                 'por_dia', round(coalesce(v_por_dia, 0), 2),
                                 'pct_pix', case when v_calote_fonte = 'banco' and v_app_pix_cob > 0 then round(v_calote_usado / v_app_pix_cob * 100, 1)
                                                 when v_app_pix > 0 then round(v_calote_usado / v_app_pix * 100, 1) else 0 end,
                                 -- 28/10: coverage + both estimates, so the seller can see and choose
                                 'desde', case when v_banco then v_desde end, 'dias_banco', v_cob_dias,
                                 'app_pix_banco', round(v_app_pix_cob, 2), 'banco_recebido', round(v_bank_cob, 2), 'teto', v_teto,
                                 'banco_unid', case when v_banco_unid is null then null else round(v_banco_unid, 2) end,
                                 'banco_por_dia', case when v_banco_por_dia is null then null else round(v_banco_por_dia, 2) end,
                                 'app_unid', round(v_app_unid, 2), 'app_por_dia', round(v_app_por_dia, 2),
                                 'tabela', v_calote_dias_tab),
    'transporte', round(v_transporte, 2), 'alimentacao', round(v_comida, 2)
  );
end;
$function$;

revoke all on function public.objetivo_lucro_base(uuid, text) from public, anon, authenticated;

-- The app reads its own base (optionally with the calote source it wants).
create or replace function public.objetivo_lucro_analise(p_calote_fonte text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.objetivo_lucro_base(auth.uid(), p_calote_fonte) where auth.uid() is not null;
$$;
revoke all on function public.objetivo_lucro_analise(text) from public, anon;
grant execute on function public.objetivo_lucro_analise(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Today's target. With a plan: the profit still missing is spread over the planned days ahead in
-- proportion to the plan (strong days keep carrying more), so a weak day pushes the rest up and a
-- strong day eases it. Without a plan (missions before 28/10): flat split, as before.
create or replace function public.objetivo_lucro_meta_dia(p_user uuid, p_dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o objetivos_lucro%rowtype;
  v_valor numeric; v_unid numeric; v_dias int;
  v_lucro_antes numeric; v_restante numeric; v_rest int; v_precisa numeric; v_unid_meta numeric; v_preco numeric;
  v_tem_plano boolean; v_hoje jsonb; v_trabalha boolean := true; v_peso numeric := 0; v_soma numeric := 0;
  v_dias_plano_rest int := 0; v_plan_unid_antes numeric := 0; v_plan_lucro_antes numeric; v_ritmo text; v_unid_rest numeric;
begin
  select * into o from objetivos_lucro
   where user_id = p_user and status = 'ativo' and p_dia between inicio and fim
   order by criado_em desc limit 1;
  if not found or coalesce(o.lucro_unid, 0) <= 0 then return null; end if;

  select coalesce(sum(amount), 0),
         coalesce(sum(case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end), 0),
         count(distinct (created_at at time zone 'America/Sao_Paulo')::date)
           filter (where method <> 'gorjeta' and not coalesce(late, false))
    into v_valor, v_unid, v_dias
    from defcon_sales
   where user_id = p_user
     and (created_at at time zone 'America/Sao_Paulo')::date >= o.inicio
     and (created_at at time zone 'America/Sao_Paulo')::date < p_dia;

  v_lucro_antes := v_valor - v_unid * o.custo_unid;
  v_restante := o.alvo - v_lucro_antes;
  v_preco := o.custo_unid + o.lucro_unid;
  v_tem_plano := o.plano is not null and jsonb_typeof(o.plano) = 'array' and jsonb_array_length(o.plano) > 0;

  if v_tem_plano then
    select x into v_hoje from jsonb_array_elements(o.plano) x where x ->> 'd' = p_dia::text limit 1;
    v_trabalha := coalesce((v_hoje ->> 't')::boolean, false);
    v_peso := coalesce((v_hoje ->> 'u')::numeric, 0);
    select coalesce(sum((x ->> 'u')::numeric), 0), count(*)
      into v_soma, v_dias_plano_rest
      from jsonb_array_elements(o.plano) x
     where (x ->> 'd')::date >= p_dia and coalesce((x ->> 't')::boolean, false);
    select coalesce(sum((x ->> 'u')::numeric), 0) into v_plan_unid_antes
      from jsonb_array_elements(o.plano) x
     where (x ->> 'd')::date < p_dia and coalesce((x ->> 't')::boolean, false);
    v_plan_lucro_antes := v_plan_unid_antes * o.lucro_unid;
    v_ritmo := case when v_lucro_antes >= v_plan_lucro_antes + greatest(20, o.lucro_unid * 3) then 'adiantado'
                    when v_lucro_antes < v_plan_lucro_antes - greatest(20, o.lucro_unid * 3) then 'atrasado'
                    else 'no_plano' end;
  end if;

  if v_restante <= 0 then return null; end if;
  v_unid_rest := ceil(v_restante / o.lucro_unid);

  if v_tem_plano then
    if v_trabalha and v_soma > 0 then v_unid_meta := ceil(v_unid_rest * v_peso / v_soma);
    elsif v_dias_plano_rest > 0 then v_unid_meta := ceil(v_unid_rest / v_dias_plano_rest);  -- day off: a planned day's share, if he goes anyway
    else v_unid_meta := v_unid_rest; end if;
  else
    v_rest := greatest(1, o.dias_trabalho - v_dias);
    v_unid_meta := ceil(greatest(0, v_restante) / v_rest / o.lucro_unid);
  end if;
  v_unid_meta := greatest(1, v_unid_meta);
  v_precisa := v_unid_meta * o.lucro_unid;

  return jsonb_build_object(
    'id', o.id, 'alvo', o.alvo, 'fim', o.fim,
    'lucro_feito', round(v_lucro_antes, 2), 'precisa_lucro', round(v_precisa, 2),
    'unid_meta', v_unid_meta, 'faturar', round(v_unid_meta * v_preco, 2),
    'produto', o.analise ->> 'produto_nome',
    'trabalha', v_trabalha, 'ritmo', v_ritmo,
    'atraso', case when v_tem_plano then round(v_lucro_antes - v_plan_lucro_antes, 2) end,
    'dia', p_dia - o.inicio + 1, 'dias_periodo', o.fim - o.inicio + 1,
    'dias_plano_restantes', case when v_tem_plano then v_dias_plano_rest end
  );
end;
$$;
revoke all on function public.objetivo_lucro_meta_dia(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
create or replace function public.objetivo_lucro_criar(p_alvo numeric, p_dias integer, p_dias_trabalho integer, p_ia jsonb, p_plano jsonb, p_calote_fonte text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  b jsonb; v_id uuid; v_plano jsonb := null; v_n int;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_alvo is null or p_alvo <= 0 or p_alvo > 1000000 then raise exception 'valor inválido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'prazo inválido'; end if;
  if p_dias_trabalho is null or p_dias_trabalho < 1 or p_dias_trabalho > p_dias then raise exception 'dias de trabalho inválidos'; end if;
  if p_calote_fonte is not null and p_calote_fonte not in ('banco', 'app') then raise exception 'fonte de calote inválida'; end if;
  -- the plan: one entry per calendar day of the mission, {d, t, u}; kept only when it is whole
  if p_plano is not null and jsonb_typeof(p_plano) = 'array' then
    select jsonb_agg(jsonb_build_object('d', (x ->> 'd')::date, 't', coalesce((x ->> 't')::boolean, false),
                                        'u', greatest(0, round(coalesce((x ->> 'u')::numeric, 0)))) order by (x ->> 'd')::date), count(*)
      into v_plano, v_n
      from jsonb_array_elements(p_plano) x
     where (x ->> 'd') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'd')::date between hoje and hoje + p_dias - 1;
    if coalesce(v_n, 0) <> p_dias then v_plano := null; end if;
  end if;
  b := public.objetivo_lucro_base(u, p_calote_fonte);
  if p_ia is not null then b := b || jsonb_build_object('ia', p_ia); end if;
  update objetivos_lucro set status = 'encerrado' where user_id = u and status = 'ativo';
  insert into objetivos_lucro (user_id, alvo, inicio, fim, dias_trabalho, custo_unid, lucro_unid, analise, plano, calote_fonte)
  values (u, round(p_alvo, 2), hoje, hoje + p_dias - 1, p_dias_trabalho,
          (b->>'custo_unid')::numeric,
          greatest(0, (b->>'ticket')::numeric - (b->>'custo_unid')::numeric), b, v_plano, b -> 'calote' ->> 'fonte')
  returning id into v_id;
  perform public.objetivo_lucro_aplicar_meta(u);
  return v_id;
end;
$function$;
revoke all on function public.objetivo_lucro_criar(numeric, integer, integer, jsonb, jsonb, text) from public, anon;
grant execute on function public.objetivo_lucro_criar(numeric, integer, integer, jsonb, jsonb, text) to authenticated;

-- The old 4-param signature stays as a thin wrapper (the app always sends all six params).
create or replace function public.objetivo_lucro_criar(p_alvo numeric, p_dias integer, p_dias_trabalho integer, p_ia jsonb default null)
 returns uuid language sql security definer set search_path to 'public'
as $$ select public.objetivo_lucro_criar(p_alvo, p_dias, p_dias_trabalho, p_ia, null::jsonb, null::text); $$;

-- ---------------------------------------------------------------------------------------------
create or replace function public.objetivo_lucro_atual()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  o objetivos_lucro%rowtype;
  v_valor_antes numeric; v_unid_antes numeric; v_dias_antes int;
  v_valor_hoje numeric; v_unid_hoje numeric;
  v_lucro_antes numeric; v_lucro_hoje numeric; v_lucro numeric;
  v_dias jsonb; m jsonb; v_trabalha boolean;
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

  -- today's target comes from the same function the Foco uses (one source of truth)
  m := case when o.status = 'ativo' then public.objetivo_lucro_meta_dia(u, hoje) end;
  v_trabalha := coalesce((m ->> 'trabalha')::boolean,
                         (select coalesce((x ->> 't')::boolean, true) from jsonb_array_elements(coalesce(o.plano, '[]'::jsonb)) x where x ->> 'd' = hoje::text limit 1),
                         true);

  return jsonb_build_object(
    'id', o.id, 'alvo', o.alvo, 'inicio', o.inicio, 'fim', o.fim, 'status', o.status,
    'dias_periodo', o.fim - o.inicio + 1,
    'dia_atual', least(o.fim - o.inicio + 1, hoje - o.inicio + 1),
    'dias_trabalho', o.dias_trabalho, 'dias_trabalhados', v_dias_antes + case when v_unid_hoje > 0 then 1 else 0 end,
    'custo_unid', o.custo_unid, 'lucro_unid', o.lucro_unid,
    'lucro', round(v_lucro, 2), 'vendas', round(v_valor_antes + v_valor_hoje, 2),
    'unidades', v_unid_antes + v_unid_hoje,
    'hoje', jsonb_build_object('precisa', coalesce((m ->> 'precisa_lucro')::numeric, 0), 'unid_meta', (m ->> 'unid_meta')::numeric,
                               'unid', v_unid_hoje, 'lucro', round(v_lucro_hoje, 2),
                               'trabalha', v_trabalha, 'ritmo', m ->> 'ritmo', 'atraso', (m ->> 'atraso')::numeric),
    'dias', v_dias,
    'plano', coalesce(o.plano, '[]'::jsonb),
    'calote_fonte', o.calote_fonte,
    'analise', o.analise
  );
end;
$function$;
