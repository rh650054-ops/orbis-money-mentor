-- ============================================================
-- RANKING: NO DIA VALE O LANÇADO, DA MEIA-NOITE EM DIANTE SÓ O QUE CAIU — 10/10/2026
--
-- Rick (10/10 18:05): "eu vendi mil reais, caiu 300 no Open Finance. Até
-- meia-noite vai mostrar que eu tenho mil reais no rank. Quando der meia-noite
-- vai mostrar 300 … dinheiro não vai, cartão que não cai no banco não vai."
-- Vale pra todo mundo que usa Open Finance no ranking (Mohamed, André, Wesley…).
--
-- 1) ranking_valor_dias(): o valor de cada pessoa em cada dia.
--      • hoje, ou quem não tem banco: o que lançou (dinheiro + cartão + Pix, sem fiado)
--      • dia já passado, com banco: o que CAIU no banco (Pix + maquininha), nunca
--        acima do que ele lançou fora o dinheiro. Dinheiro não entra.
--    Proteção: só troca pelo banco se o banco já foi lido depois que o dia acabou
--    E se a conexão lê de verdade (tem transação e é conta de venda). Banco quebrado
--    (ex.: Stone pedindo senha, 0 transações) segue no lançado — ninguém zera por
--    falha da Pluggy.
-- 2) get_weekly_ranking_verified (tela do ranking) e leaderboard_stats (posição,
--    fechamento, X1) passam a usar a MESMA conta. ranking_virada() roda de hora em
--    hora (e logo depois da meia-noite) e acerta posições.
-- 3) O que caiu no banco deixa de contar entrada que não é venda: reembolso,
--    estorno, devolução, cashback, rendimento, empréstimo. Caso Wesley 09/10: dois
--    "Reembolso recebido pelo Pix | UBER" (R$ 42,94 + 53,98 = 96,92) inflaram o
--    caiu pra 714,92 — sem eles fica 618, o número que ele conferiu no banco.
-- 4) Pix do dia seguinte não volta mais pro Foco de ontem quando o dia seguinte tem
--    venda própria (Foco aberto ou venda lançada) e o Pix é depois das 6h. Caso
--    Oempresarionasruas: Pix de 09/10 caíam no Foco de 08/10.
-- Idempotente, sem comandos de apagar.
-- ============================================================

-- ---------- 3) entrada que não é venda ----------
create or replace function public.banco_nao_e_venda(p_descr text)
returns boolean language sql immutable set search_path to 'public' as $$
  select coalesce(p_descr, '') ~* '(reembolso|estorno|devolu|devol |cashback|rendimento|resgate|empr[eé]stimo|sociedade de cr[eé]dito|uber do brasil|99 tecnologia)';
$$;
revoke all on function public.banco_nao_e_venda(text) from public, anon, authenticated;

-- ---------- 3+4) o que caiu por dia ----------
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
    union
    select s.d from sess s
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
      and not public.banco_nao_e_venda(a.description)
      and (coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%' or coalesce(a.description, '') ilike 'transfer%recebid%') or public.banco_eh_maquininha(a.description))
      and public.banco_conta_de_venda(a.bank_connection_id, coalesce(a.transacted_at, a.created_at))
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = a.user_id
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
             -- dia seguinte com venda própria: depois das 6h o Pix é dele, não do Foco de ontem
             when t.dia_defcon is not null and t.dia_cal > t.dia_defcon and t.hora >= time '06:00'
                  and exists (select 1 from vendeu v where v.d = t.dia_cal) then t.dia_cal
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

-- ---------- 1) o valor de cada dia no ranking ----------
create or replace function public.ranking_valor_dias(p_de date, p_ate date, p_user uuid default null)
returns table(user_id uuid, dia date, valor numeric, pelo_banco boolean)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ofi as (
    select bc.user_id, min((bc.created_at at time zone 'America/Sao_Paulo')::date) as desde
      from public.bank_connections bc
     where coalesce(bc.status, '') <> 'deleted'
       and (p_user is null or bc.user_id = p_user)
       and (public.orbis_pro_ativo(bc.user_id) or public.open_finance_teste(bc.user_id))
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
  -- dia que pode ir pelo banco: já passou, depois de ligar o banco, e uma conexão
  -- que lê de verdade foi lida depois que o dia acabou
  elegivel as (
    select ds.user_id, ds.dia
      from ds join ofi o on o.user_id = ds.user_id
     where ds.dia >= o.desde and ds.dia < (select d from hoje)
       and exists (
         select 1 from public.bank_connections c
          where c.user_id = ds.user_id and coalesce(c.status, '') <> 'deleted'
            and c.last_synced_at >= (((ds.dia + 1)::timestamp) at time zone 'America/Sao_Paulo')
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
         case when e.user_id is not null
              then round(least(coalesce(b.total, 0), greatest(ds.vend - ds.din, 0)), 2)
              else round(ds.recebido, 2) end,
         e.user_id is not null
    from ds
    left join elegivel e on e.user_id = ds.user_id and e.dia = ds.dia
    left join banco b on b.user_id = ds.user_id and b.dia = ds.dia;
$$;
revoke all on function public.ranking_valor_dias(date, date, uuid) from public, anon, authenticated;

create or replace function public.ranking_total_mes(p_user uuid, p_mes text)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(r.valor), 0)::numeric
    from public.ranking_valor_dias((p_mes || '-01')::date, ((p_mes || '-01')::date + interval '1 month' - interval '1 day')::date, p_user) r;
$$;
revoke all on function public.ranking_total_mes(uuid, text) from public, anon, authenticated;

-- o app chama pra gravar o próprio total (syncDailySales)
create or replace function public.ranking_meu_total_mes(p_mes text)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is null then 0 else public.ranking_total_mes(auth.uid(), p_mes) end;
$$;
revoke all on function public.ranking_meu_total_mes(text) from public, anon;
grant execute on function public.ranking_meu_total_mes(text) to authenticated;

create or replace function public.ranking_atualizar(p_user uuid, p_mes text)
returns void language sql security definer set search_path to 'public' as $$
  update public.leaderboard_stats ls
     set faturamento_total_mes = public.ranking_total_mes(p_user, p_mes)
   where ls.user_id = p_user and ls.mes_referencia = p_mes
     and ls.faturamento_total_mes is distinct from public.ranking_total_mes(p_user, p_mes);
$$;
revoke all on function public.ranking_atualizar(uuid, text) from public, anon, authenticated;

-- ---------- 2) virada: quem tem banco ganha o número do banco nos dias passados ----------
create or replace function public.ranking_virada()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m text;
  u uuid;
  n integer := 0;
begin
  foreach m in array array[to_char(hoje - 1, 'YYYY-MM'), to_char(hoje, 'YYYY-MM')] loop
    for u in
      select distinct bc.user_id from public.bank_connections bc
        join public.leaderboard_stats ls on ls.user_id = bc.user_id and ls.mes_referencia = m
       where coalesce(bc.status, '') <> 'deleted'
    loop
      perform public.ranking_atualizar(u, m);
      n := n + 1;
    end loop;
    perform public.recalculate_ranking_positions(m);
  end loop;
  return n;
end $$;
revoke all on function public.ranking_virada() from public, anon, authenticated;

-- ---------- 2) a tela do ranking usa a mesma conta ----------
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table (user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql security definer set search_path to 'public' as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  live_dia as (
    select r.user_id, r.dia as d, sum(r.valor)::numeric as val
      from public.ranking_valor_dias(p_week_start, p_week_end) r
     group by r.user_id, r.dia
  ),
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

-- ---------- 2) o resync do admin também ----------
create or replace function public.admin_resync_leaderboard(p_user uuid, p_mes text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_ini date := (p_mes || '-01')::date;
  v_fim date := (v_ini + interval '1 month')::date;
  v_fat numeric; v_pix numeric; v_dias int;
  v_hidden boolean; v_nome text; v_avatar text; v_entry uuid;
begin
  if not public.is_orbis_admin() then
    raise exception 'apenas admin';
  end if;
  v_fat := public.ranking_total_mes(p_user, p_mes);
  select coalesce(sum(coalesce(pix_sales,0)),0),
         count(*) filter (where coalesce(card_sales,0) + coalesce(pix_sales,0) + coalesce(cash_sales,0) > 0)
    into v_pix, v_dias
    from daily_sales
   where user_id = p_user and date >= v_ini and date < v_fim;

  select coalesce(ranking_hidden,false),
         coalesce(nickname, split_part(coalesce(email,''),'@',1), 'Usuário'),
         avatar_url
    into v_hidden, v_nome, v_avatar
    from profiles where user_id = p_user;

  select id into v_entry from leaderboard_stats
   where user_id = p_user and mes_referencia = p_mes limit 1;

  if v_hidden then
    delete from leaderboard_stats where user_id = p_user and mes_referencia = p_mes;
  elsif v_entry is not null then
    update leaderboard_stats
       set faturamento_total_mes = v_fat,
           faturamento_pix_mes = v_pix,
           dias_trabalhados_mes = greatest(coalesce(dias_trabalhados_mes,0), v_dias),
           nome_usuario = coalesce(v_nome, nome_usuario)
     where id = v_entry;
  elsif v_fat > 0 then
    insert into leaderboard_stats
      (user_id, nome_usuario, avatar_url, mes_referencia, faturamento_total_mes,
       faturamento_pix_mes, dias_trabalhados_mes, constancia_streak_atual, constancia_maior_streak)
    values (p_user, v_nome, v_avatar, p_mes, v_fat, v_pix, v_dias, 1, 1);
  end if;

  perform recalculate_ranking_positions(p_mes);
end;
$$;

-- ---------- 2) de hora em hora (o minuto 20 cai logo depois da leitura da meia-noite) ----------
select cron.unschedule(jobid) from cron.job where jobname = 'ranking-virada';
select cron.schedule('ranking-virada', '20 * * * *', $$ select public.ranking_virada(); $$);
