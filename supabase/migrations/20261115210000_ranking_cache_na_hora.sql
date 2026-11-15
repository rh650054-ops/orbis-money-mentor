-- 15/11/2026: the ranking screen shows two numbers for the same seller for up to an hour.
-- leaderboard_stats (opened first) is updated by ranking_atualizar the moment a day is
-- recalculated (reconcile, Pix approval). The live list reads ranking_dia_cache, which only the
-- hourly cron (:25) refreshes. Real case: after two Pix were approved, 4.830 (16th) stored vs
-- 3.992 (22nd) live until the next :25.
--
-- Fix: ranking_atualizar computes the month once and writes BOTH: the month total and that
-- seller's cache rows for the closed days (never a day frozen by a homologated prize, never today).
-- Same values the cron would write; it just doesn't wait for it.

create or replace function public.ranking_atualizar(p_user uuid, p_mes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_de date := (p_mes || '-01')::date;
  v_ate date := ((p_mes || '-01')::date + interval '1 month' - interval '1 day')::date;
  v_congelado date := coalesce(public.ranking_congelado_ate(), date '1900-01-01');
begin
  with r as (
    select x.dia, coalesce(x.valor, 0) as valor, coalesce(x.pelo_banco, false) as pelo_banco
      from public.ranking_valor_dias(v_de, v_ate, p_user) x
     where x.dia is not null
  ),
  cache as (
    insert into public.ranking_dia_cache (user_id, dia, valor, pelo_banco, atualizado_em)
    select p_user, r.dia, r.valor, r.pelo_banco, now() from r
     where r.dia < hoje and r.dia > v_congelado
    on conflict (user_id, dia) do update
      set valor = excluded.valor, pelo_banco = excluded.pelo_banco, atualizado_em = now()
      where public.ranking_dia_cache.valor is distinct from excluded.valor
         or public.ranking_dia_cache.pelo_banco is distinct from excluded.pelo_banco
  )  -- a data-modifying CTE always runs, even when the update below changes nothing
  update public.leaderboard_stats ls
     set faturamento_total_mes = t.total
    from (select coalesce(sum(r.valor), 0)::numeric as total from r) t
   where ls.user_id = p_user and ls.mes_referencia = p_mes
     and ls.faturamento_total_mes is distinct from t.total;
end $$;
