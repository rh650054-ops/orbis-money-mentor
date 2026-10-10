-- ============================================================
-- "NÃO CAIU NO BANCO — FOI EM DINHEIRO?" — 10/10/2026
--
-- Rick, 10/10: vendeu R$ 1.053 (47 vendas, todas lançadas como Pix no Foco),
-- o banco viu R$ 526, e o resto (R$ 527) virou calote. Parte era dinheiro:
-- com o Pix travado o fechamento só aceita dinheiro digitado, e ele não digitou.
-- Esta função deixa o vendedor dizer depois do fechamento quanto do que "não
-- caiu" foi em dinheiro: sai do calote e entra no dinheiro do dia (e no
-- relatório por hora, no ranking e no lucro). banco_reconciliar respeita o
-- dinheiro digitado, então a próxima leitura do banco não desfaz isso.
-- Idempotente, sem comandos de apagar.
-- ============================================================

create or replace function public.dia_marcar_dinheiro(p_dia date, p_valor numeric)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  ds record;
  v numeric;
  v_plan uuid;
  v_calote_blocos numeric;
  m text := to_char(p_dia, 'YYYY-MM');
begin
  if v_uid is null then raise exception 'sem_login'; end if;
  if p_valor is null or p_valor <= 0 then return 0; end if;

  select id, coalesce(total_debt, 0) as debt into ds
    from public.daily_sales where user_id = v_uid and date = p_dia;
  if not found then return 0; end if;

  v := round(least(p_valor, ds.debt), 2);
  if v <= 0 then return 0; end if;

  update public.daily_sales
     set cash_sales = round(coalesce(cash_sales, 0) + v, 2),
         total_debt = round(coalesce(total_debt, 0) - v, 2),
         total_profit = round(coalesce(total_profit, 0) + v, 2),
         unpaid_sales = case when coalesce(total_debt, 0) - v > 0.004 then 1 else 0 end,
         updated_at = now()
   where id = ds.id;

  -- relatório por hora: o calote de cada bloco vira dinheiro, na mesma proporção
  select p.id into v_plan from public.daily_goal_plans p where p.user_id = v_uid and p.date = p_dia limit 1;
  if v_plan is not null then
    select sum(coalesce(valor_calote, 0)) into v_calote_blocos from public.hourly_goal_blocks where plan_id = v_plan;
    if coalesce(v_calote_blocos, 0) > 0 then
      update public.hourly_goal_blocks b
         set valor_dinheiro = round(coalesce(b.valor_dinheiro, 0) + v * coalesce(b.valor_calote, 0) / v_calote_blocos, 2),
             valor_calote   = round(greatest(coalesce(b.valor_calote, 0) - v * coalesce(b.valor_calote, 0) / v_calote_blocos, 0), 2)
       where b.plan_id = v_plan and coalesce(b.valor_calote, 0) > 0;
    end if;
  end if;

  -- ranking do mês: dinheiro + cartão + Pix (mesma conta do app)
  update public.leaderboard_stats ls
     set faturamento_total_mes = coalesce((
           select sum(coalesce(d.cash_sales, 0) + coalesce(d.card_sales, 0) + coalesce(d.pix_sales, 0))
             from public.daily_sales d
            where d.user_id = v_uid and to_char(d.date, 'YYYY-MM') = m), 0)
   where ls.user_id = v_uid and ls.mes_referencia = m;
  perform public.recalculate_ranking_positions(m);

  return v;
end $$;

revoke all on function public.dia_marcar_dinheiro(date, numeric) from public, anon;
grant execute on function public.dia_marcar_dinheiro(date, numeric) to authenticated;
