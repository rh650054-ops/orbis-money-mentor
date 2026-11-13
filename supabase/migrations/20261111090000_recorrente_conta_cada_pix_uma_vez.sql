-- PR 1 / F-01 (audit 10/11/2026) — a customer is "recurrent" by what he really paid, not by how many
-- times the vendor reconnected the bank.
--
-- Before: the "recorrente" rule (payer with 3+ Pix in a day, 5+ in 30 days, or 3+ days above
-- 6 tickets) counted the rows of auto_detected_sales. Each reconnection of the same bank creates a
-- new connection that stores the same Pix again with a different id, so one Pix seen by 3
-- connections counted as 3 and the customer became "recurrent": every Pix of his was excluded
-- from Dia de Vendas, reconciliation and ranking. One vendor (Cora, 3 connections with entries)
-- had 353 of 355 "recurrent" payers created this way.
--
-- After: the rule counts each real Pix once. A copy is the same entry (amount, day, description,
-- order) seen by another connection of the SAME ACCOUNT (same bank, holder and accounts); entries
-- of another bank or of another account in the same bank are never paired. Thresholds (who is really recurrent), the other 7 exclusion reasons, their order and
-- the returned columns are untouched. No row is deleted or rewritten by this migration.
--
-- Changes exactly one CTE (por_dia, now fed by copias) of banco_entradas_classificadas.
-- Side effects once applied (they are the purpose of the fix, see the PR body for the numbers):
--   * ranking_dia_cache is recomputed by the hourly cron for every day not yet homologated;
--   * banco_reconciliar rewrites pix/calote of the last 6 days where the bank total changed.
--
-- Rollback: run the definition of this function in supabase/baseline/20261110_funcoes_producao.sql
-- again (the exact production copy from before this change).

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
  -- F-01: every reconnection of a bank is a new connection that stores the same Pix again under
  -- another id. A copy is the same entry seen by another connection of the SAME ACCOUNT: same
  -- bank, same holder and same accounts (the definition pluggy-hora already uses to remove
  -- repeated connections). Entries of another bank, or of another account in the same bank, are
  -- never paired: they are different sales even when amount, day and description match.
  conexoes as (
    select bc.id, lower(bc.institution_name) || '|' || lower(coalesce(bc.dono_nome, '')) as titular,
           (select string_agg(lower(coalesce(s.nome, '')), ',' order by lower(coalesce(s.nome, '')))
              from public.bank_saldos s where s.bank_connection_id = bc.id) as contas
      from public.bank_connections bc where bc.user_id = p_user
  ),
  conta_de as (
    -- accounts not listed yet (first minutes of a connection): borrow the sibling's list
    select c.id, c.titular || '|' || coalesce(c.contas, (select max(o.contas) from conexoes o where o.titular = c.titular), '') as conta
      from conexoes c
  ),
  copias as (
    select public.banco_pagador(a.pagador_nome, a.description) as pagador, a.transaction_date as d, a.amount,
           lower(coalesce(a.description, '')) as chave_desc,
           coalesce((select cd.conta from conta_de cd where cd.id = a.bank_connection_id), '') as conta,
           row_number() over (partition by a.bank_connection_id, a.amount, a.transaction_date, lower(coalesce(a.description, ''))
                              order by a.transacted_at nulls last, a.transaction_id) as rn
      from public.auto_detected_sales a
     where a.user_id = p_user and a.transaction_date between p_ate - 30 and p_ate + 2
       and coalesce(a.status, 'pending') <> 'ignored'
       and public.banco_pagador(a.pagador_nome, a.description) ~ '[a-z]{3,}.*[a-z]{3,}'
       and not public.banco_eh_maquininha(a.description)
  ),
  por_dia as (
    select u.pagador, u.d, count(*) as cnt, sum(u.amount) as total
      from (select distinct on (c.conta, c.d, c.amount, c.chave_desc, c.rn) c.pagador, c.d, c.amount
              from copias c
             order by c.conta, c.d, c.amount, c.chave_desc, c.rn, c.pagador) u
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
