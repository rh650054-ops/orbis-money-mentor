-- 18/10/2026 23:29 (Rick): no cap on what was launched anymore — the Pix that fell
-- counts — but when the bank shows MORE THAN R$ 500 above what was launched in the
-- Foco on a day, the excess waits for Rick's review ("passou de 500 me avisa").
--
-- Base = what was launched in the Foco (defcon_sales of that day's session), never
-- the reconciled daily_sales value: otherwise every reconcile would push the cap
-- R$ 500 higher. Days with no Foco sales fall back to the day's sold value.
--   allowed (Pix + card) = launched - cash + 500, unless the day is approved.
--   calote = launched - cash - card - pix (never below 0).

create table if not exists public.banco_excesso_ok (
  user_id uuid not null,
  dia date not null,
  aprovado_em timestamptz not null default now(),
  obs text,
  primary key (user_id, dia)
);
alter table public.banco_excesso_ok enable row level security;
revoke all on public.banco_excesso_ok from anon, authenticated;

create or replace function public.banco_lancado_dia(p_user uuid, p_dia date)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(round(sum(ds.amount), 2), 0)
    from public.challenge_sessions cs
    join public.defcon_sales ds on ds.session_id = cs.id and not coalesce(ds.late, false)
   where cs.user_id = p_user and cs.date = p_dia;
$$;
revoke all on function public.banco_lancado_dia(uuid, date) from public, anon, authenticated;

create or replace function public.banco_reconciliar(p_user uuid)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; e record;
  v_lanc numeric; v_teto numeric;
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
    select d.user_id, d.date::date as dia,
           sum(coalesce(d.total_profit, 0))::numeric as recebido,
           sum(coalesce(d.total_profit, 0) + coalesce(d.total_debt, 0))::numeric as vend,
           sum(coalesce(d.cash_sales, 0))::numeric as din
      from public.daily_sales d
     where d.date::date between p_de and p_ate
       and (p_user is null or d.user_id = p_user)
     group by d.user_id, d.date::date
  ),
  lanc as (
    select cs.user_id, cs.date as dia, round(sum(s.amount), 2) as v
      from public.challenge_sessions cs
      join public.defcon_sales s on s.session_id = cs.id and not coalesce(s.late, false)
     where cs.date between p_de and p_ate and (p_user is null or cs.user_id = p_user)
     group by cs.user_id, cs.date
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
         case
           when e.user_id is null then round(ds.recebido, 2)
           when exists (select 1 from public.banco_excesso_ok ok where ok.user_id = ds.user_id and ok.dia = ds.dia)
             then round(coalesce(b.total, 0), 2)
           else round(least(coalesce(b.total, 0),
                            greatest(coalesce(nullif(l.v, 0), ds.vend) - ds.din, 0) + 500), 2)
         end,
         e.user_id is not null
    from ds
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia
    left join lanc l on l.user_id = ds.user_id and l.dia = ds.dia;
$function$;

-- Days waiting for review: bank above launched by more than R$ 500 and not approved.
create or replace function public.banco_excessos(p_de date, p_ate date)
returns table(user_id uuid, nome text, dia date, lancado numeric, dinheiro numeric, banco numeric, excesso numeric, aprovado boolean)
language sql stable security definer set search_path to 'public' as $$
  with bu as (select distinct bc.user_id from public.bank_connections bc where coalesce(bc.status, '') <> 'deleted'),
  d as (
    select bu.user_id, x.dia, x.total from bu
    cross join lateral public.banco_entradas_por_dia(bu.user_id, p_de, p_ate) x
  )
  select d.user_id, coalesce(p.nickname, p.email), d.dia,
         public.banco_lancado_dia(d.user_id, d.dia), coalesce(s.cash_sales, 0), d.total,
         round(d.total - greatest(public.banco_lancado_dia(d.user_id, d.dia) - coalesce(s.cash_sales, 0), 0), 2),
         exists (select 1 from public.banco_excesso_ok o where o.user_id = d.user_id and o.dia = d.dia)
    from d
    left join public.daily_sales s on s.user_id = d.user_id and s.date = d.dia
    left join public.profiles p on p.user_id = d.user_id
   where d.total - greatest(public.banco_lancado_dia(d.user_id, d.dia) - coalesce(s.cash_sales, 0), 0) > 500
   order by d.dia desc, 7 desc;
$$;
revoke all on function public.banco_excessos(date, date) from public, anon, authenticated;
