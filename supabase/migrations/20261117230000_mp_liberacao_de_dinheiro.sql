-- 17/11/2026: a seller's Mercado Pago card machine (Point) money never counted.
--
-- Mercado Pago Empresas reports each machine sale, when the money is released, as
-- "Liberação de dinheiro", "Liberação de dinheiro venda com pix" or
-- "Liberação de dinheiro venda com QR code". banco_eh_maquininha did not know these, so:
--   - "Liberação de dinheiro" (card sales) was not Pix and not machine → 'nao_e_venda';
--   - "... venda com pix" all share one "payer" (the text itself) → flagged 'recorrente'.
-- Real case 01–17/11: 165 releases, R$ 6.5k of machine sales left out; the report showed
-- R$ 2.8k of calote the seller never had. Only this seller has these entries today.
--
-- Fix (rule for everyone): those descriptions are card machine money. The usual protections
-- still apply: own transfers and refunds are checked before, and the ranking cap
-- (typed sales − cash + R$ 500) still limits each day.
-- Mercado Pago lists each machine sale on its own, so a single one far above the ticket
-- (> max(R$ 150, 6 × ticket)) is held as 'grande' for the admin, like a big Pix: in the real case
-- the seller ran his own credit card (R$ 2.060 + R$ 500, at 22h, after his sales day).
--
-- Also: banco_reconciliar(user, since) redoes the days from a given date (SQL editor only),
-- because the normal reconcile only looks at the last 6 days.

create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path to 'public' as $function$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto|vendas? - dispon[ií]vel.*|venda presencial.*|vendas?: .+|vendas? com pix.*|libera[cç][aã]o de dinheiro( venda com (pix|qr ?code|cart[aã]o.*))?)$';
$function$;

create or replace function public.banco_entradas_classificadas(p_user uuid, p_de date, p_ate date)
returns table(id uuid, transaction_id text, bank_connection_id uuid, amount numeric, description text, transaction_date date,
              transacted_at timestamp with time zone, created_at timestamp with time zone, is_pix boolean, pagador text, motivo text)
language sql stable security definer set search_path = public as $$
  with perfil as (
    select p.nickname, regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') as cpf,
           regexp_replace(coalesce(p.tax_cnpj, ''), '\D', '', 'g') as cnpj, p.pix_merchant_name,
           coalesce((select f.ticket from public.orbis_ficha f where f.user_id = p_user), 20) as ticket
      from public.profiles p where p.user_id = p_user
  ),
  donos as (
    select bc.dono_nome, regexp_replace(coalesce(bc.dono_doc, ''), '\D', '', 'g') as doc
      from public.bank_connections bc where bc.user_id = p_user and (bc.dono_nome is not null or bc.dono_doc is not null)
  ),
  base as (
    select a.id, a.transaction_id, a.bank_connection_id, a.amount, a.description, a.transaction_date, a.transacted_at, a.created_at,
           coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%' or coalesce(a.description, '') ilike 'transfer%recebid%') as is_pix,
           public.banco_eh_maquininha(a.description) as maq,
           public.banco_pagador(a.pagador_nome, a.description) as pagador,
           regexp_replace(coalesce(a.pagador_doc, ''), '\D', '', 'g') as doc,
           coalesce(a.own_transfer, false) as own_transfer,
           regexp_replace(coalesce(substring(a.description from '(\d{2}\.?\d{3}\.?\d{3})'), ''), '\D', '', 'g') as doc_descr,
           -- 'total' = approved by the admin (lifts every check below); 'pessoal' = the seller marked it
           -- himself (lifts only the personal-account check: big, recurring or round-trip still apply)
           (select case when rv.motivo = 'conta_pessoal' then 'pessoal' else 'total' end
              from public.banco_entradas_revisao rv
             where rv.transaction_id = a.transaction_id and rv.status = 'aprovada') as aprovacao
      from public.auto_detected_sales a
     where a.user_id = p_user
       and a.transaction_date between p_de - 2 and p_ate + 2
       and coalesce(a.status, 'pending') <> 'ignored'
  ),
  por_dia as (
    select public.banco_pagador(a.pagador_nome, a.description) as pagador, a.transaction_date as d, count(*) as cnt, sum(a.amount) as total
      from public.auto_detected_sales a
     where a.user_id = p_user and a.transaction_date between p_ate - 30 and p_ate + 2
       and coalesce(a.status, 'pending') <> 'ignored'
       and public.banco_pagador(a.pagador_nome, a.description) ~ '[a-z]{3,}.*[a-z]{3,}'
       and not public.banco_eh_maquininha(a.description)
     group by 1, 2
  ),
  recorrentes as (
    select pd.pagador from por_dia pd cross join perfil pf
     group by pd.pagador, pf.ticket
    having max(pd.cnt) >= 3
        or sum(pd.cnt) >= 5
        or (count(*) >= 3 and sum(pd.total) > 6 * pf.ticket)
  ),
  classificada as (
    select b.*, pf.ticket,
      case
        when not (b.is_pix or b.maq) then 'nao_e_venda'
        when coalesce(b.description, '') || ' ' || coalesce(b.pagador, '') ~* '(kiwify|hotmart|ebanx|eduzz|monetizze|braip|perfect ?pay)' then 'plataforma'
        when public.banco_nao_e_venda(b.description) then 'reembolso'
        when b.own_transfer then 'propria'
        when b.doc <> '' and (b.doc = pf.cpf or b.doc = pf.cnpj or exists (select 1 from donos d where d.doc <> '' and (d.doc = b.doc or left(d.doc, 8) = left(b.doc, 8)))) then 'propria'
        when b.doc_descr <> '' and (left(pf.cnpj, 8) = b.doc_descr or left(pf.cpf, 8) = b.doc_descr or exists (select 1 from donos d where left(d.doc, 8) = b.doc_descr)) then 'propria'
        when exists (select 1 from donos d where public.banco_mesma_pessoa(d.dono_nome, b.pagador)) then 'propria'
        when public.banco_mesma_pessoa(pf.nickname, b.pagador) or public.banco_mesma_pessoa(pf.pix_merchant_name, b.pagador) then 'propria'
        when exists (select 1 from public.open_finance_contas_proprias cp where cp.user_id = p_user and b.description ilike '%' || cp.termo || '%') then 'propria'
        -- 17/11: Mercado Pago reports each machine sale on its own ("Liberação de dinheiro"), so one
        -- far above the ticket is not street money — the seller's own card on his machine (real case:
        -- R$ 2.060 + R$ 500 at 22h, after the sales day). It waits for the admin like a big Pix.
        when b.maq and lower(coalesce(b.description, '')) ~ '^libera[cç][aã]o de dinheiro'
             and b.amount > greatest(150, 6 * pf.ticket) and b.aprovacao is distinct from 'total' then 'grande'
        when b.maq then null
        -- 15/11: from here on, a Pix marked as a sale counts
        when b.aprovacao = 'total' then null
        when b.aprovacao is distinct from 'pessoal'
         and not public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at)) then 'conta_pessoal'
        when exists (
          select 1 from public.extrato_lancamentos e
           where e.user_id = p_user and e.tipo = 'saida'
             and e.data between b.transaction_date - 2 and b.transaction_date + 2
             and e.valor >= b.amount * 0.8
             and public.banco_mesma_pessoa(coalesce(e.pessoa, e.comerciante, e.descricao), b.pagador)) then 'ida_volta'
        when b.pagador in (select r.pagador from recorrentes r) then 'recorrente'
        when b.amount > greatest(500, 20 * pf.ticket) then 'grande'
        when b.amount > greatest(60, 3 * pf.ticket) and exists (
          select 1 from public.profiles o
           where o.user_id <> p_user and o.nickname is not null and public.banco_mesma_pessoa(o.nickname, b.pagador)) then 'vendedor'
        else null
      end as motivo
    from base b cross join perfil pf
  )
  select c.id, c.transaction_id, c.bank_connection_id, c.amount, c.description, c.transaction_date, c.transacted_at, c.created_at,
         c.is_pix, c.pagador, c.motivo
    from classificada c;
$$;

-- the reconcile, from a given day (the 1-argument version keeps the last 6 days)
create or replace function public.banco_reconciliar(p_user uuid, p_desde date)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; e record;
  v_lanc numeric; v_teto numeric;
  v_card numeric; v_pix numeric; v_debt numeric;
  v_plan uuid; v_tot numeric;
  v_ligou date;
  n integer := 0; meses text[] := '{}'; m text;
begin
  if not (public.orbis_pro_ativo(p_user) or public.open_finance_teste(p_user)) then return 0; end if;
  select min((bc.created_at at time zone 'America/Sao_Paulo')::date) into v_ligou
    from public.bank_connections bc where bc.user_id = p_user;
  if v_ligou is null then return 0; end if;

  for r in
    select ds.id, ds.date,
           coalesce(ds.cash_sales, 0) as din, coalesce(ds.card_sales, 0) as card,
           coalesce(ds.pix_sales, 0) as pix, coalesce(ds.total_debt, 0) as debt,
           coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0) as vend
      from public.daily_sales ds
     where ds.user_id = p_user
       and ds.date between greatest(coalesce(p_desde, hoje - 6), public.ranking_banco_desde(), v_ligou) and hoje - 1
       and not ds.pix_manual
       and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
       and exists (select 1 from public.bank_connections c
                    where c.user_id = p_user and coalesce(c.status, '') <> 'deleted'
                      and c.leitura_ok_em >= (((ds.date + 1)::timestamp) at time zone 'America/Sao_Paulo'))
  loop
    select coalesce(sum(x.pix), 0) as pix, coalesce(sum(x.maquininha), 0) as maq
      into e from public.banco_entradas_por_dia(p_user, r.date, r.date) x;

    v_lanc := public.banco_lancado_dia(p_user, r.date);
    if v_lanc <= 0 then v_lanc := r.vend; end if;
    v_teto := case when exists (select 1 from public.banco_excesso_ok o where o.user_id = p_user and o.dia = r.date)
                   then null else greatest(v_lanc - r.din, 0) + 500 end;

    v_card := round(case when v_teto is null then e.maq else least(e.maq, v_teto) end, 2);
    v_pix  := round(case when v_teto is null then e.pix else least(e.pix, greatest(v_teto - v_card, 0)) end, 2);
    v_debt := round(greatest(v_lanc - r.din - v_card - v_pix, 0), 2);

    if abs(v_card - r.card) < 0.005 and abs(v_pix - r.pix) < 0.005 and abs(v_debt - r.debt) < 0.005 then
      continue;
    end if;

    update public.daily_sales
       set card_sales = v_card, pix_sales = v_pix, total_debt = v_debt,
           total_profit = round(r.din + v_card + v_pix, 2),
           unpaid_sales = case when v_debt > 0 then 1 else 0 end,
           updated_at = now()
     where id = r.id;

    select p.id into v_plan from public.daily_goal_plans p where p.user_id = p_user and p.date = r.date limit 1;
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

  foreach m in array meses loop
    perform public.ranking_atualizar(p_user, m);
    perform public.recalculate_ranking_positions(m);
  end loop;
  return n;
end $function$;
revoke all on function public.banco_reconciliar(uuid, date) from public, anon, authenticated;

create or replace function public.banco_reconciliar(p_user uuid)
returns integer language sql security definer set search_path to 'public' as $function$
  select public.banco_reconciliar(p_user, null::date);
$function$;
