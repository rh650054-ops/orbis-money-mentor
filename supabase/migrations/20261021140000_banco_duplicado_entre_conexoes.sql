-- 21/10/2026 — the same bank connected more than once (Nicolle: Mercado Pago 3x) hid
-- almost every Pix. The old rule dropped an entry whenever ANOTHER connection had an
-- entry with the same value/day/description and a smaller id. With many R$10 Pix on the
-- same day (Mercado Pago has no time of day), nearly all of them were dropped:
-- 20/10 showed R$85 of Pix when the bank had R$440.
-- New rule: inside each (value, day, description), the 1st entry of connection A pairs with
-- the 1st of connection B, the 2nd with the 2nd... one of each pair counts. The total is
-- the largest count among the connections — duplicate connections count once, nothing is lost.
create or replace function public.banco_entradas_detalhe(p_user uuid, p_de date, p_ate date)
 returns table(dia date, amount numeric, maq boolean, quando timestamp with time zone, visto_em timestamp with time zone)
 language sql stable security definer set search_path to 'public'
as $function$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  vendeu as (
    select ds.date as d from public.daily_sales ds
     where ds.user_id = p_user and ds.date between p_de - 3 and p_ate + 3
       and coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) > 0
  ),
  cand as (
    select a.amount, a.transaction_date, a.transaction_id, a.bank_connection_id, a.created_at as visto,
           a.transacted_at, lower(coalesce(a.description, '')) as chave_desc,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           row_number() over (partition by a.bank_connection_id, a.amount, a.transaction_date, lower(coalesce(a.description, ''))
                              order by a.transacted_at nulls last, a.transaction_id) as rn
    from public.banco_entradas_classificadas(p_user, p_de, p_ate + 1) a
    where a.motivo is null
  ),
  pareado as (
    select c.*,
           row_number() over (partition by c.amount, c.transaction_date, c.chave_desc, c.rn
                              order by (c.transacted_at is null), c.bank_connection_id) as pos
    from cand c
  ),
  base as (
    select p.amount, p.transaction_date, p.visto, p.maq,
           case
             when p.transacted_at is not null
                  and (p.transacted_at at time zone 'America/Sao_Paulo')::time = time '00:00' then null
             else coalesce(p.transacted_at,
               case when (p.visto at time zone 'America/Sao_Paulo')::date <= p.transaction_date + 1 then p.visto end)
           end as quando
    from pareado p
    where p.pos = 1
  ),
  tx as (
    select x.amount, x.maq, x.quando, x.visto,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
           (x.quando at time zone 'America/Sao_Paulo')::time as hora,
           (select s.d from sess s
             where x.quando is not null and s.ini <= x.quando
               and x.quando < (((s.d + 2)::timestamp) at time zone 'America/Sao_Paulo')
             order by s.ini desc limit 1) as dia_defcon,
           x.transaction_date
    from base x
  ),
  atribuido as (
    select t.amount, t.maq, t.quando, t.visto,
           case
             when t.quando is null then t.transaction_date
             when t.dia_defcon = t.dia_cal then t.dia_cal
             when exists (select 1 from sess s where s.d = t.dia_cal)
               then coalesce(t.dia_defcon, t.dia_cal - 1)
             when t.hora >= time '06:00' and exists (select 1 from vendeu v where v.d = t.dia_cal) then t.dia_cal
             when t.dia_defcon is not null then t.dia_defcon
             else t.dia_cal
           end as dia
    from tx t
  )
  select a.dia, a.amount, a.maq, a.quando, a.visto
    from atribuido a
   where a.dia between p_de and p_ate;
$function$;
