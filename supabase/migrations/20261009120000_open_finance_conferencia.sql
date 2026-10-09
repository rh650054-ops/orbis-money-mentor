-- ============================================================
-- OPEN FINANCE: CONFERÊNCIA AUTOMÁTICA — 09/10/2026 (Mohamed, 07h32)
--
-- "Assim que o cara assinar o Open Finance, o negócio fica atualizado."
--  • RELATÓRIO: continua com o valor que o vendedor lançou (o dia dele).
--  • RANKING: pra quem é Pro com banco ligado, cada dia conta o que CAIU no
--    banco (Pix + maquininha das contas de trabalho), nunca mais do que ele
--    lançou no dia. O teto impede que Pix que não é venda (transferência de
--    família, salário…) suba alguém no ranking. Dinheiro em espécie não cai no
--    banco, então não conta.
--  • RETROATIVO: vale desde o primeiro dia inteiro que o banco trouxe
--    (o histórico do Open Finance chega uns 7 dias antes de ligar), não só
--    desde o dia em que ligou. Com o teto, a trava antiga "conta que virou
--    trabalho não puxa Pix velho" deixa de ser necessária pra contar o que caiu.
--  • SEM EXCEÇÃO: acabou a regra só do Mohamed (e do Rick) de contar o lançado.
--    Ninguém tem o Pix travado no fim do Foco: o lançado fica no relatório e o
--    banco aparece do lado, com o que faltou cair.
--  • CONFERÊNCIA no relatório: banco_conferencia(de, até) devolve, dia a dia,
--    lançou × caiu × faltou cair.
-- Idempotente, sem comandos de apagar (open_finance_lancado fica, sem uso).
-- ============================================================

-- ---------- 1) o que caiu conta pela conta ser de venda, sem olhar quando virou ----------
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
  base as (
    select a.*,
           public.banco_eh_maquininha(a.description) and not coalesce(a.is_pix, false) as maq,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and (coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%') or public.banco_eh_maquininha(a.description))
      and public.banco_conta_de_venda(a.bank_connection_id, null)
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = a.user_id
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, null)
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.maq, x.quando,
           (x.quando at time zone 'America/Sao_Paulo')::date as dia_cal,
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
             when t.dia_defcon is not null then t.dia_defcon
             when exists (select 1 from sess s where s.d = t.dia_cal) then null
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

-- ---------- 2) desde quando o banco cobre o vendedor (1º dia inteiro do histórico) ----------
create or replace function public.banco_desde(p_user uuid)
returns date language sql stable security definer set search_path to 'public' as $$
  select min(a.transaction_date) + 1
  from public.auto_detected_sales a
  where a.user_id = p_user
    and public.banco_conta_de_venda(a.bank_connection_id, null);
$$;
revoke all on function public.banco_desde(uuid) from public, anon, authenticated;

-- ---------- 3) ranking: Pro com banco conta o que caiu (com teto no lançado) ----------
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table (user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql security definer set search_path to 'public' as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  bancos as (
    select bc.user_id,
           public.banco_desde(bc.user_id) as desde,
           bool_or(upper(coalesce(bc.status, '')) in ('UPDATED', 'UPDATING', 'LOGIN_IN_PROGRESS', 'CONNECTED')) as saudavel
    from bank_connections bc
    where coalesce(bc.status, '') <> 'deleted'
      and public.orbis_pro_ativo(bc.user_id)
    group by bc.user_id
  ),
  b2 as (select * from bancos where desde is not null),
  pixb as (
    select b.user_id, x.dia as d, x.total as val
    from b2 b
    cross join lateral public.banco_pix_por_dia(b.user_id, greatest(p_week_start, b.desde), p_week_end) x
    where greatest(p_week_start, b.desde) <= p_week_end
  ),
  declarado as (
    select ds.user_id, ds.date::date as d, sum(coalesce(ds.total_profit, 0))::numeric as val
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  -- dia "pelo banco": o que caiu, nunca mais do que o lançado no dia
  porbanco as (
    select dc.user_id, dc.d, least(dc.val, coalesce(p.val, 0))::numeric as val
    from declarado dc
    join b2 b on b.user_id = dc.user_id and dc.d >= b.desde
    left join pixb p on p.user_id = dc.user_id and p.d = dc.d
    where b.saudavel or p.val is not null
  ),
  live as (
    select pb.user_id, pb.d, pb.val from porbanco pb
    union all
    select dc.user_id, dc.d, dc.val from declarado dc
    where not exists (select 1 from porbanco pb where pb.user_id = dc.user_id and pb.d = dc.d)
  ),
  live_dia as (select l.user_id, l.d, sum(l.val)::numeric as val from live l group by l.user_id, l.d),
  merged as (
    select coalesce(e.user_id, l.user_id) as user_id,
           case when p_usar_extrato then coalesce(e.val, 0) else coalesce(l.val, 0) end as val
    from ext e full outer join live_dia l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id, sum(m.val)::numeric as faturamento, count(*) filter (where m.val > 0)::integer as dias
    from merged m group by m.user_id
  )
  select a.user_id, coalesce(pp.nickname, ''), coalesce(pp.avatar_url, ''), a.faturamento, a.dias
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and coalesce(pr.ranking_oculto, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;

-- ---------- 4) o que entrou hoje: todo Pro com banco vê; ninguém tem o Pix travado ----------
create or replace function public.banco_entrou_do_dia(p_dia date default null)
returns table(tem_banco boolean, banco text, pix numeric, maquininha numeric, total numeric, qtd integer,
              ultima_sync timestamptz, status text, trava boolean)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  d as (
    select coalesce(
      p_dia,
      (select max(cs.date) from public.challenge_sessions cs
        where cs.user_id = auth.uid() and cs.date >= (select d from hoje) - 1),
      (select d from hoje)) as dia
  ),
  b as (
    select institution_name, coalesce(pluggy_pedido_em, created_at) as lido, status
    from public.bank_connections
    where user_id = auth.uid() and coalesce(status, '') <> 'deleted'
      and (public.orbis_pro_ativo(auth.uid()) or public.open_finance_teste(auth.uid()))
    order by coalesce(pluggy_pedido_em, created_at) asc nulls first limit 1
  ),
  e as (select * from public.banco_entradas_por_dia(auth.uid(), (select dia from d), (select dia from d))),
  tem as (select exists (select 1 from b) as t)
  select (select t from tem),
         (select institution_name from b),
         case when (select t from tem) then coalesce((select sum(e.pix) from e), 0) else 0 end::numeric,
         case when (select t from tem) then coalesce((select sum(e.maquininha) from e), 0) else 0 end::numeric,
         case when (select t from tem) then coalesce((select sum(e.total) from e), 0) else 0 end::numeric,
         case when (select t from tem) then coalesce((select sum(e.qtd) from e), 0) else 0 end::int,
         (select lido from b),
         (select status from b),
         false;
$$;
revoke all on function public.banco_entrou_do_dia(date) from public, anon;
grant execute on function public.banco_entrou_do_dia(date) to authenticated;

-- ---------- 5) conferência dia a dia pro relatório ----------
create or replace function public.banco_conferencia(p_de date, p_ate date)
returns table(dia date, lancou numeric, pix_cartao numeric, dinheiro numeric, caiu numeric, maquininha numeric,
              conta_ranking numeric, faltou numeric)
language sql stable security definer set search_path to 'public' as $$
  with ok as (
    select public.banco_desde(auth.uid()) as desde
    where public.orbis_pro_ativo(auth.uid())
      and exists (select 1 from public.bank_connections bc
                   where bc.user_id = auth.uid() and coalesce(bc.status, '') <> 'deleted')
  ),
  ds as (
    select s.date::date as d,
           sum(coalesce(s.total_profit, 0))::numeric as lancou,
           sum(coalesce(s.pix_sales, 0) + coalesce(s.card_sales, 0))::numeric as pix_cartao,
           sum(coalesce(s.cash_sales, 0))::numeric as dinheiro
    from public.daily_sales s
    where s.user_id = auth.uid() and s.date::date between p_de and p_ate
    group by s.date::date
  ),
  e as (select * from public.banco_entradas_por_dia(auth.uid(), p_de, p_ate))
  select ds.d, ds.lancou, ds.pix_cartao, ds.dinheiro,
         coalesce(e.total, 0), coalesce(e.maquininha, 0),
         least(ds.lancou, coalesce(e.total, 0)),
         greatest(0, ds.pix_cartao - coalesce(e.total, 0))
  from ds
  cross join ok
  left join e on e.dia = ds.d
  where ok.desde is not null and ds.d >= ok.desde and ds.lancou > 0
  order by ds.d;
$$;
revoke all on function public.banco_conferencia(date, date) from public, anon;
grant execute on function public.banco_conferencia(date, date) to authenticated;
