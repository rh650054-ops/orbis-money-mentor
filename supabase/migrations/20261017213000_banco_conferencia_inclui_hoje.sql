-- 17/10/2026 21:30 (Rick): the report said "caiu no bolso R$ 561" on a day when
-- the bank had only seen R$ 424 of Pix. banco_conferencia only returned past days
-- (pelo_banco), so the report used the typed Pix for today. Now it also returns
-- TODAY for anyone whose bank counts (same eligibility as ranking_valor_dias):
-- caiu/maquininha come from the bank, conta_ranking stays the typed value
-- (ranking rule: today counts what was launched, midnight reconciles).
create or replace function public.banco_conferencia(p_de date, p_ate date)
returns table(dia date, lancou numeric, pix_cartao numeric, dinheiro numeric, caiu numeric, maquininha numeric, conta_ranking numeric, faltou numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if u is null or p_ate < p_de or p_ate - p_de > 400 then
    return;
  end if;

  return query
  with r as (
    select x.dia, x.valor, x.pelo_banco from public.ranking_valor_dias(p_de, p_ate, u) x
  ),
  -- bank that counts today: Pro (or test), a counting connection with entries
  banco_hoje as (
    select greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), public.ranking_banco_desde()) as desde
      from public.bank_connections bc
     where bc.user_id = u and coalesce(bc.status, '') <> 'deleted'
       and (public.orbis_pro_ativo(u) or public.open_finance_teste(u))
       and public.banco_conta_de_venda(bc.id, null)
       and exists (select 1 from public.auto_detected_sales a where a.bank_connection_id = bc.id)
  ),
  ds as (
    select s.date::date as d,
           sum(coalesce(s.total_profit, 0))::numeric as lancou,
           sum(coalesce(s.pix_sales, 0) + coalesce(s.card_sales, 0))::numeric as pix_cartao,
           sum(coalesce(s.cash_sales, 0))::numeric as dinheiro
      from public.daily_sales s
     where s.user_id = u and s.date::date between p_de and p_ate
     group by s.date::date
  ),
  e as (select * from public.banco_entradas_por_dia(u, p_de, p_ate))
  select ds.d, ds.lancou, ds.pix_cartao, ds.dinheiro,
         coalesce(e.total, 0)::numeric, coalesce(e.maquininha, 0)::numeric,
         r.valor,
         greatest(0, ds.pix_cartao - coalesce(e.total, 0))::numeric
    from ds
    join r on r.dia = ds.d
    left join e on e.dia = ds.d
   where ds.lancou > 0
     and (r.pelo_banco
          or (ds.d = hoje and exists (select 1 from banco_hoje b where b.desde is not null and ds.d >= b.desde)))
   order by ds.d;
end $$;
