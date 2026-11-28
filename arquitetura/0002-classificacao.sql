-- ADR 0002 §6 — classification of the sales left without a session by "Reiniciar o dia".
-- READ ONLY. Investigative heuristics approved by Rick (28/11/2026), NOT proof of duplication.
-- Never two sales are called repeated only for having the same value and payment method.
--
-- Universe: sales whose session no longer exists, created up to :corte (frozen cutoff, so every
-- run classifies the same universe; restarts after the cutoff stay out until the cutoff moves).
-- Cutoff of 28/11/2026: '2026-11-28 20:00:00+00' -> 1,987 sales, 295 sessions, 92 accounts,
-- R$ 150,544.98 (the first audit, at ~18:40 UTC, saw 1,982 / 294 / R$ 149,721.98: one restart of
-- R$ 823,00 happened between the two queries, 28/11 16:06-16:08 BRT).
--
-- Every sale gets exactly ONE class (one CASE, first rule that holds):
--   T  test                 account in apple_contas_de_teste or a review/test e-mail
--   C  confirmed legitimate linked to a machine payment (mp_vendas.defcon_sale_id)
--   R  possible repetition  it pairs with a sale of the day's live session AND its deleted session
--                           has >= 3 sales, >= 80% of them paired, and the paired re-entry took
--                           less than max(10 min, 1/3 of the deleted session's span)
--   I  inconclusive         it pairs, but its session does not meet the R thresholds
--   L  probable legitimate  no pair (no live session that day, or nothing repeated after it)
-- Pairing is 1 to 1 per account and day: the k-th deleted sale of a kind (value, method, product,
-- quantity; NULL product equal to NULL) pairs with the k-th live sale of that kind of the same day,
-- and only if the live sale was entered after its deleted session ended. A live sale never serves
-- two deleted sales (a day with several restarts is not counted several times).
--
-- Output: one row per sale with its evidence. Group by user_id for the per-account report.
with params as (select timestamptz '2026-11-28 20:00:00+00' as corte),
orf as (
  select d.id, d.user_id, d.session_id, d.amount, d.method, d.product_id, d.qty, d.created_at
    from public.defcon_sales d, params
   where d.session_id is not null and d.created_at <= params.corte
     and not exists (select 1 from public.challenge_sessions s where s.id = d.session_id)),
ses as (select session_id, user_id, (min(created_at) at time zone 'America/Sao_Paulo')::date dia, count(*) n,
               min(created_at) ini, max(created_at) fim from orf group by 1, 2),
viva as (select distinct s.user_id, s.dia, cs.id viva_id from ses s
           join public.challenge_sessions cs on cs.user_id = s.user_id and cs.date = s.dia),
novas as (select v.user_id, v.dia, d2.id nova_id, d2.amount, d2.method, d2.product_id, d2.qty, d2.created_at,
                 row_number() over (partition by v.user_id, v.dia, d2.amount, d2.method, d2.product_id, d2.qty order by d2.created_at) k
            from viva v join public.defcon_sales d2 on d2.session_id = v.viva_id),
velhas as (select o.*, s.dia, s.fim,
                  row_number() over (partition by o.user_id, s.dia, o.amount, o.method, o.product_id, o.qty order by o.created_at) k
             from orf o join ses s using (session_id)),
par as (select vl.id, case when n.created_at > vl.fim then n.nova_id end nova_id,
               case when n.created_at > vl.fim then n.created_at end nova_em
          from velhas vl left join novas n
            on n.user_id = vl.user_id and n.dia = vl.dia and n.amount = vl.amount and n.method = vl.method
           and n.product_id is not distinct from vl.product_id and n.qty is not distinct from vl.qty and n.k = vl.k),
sesm as (select s.*,
           (select count(*) from par p join orf o using (id) where o.session_id = s.session_id and p.nova_id is not null) casadas,
           (select max(p.nova_em) - min(p.nova_em) from par p join orf o using (id) where o.session_id = s.session_id and p.nova_id is not null) span_novo,
           exists (select 1 from viva v where v.user_id = s.user_id and v.dia = s.dia) tem_viva
         from ses s)
select o.id venda_id, o.user_id, o.session_id sessao_apagada, sm.dia, o.created_at, o.amount valor, o.method, o.product_id, o.qty,
  case
    when exists (select 1 from public.apple_contas_de_teste t where t.user_id = o.user_id)
      or exists (select 1 from public.profiles pf where pf.user_id = o.user_id and (pf.email ilike 'revisao%' or pf.email ilike 'teste%')) then 'T'
    when exists (select 1 from public.mp_vendas m where m.defcon_sale_id = o.id) then 'C'
    when p.nova_id is not null and sm.n >= 3 and sm.casadas >= ceil(0.8 * sm.n)
         and sm.span_novo < greatest(interval '10 minutes', (sm.fim - sm.ini) / 3) then 'R'
    when p.nova_id is not null then 'I'
    else 'L' end classe,
  -- evidence
  p.nova_id venda_par_na_sessao_viva, p.nova_em par_registrado_em, sm.tem_viva sessao_viva_no_dia,
  sm.n vendas_da_sessao_apagada, sm.casadas pares_da_sessao, round(100.0 * sm.casadas / sm.n, 1) pct_pareado,
  sm.fim - sm.ini duracao_original, sm.span_novo duracao_reentrada
from orf o join par p using (id) join sesm sm using (session_id)
order by o.user_id, sm.dia, o.created_at;
