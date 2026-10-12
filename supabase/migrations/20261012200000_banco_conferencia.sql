-- ============================================================
-- CONFERIDO PELO BANCO — cartão do relatório (Mohamed 09/10, refeito 12/10/2026)
-- Substitui o PR #80: o ranking pelo banco JÁ está no ar (ranking_valor_dias,
-- migrações ranking_so_o_que_caiu + banco_no_ranking_desde_11_10). Daquele PR só
-- faltava o relatório. Esta função NÃO muda nenhuma regra: só mostra, dia a dia,
-- o que as regras atuais já calculam —
--   lançou × caiu no banco (com a regra "antes do Foco é do dia anterior") ×
--   o que foi pro ranking × o que faltou cair.
-- Só aparecem os dias que o ranking contou pelo banco (pelo_banco = true), então o
-- número "conta no ranking" é exatamente o do placar. Só leitura, só a própria conta.
-- ============================================================

create or replace function public.banco_conferencia(p_de date, p_ate date)
returns table(dia date, lancou numeric, pix_cartao numeric, dinheiro numeric, caiu numeric, maquininha numeric,
              conta_ranking numeric, faltou numeric)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
begin
  -- sem login não roda (ranking_valor_dias com usuário nulo leria todo mundo)
  if u is null or p_ate < p_de or p_ate - p_de > 400 then
    return;
  end if;

  return query
  with r as (
    select x.dia, x.valor from public.ranking_valor_dias(p_de, p_ate, u) x where x.pelo_banco
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
   order by ds.d;
end $$;
revoke all on function public.banco_conferencia(date, date) from public, anon;
grant execute on function public.banco_conferencia(date, date) to authenticated;
