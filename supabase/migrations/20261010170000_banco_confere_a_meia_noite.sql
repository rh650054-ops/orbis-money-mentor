-- ============================================================
-- O BANCO CONFERE À MEIA-NOITE — 10/10/2026
--
-- Rick (10/10 15:55): "o valor diário que eu faço entra pro ranking normal sem
-- contar o Open Finance, pra todos os usuários. O valor que caiu realmente
-- atualiza só quando dá 00, aí sim o ranking atualiza só com os dados reais."
--   • No dia: o fechamento grava o que ele lançou (o Pix travado é o resto do
--     vendido: vendido − dinheiro − cartão da maquininha). Ranking, Início e
--     lucro do dia mostram o lançado.
--   • Da meia-noite em diante: banco_reconciliar troca os dias JÁ PASSADOS
--     pelo que caiu de verdade (Pix + maquininha); o resto vira calote. Pix
--     atrasado que cair depois continua tirando do calote (até 6 dias).
--   • Quem não tem banco: o lançado fica, como sempre.
-- Também devolve ao lançado os dias de HOJE que o banco já tinha conferido
-- (desde a migration de 09/10 o banco conferia no mesmo dia).
-- Idempotente, sem comandos de apagar.
-- ============================================================

-- 1) só dias passados
create or replace function public.banco_reconciliar(p_user uuid)
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  e record;
  v_card numeric; v_pix numeric; v_debt numeric;
  v_plan uuid; v_tot numeric;
  n integer := 0;
  meses text[] := '{}';
  m text;
begin
  if not (public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)) then return 0; end if;
  if not exists (select 1 from public.bank_connections bc
                 where bc.user_id = p_user and coalesce(bc.status, '') <> 'deleted') then
    return 0;
  end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din,
           coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix,
           coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
    from public.daily_sales ds
    where ds.user_id = p_user
      and ds.date between greatest(hoje - 6, date '2026-10-09') and hoje - 1
      and not ds.pix_manual
      and exists (select 1 from public.challenge_sessions cs
                  where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
  loop
    select coalesce(sum(x.pix), 0) as pix, coalesce(sum(x.maquininha), 0) as maq
      into e from public.banco_entradas_por_dia(p_user, r.date, r.date) x;

    v_card := round(least(e.maq, greatest(r.vend - r.din, 0)), 2);
    v_pix  := round(least(e.pix, greatest(r.vend - r.din - v_card, 0)), 2);
    v_debt := round(greatest(r.vend - r.din - v_card - v_pix, 0), 2);

    if abs(v_card - r.card) < 0.005 and abs(v_pix - r.pix) < 0.005 and abs(v_debt - r.debt) < 0.005 then
      continue;
    end if;

    update public.daily_sales
       set card_sales = v_card, pix_sales = v_pix, total_debt = v_debt,
           total_profit = round(r.din + v_card + v_pix, 2),
           unpaid_sales = case when v_debt > 0 then 1 else 0 end,
           updated_at = now()
     where id = r.id;

    select p.id into v_plan from public.daily_goal_plans p
     where p.user_id = p_user and p.date = r.date limit 1;
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
    update public.leaderboard_stats ls
       set faturamento_total_mes = coalesce((
             select sum(coalesce(ds.cash_sales, 0) + coalesce(ds.card_sales, 0) + coalesce(ds.pix_sales, 0))
               from public.daily_sales ds
              where ds.user_id = p_user and to_char(ds.date, 'YYYY-MM') = m), 0)
     where ls.user_id = p_user and ls.mes_referencia = m;
    perform public.recalculate_ranking_positions(m);
  end loop;

  return n;
end $$;

revoke all on function public.banco_reconciliar(uuid) from public, anon, authenticated;

-- 2) hoje volta ao lançado pra quem o banco já tinha conferido no mesmo dia
do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  v_plan uuid; v_tot numeric; v_pix numeric;
  mudou boolean := false;
begin
  for r in
    select ds.id, ds.user_id, coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.date = hoje and coalesce(ds.total_debt, 0) > 0 and not ds.pix_manual
       and exists (select 1 from public.bank_connections bc where bc.user_id = ds.user_id and coalesce(bc.status, '') <> 'deleted')
       and (public.orbis_pro_ativo(ds.user_id) or public.open_finance_teste(ds.user_id))
  loop
    v_pix := round(greatest(r.vend - r.din - r.card, 0), 2);
    update public.daily_sales
       set pix_sales = v_pix, total_debt = 0, unpaid_sales = 0,
           total_profit = round(r.din + r.card + v_pix, 2), updated_at = now()
     where id = r.id;
    select p.id into v_plan from public.daily_goal_plans p where p.user_id = r.user_id and p.date = hoje limit 1;
    if v_plan is not null then
      select sum(coalesce(b.valor_dinheiro, 0) + coalesce(b.valor_cartao, 0) + coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0))
        into v_tot from public.hourly_goal_blocks b where b.plan_id = v_plan;
      if coalesce(v_tot, 0) > 0 then
        update public.hourly_goal_blocks b
           set valor_pix = round(coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0), 2), valor_calote = 0
         where b.plan_id = v_plan and coalesce(b.valor_calote, 0) > 0;
      end if;
    end if;
    update public.leaderboard_stats ls
       set faturamento_total_mes = coalesce((
             select sum(coalesce(d.cash_sales, 0) + coalesce(d.card_sales, 0) + coalesce(d.pix_sales, 0))
               from public.daily_sales d
              where d.user_id = r.user_id and to_char(d.date, 'YYYY-MM') = to_char(hoje, 'YYYY-MM')), 0)
     where ls.user_id = r.user_id and ls.mes_referencia = to_char(hoje, 'YYYY-MM');
    mudou := true;
  end loop;
  if mudou then perform public.recalculate_ranking_positions(to_char(hoje, 'YYYY-MM')); end if;
end $$;
