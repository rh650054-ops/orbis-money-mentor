-- ============================================================
-- Calote "caiu depois" read from the bank (Rick, 19/10/2026): "quem não tem Open
-- Finance coloca no manual; quem tem, vai automático".
--
-- For each bank day of the logged user (same eligibility as the ranking):
--   falta_no_fim = launched in the Foco − cash − what the bank saw until the Foco closed
--   recuperado   = min(what fell after the close, falta_no_fim)
-- daily_sales.total_debt is already reconciled with everything that fell (before and
-- after the close), so on screen: calote total = total_debt + recuperado,
-- perdido = total_debt, caiu depois = recuperado.
-- Read only.
-- ============================================================
create or replace function public.relatorio_calote_banco(p_de date, p_ate date)
returns table(dia date, recuperado numeric, n integer)
language sql stable security definer set search_path = public as $$
  with u as (select auth.uid() as id),
  dias as (
    select r.dia from public.ranking_valor_dias(p_de, p_ate, (select id from u)) r
     where r.pelo_banco and (select id from u) is not null and p_ate >= p_de and p_ate - p_de <= 400
  ),
  fim as (
    select cs.date as d, max(cs.ended_at) as fim from public.challenge_sessions cs
     where cs.user_id = (select id from u) and cs.date between p_de and p_ate and cs.ended_at is not null
     group by cs.date
  ),
  e as (
    select x.dia, x.amount, x.quando > f.fim as depois
      from public.banco_entradas_detalhe((select id from u), p_de, p_ate) x
      join fim f on f.d = x.dia
     where x.dia in (select dia from dias)
  ),
  t as (
    select e.dia,
           coalesce(sum(e.amount) filter (where not coalesce(e.depois, false)), 0) as antes,
           coalesce(sum(e.amount) filter (where e.depois), 0) as depois,
           count(*) filter (where e.depois)::int as n
      from e group by e.dia
  )
  select t.dia,
         round(least(t.depois, greatest(
           coalesce(nullif(public.banco_lancado_dia((select id from u), t.dia), 0),
                    (select coalesce(s.total_profit, 0) + coalesce(s.total_debt, 0) from public.daily_sales s
                      where s.user_id = (select id from u) and s.date = t.dia))
           - coalesce((select s.cash_sales from public.daily_sales s where s.user_id = (select id from u) and s.date = t.dia), 0)
           - t.antes, 0)), 2),
         t.n
    from t
   where t.depois > 0;
$$;
revoke all on function public.relatorio_calote_banco(date, date) from public, anon;
grant execute on function public.relatorio_calote_banco(date, date) to authenticated;
