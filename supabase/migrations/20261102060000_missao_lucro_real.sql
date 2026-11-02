-- Lucro REAL do dia na missão (Rick, 02/11/2026): "o custo de 9 (receita + calote médio) é pra
-- ter uma base no planejamento; no dia, o lucro é o que eu recebi menos o custo da batida (5,68)".
-- Antes: lucro do dia = vendido − batidas × custo_unid (receita + calote MÉDIO), ou seja o calote
-- do dia era chutado. Agora, por dia:
--   • dia fechado: lucro = recebido − batidas × custo da receita
--       recebido = o que caiu no banco (ranking_dia_cache, já com as regras anti-fraude) + dinheiro
--                  declarado, nunca acima do vendido; sem banco, o recebido do fechamento do Foco.
--   • hoje (banco ainda não fechou): estimativa com o calote médio, como antes.
-- O planejamento (lucro_unid, custo_unid, batidas por dia) não muda.

-- helper: one row per mission day with units, sold and real profit
create or replace function public.objetivo_lucro_dias(p_obj uuid, p_ate date)
 returns table(d date, unid numeric, vendido numeric, lucro numeric, real boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with o as (select * from public.objetivos_lucro where id = p_obj),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  vd as (
    select (s.created_at at time zone 'America/Sao_Paulo')::date as d, sum(s.amount) as vendido,
           sum(case when s.method <> 'gorjeta' and not coalesce(s.late, false) then coalesce(s.qty, 1) else 0 end) as unid
      from public.defcon_sales s, o
     where s.user_id = o.user_id
       and (s.created_at at time zone 'America/Sao_Paulo')::date between o.inicio and least(p_ate, o.fim)
     group by 1
  )
  select vd.d, vd.unid, vd.vendido,
         round(case
           when vd.d >= (select d from hoje) then vd.vendido - vd.unid * o.custo_unid
           else (case when c.pelo_banco then least(vd.vendido, c.valor + coalesce(ds.cash_sales, 0))
                      else least(vd.vendido, coalesce(ds.total_profit, vd.vendido)) end)
                - vd.unid * coalesce(nullif((o.analise ->> 'custo_receita')::numeric, 0), o.custo_unid)
         end, 2),
         vd.d < (select d from hoje)
    from vd cross join o
    left join public.ranking_dia_cache c on c.user_id = o.user_id and c.dia = vd.d
    left join lateral (select sum(total_profit) as total_profit, sum(cash_sales) as cash_sales
                         from public.daily_sales where user_id = o.user_id and date = vd.d) ds on true;
$function$;
revoke all on function public.objetivo_lucro_dias(uuid, date) from public, anon, authenticated;

-- daily target: profit already made comes from the real days
create or replace function public.objetivo_lucro_meta_dia(p_user uuid, p_dia date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  o objetivos_lucro%rowtype;
  v_dias int;
  v_lucro_antes numeric; v_restante numeric; v_rest int; v_precisa numeric; v_unid_meta numeric; v_preco numeric;
  v_tem_plano boolean; v_hoje jsonb; v_trabalha boolean := true; v_peso numeric := 0; v_soma numeric := 0;
  v_dias_plano_rest int := 0; v_plan_unid_antes numeric := 0; v_plan_lucro_antes numeric; v_ritmo text; v_unid_rest numeric;
begin
  select * into o from objetivos_lucro
   where user_id = p_user and status = 'ativo' and p_dia between inicio and fim
   order by criado_em desc limit 1;
  if not found or coalesce(o.lucro_unid, 0) <= 0 then return null; end if;

  -- 02/11: real profit per closed day (received − recipe cost), today estimated
  select coalesce(sum(x.lucro), 0), count(*) filter (where x.unid > 0)
    into v_lucro_antes, v_dias
    from public.objetivo_lucro_dias(o.id, p_dia - 1) x;

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
    elsif v_dias_plano_rest > 0 then v_unid_meta := ceil(v_unid_rest / v_dias_plano_rest);
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
$function$;
revoke all on function public.objetivo_lucro_meta_dia(uuid, date) from public, anon, authenticated;

-- mission card: same real days
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

  -- 02/11: real profit per closed day; today = estimate
  select coalesce(sum(x.vendido) filter (where x.d < hoje), 0), coalesce(sum(x.unid) filter (where x.d < hoje), 0),
         count(*) filter (where x.d < hoje and x.unid > 0),
         coalesce(sum(x.vendido) filter (where x.d = hoje), 0), coalesce(sum(x.unid) filter (where x.d = hoje), 0),
         coalesce(sum(x.lucro) filter (where x.d < hoje), 0), coalesce(sum(x.lucro) filter (where x.d = hoje), 0),
         coalesce(jsonb_agg(jsonb_build_object('dia', x.d, 'unid', x.unid, 'lucro', x.lucro, 'real', x.real) order by x.d), '[]'::jsonb)
    into v_valor_antes, v_unid_antes, v_dias_antes, v_valor_hoje, v_unid_hoje, v_lucro_antes, v_lucro_hoje, v_dias
    from public.objetivo_lucro_dias(o.id, least(hoje, o.fim)) x;

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
