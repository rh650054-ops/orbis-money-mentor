-- ============================================================
-- PIX E MAQUININHA TRAVADOS PELO BANCO + CALOTE QUE SE ATUALIZA — 09/10/2026
--
-- Rick (09/10 18:46): "maquininha e pix para quem tem open finance não é
-- editável de forma nenhuma". Desfaz o destrave de 09/10 (PR #74 e #76):
--   1) banco_entrou_do_dia volta a devolver trava = true pra todo Pro com
--      banco (mesma assinatura; só a última coluna muda).
--   2) Rick e Mohamed (open_finance_lancado) só destravam respondendo a
--      pergunta secreta. A resposta é conferida AQUI, nunca no app.
--      O dia destravado fica marcado (daily_sales.pix_manual) e o banco não
--      mexe mais nele.
--   3) Calote = o que foi vendido e não caiu na conta. Sempre que o robot lê
--      o banco, banco_reconciliar refaz os dias já fechados: Pix e cartão
--      sobem com o que caiu, o calote desce, e o lucro, o relatório e o
--      ranking acompanham (todos leem daily_sales / hourly_goal_blocks).
--      Vale de 09/10/2026 em diante, só dias com o Foco encerrado (ended_at)
--      e sem Foco ativo no mesmo dia.
-- Idempotente, sem comandos de apagar.
-- ============================================================

alter table public.daily_sales
  add column if not exists pix_manual boolean not null default false;

-- ---------- 1) trava pra todo Pro com banco ----------
create or replace function public.banco_entrou_do_dia(p_dia date default null)
returns table(tem_banco boolean, banco text, pix numeric, maquininha numeric, total numeric,
              qtd integer, ultima_sync timestamptz, status text, trava boolean)
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
         true;
$$;

-- ---------- 2) destrave só pros sócios, com a pergunta ----------
-- p_resposta null → diz se este usuário PODE destravar (mostra o cadeado clicável).
-- p_resposta preenchida → true só se for sócio e acertar (pi ÷ 2, com 2+ casas).
create or replace function public.pix_destravar(p_resposta text default null)
returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
declare
  socio boolean := exists (select 1 from public.open_finance_lancado l where l.user_id = auth.uid());
  t text;
  v numeric;
begin
  if not socio then return false; end if;
  if p_resposta is null then return true; end if;
  t := replace(replace(lower(trim(p_resposta)), ' ', ''), ',', '.');
  if t in ('pi/2', 'π/2') then return true; end if;
  if t !~ '^[0-9]+\.[0-9]{2,}$' then return false; end if;
  v := t::numeric;
  return abs(v - pi()::numeric / 2) < 0.006;
end $$;

-- Marca (ou desmarca) o dia como lançado à mão. Só sócio pode marcar true.
create or replace function public.pix_dia_manual(p_dia date, p_manual boolean)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_manual and not exists (select 1 from public.open_finance_lancado l where l.user_id = auth.uid()) then
    raise exception 'sem_permissao';
  end if;
  update public.daily_sales set pix_manual = p_manual
  where user_id = auth.uid() and date = p_dia;
end $$;

revoke all on function public.pix_destravar(text) from public, anon;
revoke all on function public.pix_dia_manual(date, boolean) from public, anon;
grant execute on function public.pix_destravar(text) to authenticated;
grant execute on function public.pix_dia_manual(date, boolean) to authenticated;

-- ---------- 3) o banco leu de novo → refaz os dias fechados ----------
-- Ordem: dinheiro (o vendedor digita) → cartão (maquininha que caiu) → Pix
-- (o que caiu) → o resto é calote. Nada passa do vendido.
create or replace function public.banco_reconciliar(p_user uuid)
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  e record;
  v_card numeric; v_pix numeric; v_debt numeric;
  v_plan uuid; v_tot numeric;
  n integer := 0;
  meses text[] := '{}';
  m text;
begin
  if not (public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)) then return 0; end if;
  if not exists (select 1 from public.bank_connections bc
                 where bc.user_id = p_user and coalesce(bc.status, '') <> 'deleted') then
    return 0;
  end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din,
           coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix,
           coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
    from public.daily_sales ds
    where ds.user_id = p_user
      and ds.date between greatest(hoje - 6, date '2026-10-09') and hoje
      and not ds.pix_manual
      and exists (select 1 from public.challenge_sessions cs
                  where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
      and not exists (select 1 from public.challenge_sessions cs
                      where cs.user_id = p_user and cs.date = ds.date and cs.status = 'active')
  loop
    select coalesce(sum(x.pix), 0) as pix, coalesce(sum(x.maquininha), 0) as maq
      into e from public.banco_entradas_por_dia(p_user, r.date, r.date) x;

    v_card := round(least(e.maq, greatest(r.vend - r.din, 0)), 2);
    v_pix  := round(least(e.pix, greatest(r.vend - r.din - v_card, 0)), 2);
    v_debt := round(greatest(r.vend - r.din - v_card - v_pix, 0), 2);

    if abs(v_card - r.card) < 0.005 and abs(v_pix - r.pix) < 0.005 and abs(v_debt - r.debt) < 0.005 then
      continue;
    end if;

    update public.daily_sales
       set card_sales = v_card, pix_sales = v_pix, total_debt = v_debt,
           total_profit = round(r.din + v_card + v_pix, 2),
           unpaid_sales = case when v_debt > 0 then 1 else 0 end,
           updated_at = now()
     where id = r.id;

    -- relatório por hora: mesma divisão proporcional do fechamento (savePaymentBreakdown)
    select p.id into v_plan from public.daily_goal_plans p
     where p.user_id = p_user and p.date = r.date limit 1;
    if v_plan is not null then
      select sum(coalesce(b.valor_dinheiro, 0) + coalesce(b.valor_cartao, 0) + coalesce(b.valor_pix, 0) + coalesce(b.valor_calote, 0))
        into v_tot from public.hourly_goal_blocks b where b.plan_id = v_plan;
      if coalesce(v_tot, 0) > 0 then
        update public.hourly_goal_blocks b
           set valor_dinheiro = round(r.din * s.parte, 2),
               valor_cartao   = round(v_card * s.parte, 2),
               valor_pix      = round(v_pix * s.parte, 2),
               valor_calote   = round(v_debt * s.parte, 2),
               achieved_amount = round((r.din + v_card + v_pix + v_debt) * s.parte, 2)
          from (select hb.id,
                       (coalesce(hb.valor_dinheiro, 0) + coalesce(hb.valor_cartao, 0) + coalesce(hb.valor_pix, 0) + coalesce(hb.valor_calote, 0)) / v_tot as parte
                  from public.hourly_goal_blocks hb where hb.plan_id = v_plan) s
         where b.id = s.id;
      end if;
    end if;

    n := n + 1;
    m := to_char(r.date, 'YYYY-MM');
    if not (m = any(meses)) then meses := meses || m; end if;
  end loop;

  -- ranking do mês: mesma conta do app (dinheiro + cartão + Pix; calote fora)
  foreach m in array meses loop
    update public.leaderboard_stats ls
       set faturamento_total_mes = coalesce((
             select sum(coalesce(ds.cash_sales, 0) + coalesce(ds.card_sales, 0) + coalesce(ds.pix_sales, 0))
               from public.daily_sales ds
              where ds.user_id = p_user and to_char(ds.date, 'YYYY-MM') = m), 0)
     where ls.user_id = p_user and ls.mes_referencia = m;
    perform public.recalculate_ranking_positions(m);
  end loop;

  return n;
end $$;

revoke all on function public.banco_reconciliar(uuid) from public, anon, authenticated;
