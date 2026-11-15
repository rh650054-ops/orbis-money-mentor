-- 15/11/2026: "está falando que estou com zero calote em alguns dias".
--
-- Cause: the reconcile computes the day's calote as typed sales − cash − what the bank saw.
-- An approved Pix that was NEVER typed (a resale paid by Pix, approved in banco_entradas_revisao)
-- made the bank side bigger than the typed side, so its money covered the calote of the street
-- sales. Real case 13/11: 422 typed, R$ 520 resale not typed, street Pix short by R$ 40 →
-- the report showed calote R$ 0 and "sold" R$ 902.
--
-- Fix: an approved Pix that no typed sale of the same value on the same day matches is a sale
-- "à parte": it is ADDED to what was sold that day. Then it can no longer cover anyone's calote,
-- and the ranking cap grows with it (a resale is not an excess).
-- An approved Pix that WAS typed (same value, same day) changes nothing: it is already in the typed sum.

create or replace function public.banco_vendas_a_parte(p_user uuid, p_dia date)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v numeric;
begin
  if not exists (
    select 1 from public.banco_entradas_revisao rv
      join public.auto_detected_sales a on a.transaction_id = rv.transaction_id
     where rv.status = 'aprovada' and a.user_id = p_user and a.transaction_date = p_dia) then
    return 0;
  end if;
  with ap as (
    select round(c.amount, 2) as valor,
           row_number() over (partition by round(c.amount, 2) order by c.transacted_at, c.transaction_id) as rn
      from public.banco_entradas_classificadas(p_user, p_dia, p_dia) c
      join public.banco_entradas_revisao rv on rv.transaction_id = c.transaction_id and rv.status = 'aprovada'
     where c.transaction_date = p_dia and c.motivo is null
  ),
  digitado as (
    select round(s.amount, 2) as valor, count(*) as n
      from public.challenge_sessions cs
      join public.defcon_sales s on s.session_id = cs.id and not coalesce(s.late, false)
     where cs.user_id = p_user and cs.date = p_dia
     group by 1
  )
  select coalesce(round(sum(ap.valor), 2), 0) into v
    from ap left join digitado d on d.valor = ap.valor
   where ap.rn > coalesce(d.n, 0);
  return v;
end $$;
revoke all on function public.banco_vendas_a_parte(uuid, date) from public, anon, authenticated;

-- typed sales of the day + approved sales that were never typed
create or replace function public.banco_lancado_dia(p_user uuid, p_dia date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(round(sum(ds.amount), 2), 0) + public.banco_vendas_a_parte(p_user, p_dia)
    from public.challenge_sessions cs
    join public.defcon_sales ds on ds.session_id = cs.id and not coalesce(ds.late, false)
   where cs.user_id = p_user and cs.date = p_dia;
$$;

-- same rule in the ranking cap (only the `lanc` part changes)
create or replace function public.ranking_valor_dias(p_de date, p_ate date, p_user uuid default null::uuid)
returns table(user_id uuid, dia date, valor numeric, pelo_banco boolean)
language sql stable security definer set search_path = public as $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ofi as (
    select bc.user_id,
           greatest(date_trunc('month', min((bc.created_at at time zone 'America/Sao_Paulo')::date))::date,
                    public.ranking_banco_desde()) as desde,
           min((bc.created_at at time zone 'America/Sao_Paulo')::date) as conectou
      from public.bank_connections bc
     where coalesce(bc.status, '') <> 'deleted'
       and (p_user is null or bc.user_id = p_user)
       and public.ranking_pode_verificar(bc.user_id)
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
    select cs.user_id, cs.date as dia, round(sum(s.amount), 2) + public.banco_vendas_a_parte(cs.user_id, cs.date) as v
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
            and c.leitura_ok_em >= (((ds.dia + 1)::timestamp) at time zone 'America/Sao_Paulo')
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
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia
    left join ofi o2 on o2.user_id = ds.user_id
    -- a day BEFORE the connection only counts by the bank when the bank shows money that day
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
                        and (ds.dia >= o2.conectou or coalesce(b.total, 0) > 0)
    left join lanc l on l.user_id = ds.user_id and l.dia = ds.dia;
$function$;
