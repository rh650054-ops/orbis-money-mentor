-- 17/11/2026: a seller's Mercado Pago card machine (Point) money never counted.
--
-- Mercado Pago Empresas reports each machine sale, when the money is released, as
-- "Liberação de dinheiro", "Liberação de dinheiro venda com pix" or
-- "Liberação de dinheiro venda com QR code". banco_eh_maquininha did not know these, so:
--   - "Liberação de dinheiro" (card sales) was not Pix and not machine → 'nao_e_venda';
--   - "... venda com pix" all share one "payer" (the text itself) → flagged 'recorrente'.
-- Real case 01–17/11: 165 releases, R$ 6.5k of machine sales left out; the report showed
-- R$ 2.8k of calote the seller never had. Only this seller has these entries today.
--
-- Fix (rule for everyone): those descriptions are card machine money. The usual protections
-- still apply: own transfers and refunds are checked before, and the ranking cap
-- (typed sales − cash + R$ 500) still limits each day.
--
-- Also: banco_reconciliar(user, since) redoes the days from a given date (SQL editor only),
-- because the normal reconcile only looks at the last 6 days.

create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path to 'public' as $function$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto|vendas? - dispon[ií]vel.*|venda presencial.*|vendas?: .+|vendas? com pix.*|libera[cç][aã]o de dinheiro( venda com (pix|qr ?code|cart[aã]o.*))?)$';
$function$;

-- the reconcile, from a given day (the 1-argument version keeps the last 6 days)
create or replace function public.banco_reconciliar(p_user uuid, p_desde date)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; e record;
  v_lanc numeric; v_teto numeric;
  v_card numeric; v_pix numeric; v_debt numeric;
  v_plan uuid; v_tot numeric;
  v_ligou date;
  n integer := 0; meses text[] := '{}'; m text;
begin
  if not (public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)) then return 0; end if;
  select min((bc.created_at at time zone 'America/Sao_Paulo')::date) into v_ligou
    from public.bank_connections bc where bc.user_id = p_user;
  if v_ligou is null then return 0; end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix, coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.user_id = p_user
       and ds.date between greatest(coalesce(p_desde, hoje - 6), public.ranking_banco_desde(), v_ligou) and hoje - 1
       and not ds.pix_manual
       and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
       and exists (select 1 from public.bank_connections c
                    where c.user_id = p_user and coalesce(c.status, '') <> 'deleted'
                      and c.leitura_ok_em >= (((ds.date + 1)::timestamp) at time zone 'America/Sao_Paulo'))
  loop
    select coalesce(sum(x.pix), 0) as pix, coalesce(sum(x.maquininha), 0) as maq
      into e from public.banco_entradas_por_dia(p_user, r.date, r.date) x;

    v_lanc := public.banco_lancado_dia(p_user, r.date);
    if v_lanc <= 0 then v_lanc := r.vend; end if;
    v_teto := case when exists (select 1 from public.banco_excesso_ok o where o.user_id = p_user and o.dia = r.date)
                   then null else greatest(v_lanc - r.din, 0) + 500 end;

    v_card := round(case when v_teto is null then e.maq else least(e.maq, v_teto) end, 2);
    v_pix  := round(case when v_teto is null then e.pix else least(e.pix, greatest(v_teto - v_card, 0)) end, 2);
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
revoke all on function public.banco_reconciliar(uuid, date) from public, anon, authenticated;

create or replace function public.banco_reconciliar(p_user uuid)
returns integer language sql security definer set search_path to 'public' as $function$
  select public.banco_reconciliar(p_user, null::date);
$function$;
