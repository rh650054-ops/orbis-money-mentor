-- 22/10/2026 (Casal do Sinal, Lucas dos Reis): quem ligou o banco teve os dias ANTERIORES à conexão
-- auditados. O banco não tem extrato desses dias, então todo o Pix virou calote (R$ 2.071 e R$ 2.038).
-- Regra nova: só audita a partir do dia em que o banco foi ligado. E desfaz o estrago.
CREATE OR REPLACE FUNCTION public.banco_reconciliar(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    from public.bank_connections bc where bc.user_id = p_user and coalesce(bc.status, '') <> 'deleted';
  if v_ligou is null then return 0; end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix, coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.user_id = p_user
       and ds.date between greatest(hoje - 6, public.ranking_banco_desde(), v_ligou) and hoje - 1
       and not ds.pix_manual
       and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
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

-- Desfaz: dias antes da conexão, sem nenhuma entrada do banco, que viraram calote na auditoria.
-- (O Foco desses dois não tem calote lançado: todo o "calote" desses dias veio da auditoria.)
with con as (
  select user_id, min((created_at at time zone 'America/Sao_Paulo')::date) desde
    from public.bank_connections where coalesce(status,'') <> 'deleted' group by 1
), alvo as (
  select d.id, d.user_id, d.date, coalesce(d.total_debt,0) debt
    from public.daily_sales d join con on con.user_id = d.user_id
   where d.user_id in ('abd24a0f-8513-4be0-8248-7e271597ba10','3cebf8c3-248d-45e8-b9ac-91d1ffeebfc1')
     and d.date < con.desde and d.date >= '2026-10-11' and coalesce(d.total_debt,0) > 0
     and not exists (select 1 from public.banco_entradas_por_dia(d.user_id, d.date, d.date) x where x.total > 0)
), dias as (
  update public.daily_sales d
     set pix_sales = round(coalesce(d.pix_sales,0) + a.debt, 2), total_debt = 0, unpaid_sales = 0,
         total_profit = round(coalesce(d.cash_sales,0) + coalesce(d.card_sales,0) + coalesce(d.pix_sales,0) + a.debt, 2),
         updated_at = now()
    from alvo a where d.id = a.id
  returning d.user_id, d.date
)
update public.hourly_goal_blocks b
   set valor_pix = round(coalesce(b.valor_pix,0) + coalesce(b.valor_calote,0), 2), valor_calote = 0
  from public.daily_goal_plans p, dias
 where b.plan_id = p.id and p.user_id = dias.user_id and p.date = dias.date;

select public.ranking_atualizar('abd24a0f-8513-4be0-8248-7e271597ba10', '2026-10');
select public.ranking_atualizar('3cebf8c3-248d-45e8-b9ac-91d1ffeebfc1', '2026-10');
select public.recalculate_ranking_positions('2026-10');
select public.ranking_cache_atualizar(45);
