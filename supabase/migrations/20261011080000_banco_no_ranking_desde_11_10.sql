-- ============================================================
-- O BANCO SÓ MANDA NO RANKING A PARTIR DE 11/10/2026
-- Rick (11/10 04:08): "todo mundo do open finance vai o valor que eles fizeram,
-- mas a regra começa a contar a partir de hoje sem chance de erro, ninguém pode
-- editar essas regras".
--   • dias ANTES de 11/10: ranking = o que a pessoa lançou (todo mundo igual)
--   • de 11/10 em diante: dia passado com banco = o que caiu (regra de ontem)
-- A data é constante dentro das funções (não existe tabela nem flag pra mudar).
-- Também devolve ao lançado os dias 09 e 10/10 que o banco já tinha conferido.
-- Idempotente, sem comandos de apagar.
-- ============================================================

create or replace function public.ranking_banco_desde()
returns date language sql immutable as $$ select date '2026-10-11' $$;
revoke all on function public.ranking_banco_desde() from public, anon, authenticated;

create or replace function public.ranking_valor_dias(p_de date, p_ate date, p_user uuid default null)
returns table(user_id uuid, dia date, valor numeric, pelo_banco boolean)
language sql stable security definer set search_path to 'public' as $$
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
    select d.user_id, d.date::date as dia,
           sum(coalesce(d.total_profit, 0))::numeric as recebido,
           sum(coalesce(d.total_profit, 0) + coalesce(d.total_debt, 0))::numeric as vend,
           sum(coalesce(d.cash_sales, 0))::numeric as din
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
         case when e.user_id is not null
              then round(least(coalesce(b.total, 0), greatest(ds.vend - ds.din, 0)), 2)
              else round(ds.recebido, 2) end,
         e.user_id is not null
    from ds
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia;
$$;
revoke all on function public.ranking_valor_dias(date, date, uuid) from public, anon, authenticated;

-- a conciliação da meia-noite também só mexe de 11/10 em diante
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
      and ds.date between greatest(hoje - 6, public.ranking_banco_desde()) and hoje - 1
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
    perform public.ranking_atualizar(p_user, m);
    perform public.recalculate_ranking_positions(m);
  end loop;

  return n;
end $$;
revoke all on function public.banco_reconciliar(uuid) from public, anon, authenticated;

-- fez × caiu: "conferido" só de 11/10 em diante
create or replace function public.vender_fez_caiu(p_dias integer default 7)
returns table(dia date, fez numeric, dinheiro numeric, caiu numeric, conferido boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - greatest(1, least(coalesce(p_dias, 7), 31)) + 1;
  tem_banco boolean;
begin
  if u is null then return; end if;
  tem_banco := (public.orbis_pro_ativo(u) or public.open_finance_teste(u))
    and exists (select 1 from public.bank_connections bc
                where bc.user_id = u and coalesce(bc.status, '') <> 'deleted');

  return query
  with v as (
    select ds.date as d,
           round(coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0), 2) as fez,
           round(coalesce(ds.cash_sales, 0), 2) as din
      from public.daily_sales ds
     where ds.user_id = u and ds.date between de and hoje
  ),
  b as (
    select x.dia as d, round(coalesce(x.total, 0), 2) as caiu
      from public.banco_entradas_por_dia(u, de, hoje) x
     where tem_banco
  )
  select coalesce(v.d, b.d) as dia,
         coalesce(v.fez, 0) as fez,
         coalesce(v.din, 0) as dinheiro,
         case when tem_banco then coalesce(b.caiu, 0) else null end as caiu,
         coalesce(v.d, b.d) < hoje and coalesce(v.d, b.d) >= public.ranking_banco_desde() as conferido
    from v full join b on b.d = v.d
   where coalesce(v.fez, 0) > 0
   order by 1 desc;
end $$;
revoke all on function public.vender_fez_caiu(integer) from public, anon;
grant execute on function public.vender_fez_caiu(integer) to authenticated;

-- 09 e 10/10: o que o banco já tinha conferido volta ao lançado (todo mundo com banco)
do $$
declare r record; v_plan uuid; v_pix numeric; meses text[] := '{}'; m text;
begin
  for r in
    select ds.id, ds.user_id, ds.date, coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.date >= date '2026-10-09' and ds.date < public.ranking_banco_desde()
       and coalesce(ds.total_debt, 0) > 0 and not ds.pix_manual
       and exists (select 1 from public.bank_connections bc where bc.user_id = ds.user_id and coalesce(bc.status, '') <> 'deleted')
  loop
    v_pix := round(greatest(r.vend - r.din - r.card, 0), 2);
    update public.daily_sales
       set pix_sales = v_pix, total_debt = 0, unpaid_sales = 0,
           total_profit = round(r.din + r.card + v_pix, 2), updated_at = now()
     where id = r.id;
    select p.id into v_plan from public.daily_goal_plans p where p.user_id = r.user_id and p.date = r.date limit 1;
    if v_plan is not null then
      update public.hourly_goal_blocks b
         set valor_pix = round(coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0), 2), valor_calote = 0
       where b.plan_id = v_plan and coalesce(b.valor_calote, 0) > 0;
    end if;
    m := to_char(r.date, 'YYYY-MM');
    if not (m = any(meses)) then meses := meses || m; end if;
  end loop;
end $$;

select public.ranking_virada();
