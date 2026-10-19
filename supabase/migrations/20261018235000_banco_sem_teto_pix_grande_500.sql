-- 18/10/2026 23:36 (Rick): "no pix pode cair valores a mais sim do que ele fez no
-- foco, pois tem gente que manda a mais. Pix acima de 500 mandado de uma vez vai pra
-- análise." So:
--   • no daily cap: every valid Pix/card that fell counts (replaces the R$ 500/day
--     margin from 20261018234000, which is dropped);
--   • a SINGLE Pix above R$ 500 is held ('grande') until approved in
--     banco_entradas_revisao (was: above greatest(500, 20 × ticket));
--   • calote = launched in the Foco − cash − card − Pix (never below 0).

-- 1) classifier: flat R$ 500 per Pix
do $$
declare d text;
begin
  select pg_get_functiondef('public.banco_entradas_classificadas'::regproc) into d;
  d := replace(d, 'when b.amount > greatest(500, 20 * pf.ticket)', 'when b.amount > 500');
  execute d;
end $$;

alter table public.banco_entradas_revisao add column if not exists avisado_em timestamptz;

-- 2) midnight reconcile without cap
create or replace function public.banco_reconciliar(p_user uuid)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; e record;
  v_lanc numeric;
  v_card numeric; v_pix numeric; v_debt numeric;
  v_plan uuid; v_tot numeric;
  n integer := 0; meses text[] := '{}'; m text;
begin
  if not (public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)) then return 0; end if;
  if not exists (select 1 from public.bank_connections bc where bc.user_id = p_user and coalesce(bc.status, '') <> 'deleted') then
    return 0;
  end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix, coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.user_id = p_user
       and ds.date between greatest(hoje - 6, public.ranking_banco_desde()) and hoje - 1
       and not ds.pix_manual
       and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
  loop
    select coalesce(sum(x.pix), 0) as pix, coalesce(sum(x.maquininha), 0) as maq
      into e from public.banco_entradas_por_dia(p_user, r.date, r.date) x;

    v_lanc := public.banco_lancado_dia(p_user, r.date);
    if v_lanc <= 0 then v_lanc := r.vend; end if;

    v_card := round(e.maq, 2);
    v_pix  := round(e.pix, 2);
    v_debt := round(greatest(v_lanc - r.din - v_card - v_pix, 0), 2);

    if abs(v_card - r.card) < 0.005 and abs(v_pix - r.pix) < 0.005 and abs(v_debt - r.debt) < 0.005 then
      continue;
    end if;

    update public.daily_sales
       set card_sales = v_card, pix_sales = v_pix, total_debt = v_debt,
           total_profit = round(r.din + v_card + v_pix, 2),
           unpaid_sales = case when v_debt > 0 then 1 else 0 end,
           updated_at = now()
     where id = r.id;

    select p.id into v_plan from public.daily_goal_plans p where p.user_id = p_user and p.date = r.date limit 1;
    if v_plan is not null then
      select sum(coalesce(b.valor_dinheiro, 0) + coalesce(b.valor_cartao, 0) + coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0))
        into v_tot from public.hourly_goal_blocks b where b.plan_id = v_plan;
      if coalesce(v_tot, 0) > 0 then
        update public.hourly_goal_blocks b
           set valor_dinheiro = round(r.din * s.parte, 2),
               valor_cartao   = round(v_card * s.parte, 2),
               valor_pix      = round(v_pix * s.parte, 2),
               valor_calote   = round(v_debt * s.parte, 2),
               achieved_amount = round((r.din + v_card + v_pix + v_debt) * s.parte, 2)
          from (select hb.id,
                       (coalesce(hb.valor_dinheiro, 0) + coalesce(hb.valor_cartao, 0) + coalesce(hb.valor_pix, 0) + coalesce(hb.valor_calote, 0)) / v_tot as parte
                  from public.hourly_goal_blocks hb where hb.plan_id = v_plan) s
         where b.id = s.id;
      end if;
    end if;

    n := n + 1;
    m := to_char(r.date, 'YYYY-MM');
    if not (m = any(meses)) then meses := meses || m; end if;
  end loop;

  foreach m in array meses loop
    perform public.ranking_atualizar(p_user, m);
    perform public.recalculate_ranking_positions(m);
  end loop;
  return n;
end $function$;

-- 3) ranking: past bank days = everything valid that fell (Pix + card)
create or replace function public.ranking_valor_dias(p_de date, p_ate date, p_user uuid default null::uuid)
returns table(user_id uuid, dia date, valor numeric, pelo_banco boolean)
language sql stable security definer set search_path to 'public' as $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ofi as (
    select bc.user_id, greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), public.ranking_banco_desde()) as desde
      from public.bank_connections bc
     where coalesce(bc.status, '') <> 'deleted'
       and (p_user is null or bc.user_id = p_user)
       and (public.orbis_pro_ativo(bc.user_id) or public.open_finance_teste(bc.user_id))
     group by bc.user_id
  ),
  ds as (
    select d.user_id, d.date::date as dia, sum(coalesce(d.total_profit, 0))::numeric as recebido
      from public.daily_sales d
     where d.date::date between p_de and p_ate
       and (p_user is null or d.user_id = p_user)
     group by d.user_id, d.date::date
  ),
  elegivel as (
    select ds.user_id, ds.dia
      from ds join ofi o on o.user_id = ds.user_id
     where ds.dia >= o.desde and ds.dia < (select d from hoje)
       and exists (
         select 1 from public.bank_connections c
          where c.user_id = ds.user_id and coalesce(c.status, '') <> 'deleted'
            and c.last_synced_at >= (((ds.dia + 1)::timestamp) at time zone 'America/Sao_Paulo')
            and public.banco_conta_de_venda(c.id, null)
            and exists (select 1 from public.auto_detected_sales a where a.bank_connection_id = c.id))
  ),
  banco as (
    select o.user_id, x.dia, x.total
      from ofi o
      cross join lateral public.banco_entradas_por_dia(o.user_id, greatest(p_de, o.desde), least(p_ate, (select d from hoje) - 1)) x
     where greatest(p_de, o.desde) <= least(p_ate, (select d from hoje) - 1)
  )
  select ds.user_id, ds.dia,
         case when e.user_id is not null then round(coalesce(b.total, 0), 2) else round(ds.recebido, 2) end,
         e.user_id is not null
    from ds
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia;
$function$;

-- 4) the day-margin pieces are gone
drop function if exists public.banco_excessos(date, date);
drop table if exists public.banco_excesso_ok;
drop table if exists public.banco_excesso_avisado;
