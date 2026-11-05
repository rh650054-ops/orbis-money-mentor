-- 05/11/2026 (Rick): "preciso poder clicar em cada gráfico ali, e quando clico ele mostra como foi
-- aquele dia". One day of a mission, in detail: plan vs real, how he was paid, what the bank
-- confirmed, calote, cost, profit, the Foco hours and sales per hour. Same profit rule as
-- objetivo_lucro_dias (closed days = what really fell in; today = estimate).
create or replace function public.objetivo_lucro_dia(p_obj uuid, p_dia date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  o public.objetivos_lucro%rowtype;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p jsonb; v_plano_unid numeric; v_trabalha boolean;
  r record; s record; d record; c record;
  v_recebido numeric; v_custo_unid numeric; v_lucro numeric; v_calote numeric; v_fonte text;
  v_horas jsonb; v_melhor jsonb;
begin
  if u is null then return null; end if;
  select * into o from public.objetivos_lucro where id = p_obj and user_id = u;
  if not found then return null; end if;

  select x into p from jsonb_array_elements(coalesce(o.plano, '[]'::jsonb)) x where x ->> 'd' = p_dia::text limit 1;
  v_trabalha := coalesce((p ->> 't')::boolean, true);
  v_plano_unid := coalesce((p ->> 'u')::numeric, 0);

  -- what he launched in the Foco that day
  select count(*) filter (where method <> 'gorjeta') as vendas,
         coalesce(sum(amount), 0) as vendido,
         coalesce(sum(case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end), 0) as unid,
         coalesce(sum(amount) filter (where method = 'dinheiro'), 0) as dinheiro,
         coalesce(sum(amount) filter (where method = 'pix'), 0) as pix,
         coalesce(sum(amount) filter (where method = 'cartao'), 0) as cartao,
         coalesce(sum(amount) filter (where method = 'gorjeta'), 0) as gorjeta,
         coalesce(sum(amount) filter (where coalesce(late, false)), 0) as fiado
    into r
    from public.defcon_sales
   where user_id = u and (created_at at time zone 'America/Sao_Paulo')::date = p_dia;

  select min(started_at) as inicio, max(ended_at) as fim, sum(worked_minutes) as minutos
    into s from public.challenge_sessions where user_id = u and date = p_dia;

  select sum(total_profit) as recebido, sum(total_debt) as calote, sum(cash_sales) as dinheiro
    into d from public.daily_sales where user_id = u and date = p_dia;

  select valor, pelo_banco into c from public.ranking_dia_cache where user_id = u and dia = p_dia;

  v_custo_unid := coalesce(nullif((o.analise ->> 'custo_receita')::numeric, 0), o.custo_unid);
  if p_dia >= hoje then
    v_recebido := r.vendido; v_calote := 0; v_fonte := 'estimativa';
  elsif c.pelo_banco then
    v_recebido := least(r.vendido, coalesce(c.valor, 0) + coalesce(d.dinheiro, 0)); v_calote := greatest(r.vendido - v_recebido, 0); v_fonte := 'banco';
  else
    v_recebido := least(r.vendido, coalesce(d.recebido, r.vendido)); v_calote := coalesce(d.calote, greatest(r.vendido - v_recebido, 0)); v_fonte := 'app';
  end if;
  v_lucro := round(v_recebido - r.unid * v_custo_unid, 2);

  -- sales per hour of the day (Brasília), for the small chart
  select coalesce(jsonb_agg(jsonb_build_object('h', h, 'unid', unid, 'valor', valor) order by h), '[]'::jsonb) into v_horas
    from (select extract(hour from created_at at time zone 'America/Sao_Paulo')::int as h,
                 sum(case when method <> 'gorjeta' and not coalesce(late, false) then coalesce(qty, 1) else 0 end) as unid,
                 sum(amount) as valor
            from public.defcon_sales where user_id = u and (created_at at time zone 'America/Sao_Paulo')::date = p_dia
           group by 1) z;
  select x into v_melhor from jsonb_array_elements(v_horas) x order by (x ->> 'valor')::numeric desc limit 1;

  return jsonb_build_object(
    'dia', p_dia, 'hoje', p_dia = hoje, 'futuro', p_dia > hoje,
    'trabalha', v_trabalha, 'plano_unid', v_plano_unid, 'plano_lucro', round(v_plano_unid * o.lucro_unid, 2),
    'unid', r.unid, 'vendas', r.vendas, 'vendido', round(r.vendido, 2), 'recebido', round(v_recebido, 2),
    'dinheiro', round(r.dinheiro, 2), 'pix', round(r.pix, 2), 'cartao', round(r.cartao, 2), 'gorjeta', round(r.gorjeta, 2), 'fiado', round(r.fiado, 2),
    'calote', round(v_calote, 2), 'custo', round(r.unid * v_custo_unid, 2), 'custo_unid', round(v_custo_unid, 2),
    'lucro', v_lucro, 'bateu', v_trabalha and v_plano_unid > 0 and r.unid >= v_plano_unid,
    'fonte', v_fonte,
    'inicio', s.inicio, 'fim', s.fim, 'minutos', s.minutos,
    'horas', v_horas, 'melhor_hora', (v_melhor ->> 'h')::int
  );
end $$;
revoke all on function public.objetivo_lucro_dia(uuid, date) from public, anon;
grant execute on function public.objetivo_lucro_dia(uuid, date) to authenticated;
