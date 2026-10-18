-- Vender / Open Finance redesign (Rick, 18/10/2026).
-- 1) banco_entradas_detalhe: per-entry rows with the same attribution rules as
--    banco_entradas_por_dia, plus visto_em (when the Vant first saw the entry).
create or replace function public.banco_entradas_detalhe(p_user uuid, p_de date, p_ate date)
returns table(dia date, amount numeric, maq boolean, quando timestamptz, visto_em timestamptz)
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
  base as (
    select a.amount, a.transaction_date, a.transaction_id, a.bank_connection_id, a.created_at as visto,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.banco_entradas_classificadas(p_user, p_de, p_ate + 1) a
    where a.motivo is null
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = p_user
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at))
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
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
revoke all on function public.banco_entradas_detalhe(uuid, date, date) from public, anon, authenticated;

-- 2) banco_entradas_por_dia becomes an aggregate of the detail, so the ranking, the
--    report and the Vender screen can never disagree. Same signature and output.
create or replace function public.banco_entradas_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, pix numeric, maquininha numeric, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  select d.dia,
         coalesce(sum(d.amount) filter (where not d.maq), 0)::numeric,
         coalesce(sum(d.amount) filter (where d.maq), 0)::numeric,
         sum(d.amount)::numeric,
         count(*)::int,
         max(d.quando)
    from public.banco_entradas_detalhe(p_user, p_de, p_ate) d
   group by d.dia;
$function$;

-- 3) vender_conciliacao: everything the Vender screen shows, from one source.
--    Per day: what was sold (fez), cash in hand (dinheiro), what landed in work
--    accounts (caiu), how much of that landed only after the day closed (depois),
--    and Pix that landed in accounts marked personal (pessoal, a hint only).
--    Fixes: the old hero compared the bank with total sales INCLUDING cash, so cash
--    sales showed up as "ainda não caíram".
create or replace function public.vender_conciliacao(p_dias integer default 7)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - greatest(1, least(coalesce(p_dias, 7), 31)) + 1;
  tem_banco boolean;
  resultado jsonb;
begin
  if u is null then return null; end if;
  tem_banco := (public.orbis_pro_ativo(u) or public.open_finance_teste(u))
    and exists (select 1 from public.bank_connections bc where bc.user_id = u and coalesce(bc.status, '') <> 'deleted');

  with v as (
    select ds.date as d,
           round(coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0), 2) as fez,
           round(coalesce(ds.cash_sales, 0), 2) as din
      from public.daily_sales ds where ds.user_id = u and ds.date between de and hoje
  ),
  foco as (  -- during the Foco daily_sales can lag behind the session
    select cs.date as d, round(sum(coalesce(cs.total_sold, 0)), 2) as vendido
      from public.challenge_sessions cs where cs.user_id = u and cs.date between hoje - 1 and hoje
     group by cs.date
  ),
  det as (select * from public.banco_entradas_detalhe(u, de, hoje) where tem_banco),
  b as (
    select d.dia as d, round(sum(d.amount), 2) as caiu, count(*)::int as qtd,
           round(coalesce(sum(d.amount) filter (
             where d.visto_em >= ((d.dia + 1)::timestamp at time zone 'America/Sao_Paulo')), 0), 2) as depois
      from det d group by d.dia
  ),
  p as (
    select c.transaction_date as d, round(sum(c.amount), 2) as pessoal
      from public.banco_entradas_classificadas(u, de, hoje) c
     where tem_banco and c.motivo = 'conta_pessoal' and c.transaction_date between de and hoje
     group by c.transaction_date
  ),
  dias as (
    select coalesce(v.d, f.d, b.d) as dia,
           greatest(coalesce(v.fez, 0), coalesce(f.vendido, 0)) as fez,
           coalesce(v.din, 0) as dinheiro,
           case when tem_banco then coalesce(b.caiu, 0) end as caiu,
           coalesce(b.depois, 0) as depois,
           coalesce(b.qtd, 0) as qtd
      from v full join foco f on f.d = v.d full join b on b.d = coalesce(v.d, f.d)
  )
  select jsonb_build_object(
    'hoje', hoje,
    'tem_banco', tem_banco,
    'ultima_leitura', (select max(last_synced_at) from public.bank_connections
                        where user_id = u and coalesce(status, '') <> 'deleted'),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', x.dia, 'fez', x.fez, 'dinheiro', x.dinheiro, 'caiu', x.caiu,
               'depois', x.depois, 'qtd', x.qtd, 'pessoal', coalesce(p.pessoal, 0),
               'conferido', x.dia < hoje and x.dia >= public.ranking_banco_desde())
             order by x.dia desc)
        from dias x left join p on p.d = x.dia
       where x.fez > 0 or x.dia >= hoje - 1), '[]'::jsonb)
  ) into resultado;
  return resultado;
end $function$;
revoke all on function public.vender_conciliacao(integer) from public, anon;
grant execute on function public.vender_conciliacao(integer) to authenticated;
