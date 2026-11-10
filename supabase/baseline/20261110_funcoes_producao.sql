-- BASELINE — NOT A MIGRATION. DO NOT RUN AGAINST PRODUCTION.
-- Exact copies of financial functions as deployed in production on 10/11/2026 that were either
-- missing from this repo or different from every version in supabase/migrations.
-- Each body was checked against production by md5 (see supabase/baseline/manifesto-producao.json,
-- key "md5_exato"). Purpose: the repo finally records what production runs, and the SQL tests
-- (supabase/tests) load these definitions instead of stale ones.

create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto|vendas? - dispon[ií]vel.*|venda presencial.*|vendas?: .+|vendas? com pix.*)$';
$$;

create or replace function public.banco_nao_e_venda(p_descr text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_descr, '') ~* '(reembolso|estorno|devolu|devol |cashback|rendimento|resgate|empr[eé]stimo|sociedade de cr[eé]dito|uber do brasil|99 tecnologia)';
$$;

create or replace function public.banco_pagador(p_nome text, p_descr text)
returns text language sql immutable set search_path = public as $$
  select nullif(regexp_replace(
           nullif(trim(regexp_replace(regexp_replace(lower(
             coalesce(nullif(trim(p_nome), ''),
                      nullif(trim(split_part(coalesce(p_descr, ''), '|', 2)), ''),
                      coalesce(p_descr, ''))),
             '^(pix recebido( c6)?( de)?|transfer[êe]ncia recebida\|?|pix|cr[ée]dito pix|recebimento pix)\s*', ''),
             '[0-9./-]+', ' ', 'g')), ''),
           '^((transfer[êe]ncia )?(pix )?(recebid[ao]|recebimento)( (de )?pix)?|\(?[x*\s]+\)?)$', ''), '');
$$;

create or replace function public.banco_mesma_pessoa(a text, b text)
returns boolean language plpgsql immutable set search_path = public as $$
declare pa text[]; pb text[]; w text; ok boolean := true; n int := 0;
begin
  if a is null or b is null then return false; end if;
  pa := array(select x from unnest(regexp_split_to_array(lower(a), '\s+')) x where length(x) >= 3 and x !~ '^(de|da|do|das|dos|ltda|me|mei|eireli|sa)$');
  pb := array(select x from unnest(regexp_split_to_array(lower(b), '\s+')) x where length(x) >= 3 and x !~ '^(de|da|do|das|dos|ltda|me|mei|eireli|sa)$');
  if coalesce(array_length(pa, 1), 0) < 2 or coalesce(array_length(pb, 1), 0) < 2 then return false; end if;
  if array_length(pa, 1) > array_length(pb, 1) then declare t text[]; begin t := pa; pa := pb; pb := t; end; end if;
  foreach w in array pa loop
    n := n + 1;
    if not (w = any (pb)) then ok := false; end if;
  end loop;
  return ok and n >= 2;
end $$;

create or replace function public.banco_ligou_em(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select min((bc.created_at at time zone 'America/Sao_Paulo')::date)
    from public.bank_connections bc where bc.user_id = p_user;
$$;

create or replace function public.ranking_total_mes(p_user uuid, p_mes text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(r.valor), 0)::numeric
    from public.ranking_valor_dias((p_mes || '-01')::date, ((p_mes || '-01')::date + interval '1 month' - interval '1 day')::date, p_user) r;
$$;

create or replace function public.ranking_atualizar(p_user uuid, p_mes text)
returns void language sql volatile security definer set search_path = public as $$
  update public.leaderboard_stats ls
     set faturamento_total_mes = public.ranking_total_mes(p_user, p_mes)
   where ls.user_id = p_user and ls.mes_referencia = p_mes
     and ls.faturamento_total_mes is distinct from public.ranking_total_mes(p_user, p_mes);
$$;

create or replace function public.banco_entradas_classificadas(p_user uuid, p_de date, p_ate date)
returns table(id uuid, transaction_id text, bank_connection_id uuid, amount numeric, description text, transaction_date date, transacted_at timestamp with time zone, created_at timestamp with time zone, is_pix boolean, pagador text, motivo text)
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
           regexp_replace(coalesce(substring(a.description from '(\d{2}\.?\d{3}\.?\d{3})'), ''), '\D', '', 'g') as doc_descr
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
        when public.banco_nao_e_venda(b.description) then 'reembolso'
        when b.own_transfer then 'propria'
        when b.doc <> '' and (b.doc = pf.cpf or b.doc = pf.cnpj or exists (select 1 from donos d where d.doc <> '' and (d.doc = b.doc or left(d.doc, 8) = left(b.doc, 8)))) then 'propria'
        when b.doc_descr <> '' and (left(pf.cnpj, 8) = b.doc_descr or left(pf.cpf, 8) = b.doc_descr or exists (select 1 from donos d where left(d.doc, 8) = b.doc_descr)) then 'propria'
        when exists (select 1 from donos d where public.banco_mesma_pessoa(d.dono_nome, b.pagador)) then 'propria'
        when public.banco_mesma_pessoa(pf.nickname, b.pagador) or public.banco_mesma_pessoa(pf.pix_merchant_name, b.pagador) then 'propria'
        when exists (select 1 from public.open_finance_contas_proprias cp where cp.user_id = p_user and b.description ilike '%' || cp.termo || '%') then 'propria'
        when b.maq then null
        when not public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at)) then 'conta_pessoal'
        when exists (
          select 1 from public.extrato_lancamentos e
           where e.user_id = p_user and e.tipo = 'saida'
             and e.data between b.transaction_date - 2 and b.transaction_date + 2
             and e.valor >= b.amount * 0.8
             and public.banco_mesma_pessoa(coalesce(e.pessoa, e.comerciante, e.descricao), b.pagador)) then 'ida_volta'
        when b.pagador in (select r.pagador from recorrentes r) then 'recorrente'
        when b.amount > greatest(500, 20 * pf.ticket)
             and not exists (select 1 from public.banco_entradas_revisao rv where rv.transaction_id = b.transaction_id and rv.status = 'aprovada') then 'grande'
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

create or replace function public.banco_conferencia(p_de date, p_ate date)
returns table(dia date, lancou numeric, pix_cartao numeric, dinheiro numeric, caiu numeric, maquininha numeric, conta_ranking numeric, faltou numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ligou date;
begin
  if u is null or p_ate < p_de or p_ate - p_de > 400 then
    return;
  end if;
  ligou := public.banco_ligou_em(u);

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
     and ligou is not null and ds.d >= ligou   -- 09/11: before the bank, the typed day stands
     and (r.pelo_banco
          or (ds.d = hoje and exists (select 1 from banco_hoje b where b.desde is not null and ds.d >= b.desde)))
   order by ds.d;
end $$;

create or replace function public.banco_reconciliar(p_user uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
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
  -- 09/11: the FIRST bank ever connected, deleted ones too. Reconnecting a bank (new connection)
  -- made every earlier day "before the bank" and the reconcile skipped them, so a day inflated by
  -- copies (Mercado Pago) could never be fixed. Its entries still exist and still count.
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
       and ds.date between greatest(hoje - 6, public.ranking_banco_desde(), v_ligou) and hoje - 1
       and not ds.pix_manual
       and exists (select 1 from public.challenge_sessions cs where cs.user_id = p_user and cs.date = ds.date and cs.ended_at is not null)
       -- 05/11 (audit #2): only a day the bank was really read after it closed; a failed read is not "no Pix"
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
end $$;
