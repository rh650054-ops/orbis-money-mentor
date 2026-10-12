-- ============================================================
-- O QUE CAI ANTES DO FOCO É DO DIA ANTERIOR (Rick, 11/10/2026 21:38)
-- "vendi R$ 1000 ontem e caiu R$ 800, faltou 200. Hoje iniciei o Foco às 15h, mas
--  antes disso caiu R$ 100: esse valor conta como Pix de ontem, vai pro ranking e
--  atualiza o calote de ontem. Depois que inicia o Foco, tudo que cair (no padrão)
--  conta como o dia."
--
-- Antes: num dia COM Foco, o que caía depois das 6h já contava pro dia do calendário,
-- mesmo antes de começar o Foco (ex.: R$ 95 às 11:32 com o Foco iniciado às 17:24).
-- Agora, num dia em que houve Foco:
--   • caiu DEPOIS do início do 1º Foco do dia  → é desse dia;
--   • caiu ANTES do início                      → é do dia do Foco anterior (até o fim
--     do dia seguinte a ele, como já era); sem Foco anterior nesse prazo, vai pro dia
--     anterior do calendário — nunca pro dia de hoje.
-- Dia SEM Foco, só lançado à mão: segue a regra antiga (depois das 6h é do dia).
-- O cálculo da meia-noite (banco_reconciliar, de hora em hora) já relê os últimos
-- 6 dias, então o "calote" de ontem é atualizado sozinho.
-- Só muda a atribuição de dia. Classificação (o que não conta) continua igual.
-- ============================================================

create or replace function public.banco_entradas_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, pix numeric, maquininha numeric, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
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
    select a.amount, a.transaction_date, a.transaction_id, a.bank_connection_id,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    -- lê 1 dia a mais pra frente: o que cair amanhã antes do Foco é de hoje
    from public.banco_entradas_classificadas(p_user, p_de, p_ate + 1) a
    where a.motivo is null
      -- o mesmo Pix lido por duas conexões conta uma vez só
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
    select x.amount, x.maq, x.quando,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
           (x.quando at time zone 'America/Sao_Paulo')::time as hora,
           -- o Foco mais recente que já tinha começado quando o dinheiro caiu
           (select s.d from sess s
             where x.quando is not null and s.ini <= x.quando
               and x.quando < (((s.d + 2)::timestamp) at time zone 'America/Sao_Paulo')
             order by s.ini desc limit 1) as dia_defcon,
           x.transaction_date
    from base x
  ),
  atribuido as (
    select t.amount, t.maq, t.quando,
           case
             when t.quando is null then t.transaction_date
             -- caiu depois do início do Foco desse mesmo dia
             when t.dia_defcon = t.dia_cal then t.dia_cal
             -- o dia teve Foco, mas ainda não tinha começado: é do Foco anterior
             when exists (select 1 from sess s where s.d = t.dia_cal)
               then coalesce(t.dia_defcon, t.dia_cal - 1)
             -- dia lançado à mão (sem Foco): depois das 6h é do dia
             when t.hora >= time '06:00' and exists (select 1 from vendeu v where v.d = t.dia_cal) then t.dia_cal
             when t.dia_defcon is not null then t.dia_defcon
             else t.dia_cal
           end as dia
    from tx t
  )
  select a.dia,
         coalesce(sum(a.amount) filter (where not a.maq), 0)::numeric,
         coalesce(sum(a.amount) filter (where a.maq), 0)::numeric,
         sum(a.amount)::numeric,
         count(*)::int,
         max(a.quando)
  from atribuido a
  where a.dia between p_de and p_ate
  group by a.dia;
$$;
revoke all on function public.banco_entradas_por_dia(uuid, date, date) from public, anon, authenticated;
