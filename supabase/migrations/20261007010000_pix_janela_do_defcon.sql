-- Bank Pix (Open Finance) is attributed to the DEFCON window, not the calendar day (Rick, 06/10/2026).
--
-- Rule:
--   * A Pix belongs to the most recent DEFCON whose start is <= the Pix time.
--     It keeps belonging to that day until the next DEFCON starts (late Pix after
--     closing the Foco lands in the right day, no manual entry needed).
--     Safety cap: if no new DEFCON starts, the window closes at the end of the
--     following calendar day (a day off does not pile Pix onto an old day forever).
--   * A Pix that arrives BEFORE the day's DEFCON starts and is not covered by a
--     previous window does not count for that DEFCON (bug: R$ 20 already showing
--     right after INICIAR).
--   * Days with no DEFCON at all keep the calendar-day fallback.
create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  base as (
    select a.*,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
      -- 04/10: only Pix that landed in a WORK account (a personal account is never a sale)
      and public.banco_conta_de_venda(a.bank_connection_id, coalesce(a.transacted_at, a.created_at))
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = a.user_id
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at))
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.quando,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
           -- the DEFCON window this Pix falls in (latest start <= Pix, until the end of the next day)
           (select s.d from sess s
             where x.quando is not null and s.ini <= x.quando
               and x.quando < (((s.d + 2)::timestamp) at time zone 'America/Sao_Paulo')
             order by s.ini desc limit 1) as dia_defcon,
           x.transaction_date
    from base x
  ),
  atribuido as (
    select t.amount, t.quando,
           case
             when t.quando is null then t.transaction_date
             when t.dia_defcon is not null then t.dia_defcon
             -- arrived before that day's DEFCON started: not a sale of this Foco
             when exists (select 1 from sess s where s.d = t.dia_cal) then null
             else t.dia_cal
           end as dia
    from tx t
  )
  select a.dia, sum(a.amount)::numeric, count(*)::int, max(a.quando)
  from atribuido a
  where a.dia between p_de and p_ate
  group by a.dia;
$function$;
