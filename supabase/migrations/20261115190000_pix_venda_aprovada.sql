-- 15/11/2026 (Rick): "foi revenda e revenda conta. Pix que cair em conta pessoal que for verídico
-- pode entrar em vendas sim."
--
-- 1) A Pix marked as a sale (banco_entradas_revisao.status = 'aprovada') counts as a sale even when it fell
--    in a personal account, came from a recurring payer, looks too big, matches another seller or came back
--    after a payment. Before, the approval only lifted 'grande'. It never lifts 'nao_e_venda', 'reembolso',
--    'plataforma' or 'propria' (own transfers are never a sale).
-- 2) banco_pix_e_venda(tx, venda): the SELLER marks a Pix of his own that fell in a personal account
--    ('conta_pessoal') as a sale, or undoes it. His mark lifts ONLY the personal-account check: the same
--    Pix can still be held as 'grande', 'recorrente', 'ida_volta' or 'vendedor', which stay with the admin.
-- 3) admin_banco_revisao_decidir: the admin can approve/deny any classified Pix, not only those already
--    queued for review (it inserts the review row when missing).
-- 4) New 'plataforma': payouts from Kiwify, Hotmart, Ebanx, Eduzz, Monetizze, Braip, PerfectPay are online
--    product sales, not street sales (a seller's e-book payout was counting in the ranking).
-- The ranking cap (typed sales − cash + R$ 500) is unchanged: an approval can never push a day above it.

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

-- the seller marks his own Pix that fell in a personal account as a sale (or undoes it)
create or replace function public.banco_pix_e_venda(p_transaction_id text, p_venda boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  a record;
  m text;
begin
  if u is null then raise exception 'sem login'; end if;
  select s.transaction_id, s.transaction_date, s.amount into a
    from public.auto_detected_sales s where s.transaction_id = p_transaction_id and s.user_id = u limit 1;
  if a.transaction_id is null then raise exception 'pix nao encontrado'; end if;
  if p_venda then
    -- only what the app left out for being in a personal account; the rest stays with the admin
    select c.motivo into m from public.banco_entradas_classificadas(u, a.transaction_date, a.transaction_date) c
     where c.transaction_id = p_transaction_id limit 1;
    if coalesce(m, '') <> 'conta_pessoal' then raise exception 'so pix de conta pessoal (motivo: %)', coalesce(m, 'ja conta'); end if;
    insert into public.banco_entradas_revisao (transaction_id, user_id, amount, motivo, status, decidido_em, decidido_por)
    values (p_transaction_id, u, a.amount, 'conta_pessoal', 'aprovada', now(), u)
    on conflict (transaction_id) do update set status = 'aprovada', decidido_em = now(), decidido_por = u;
  else
    delete from public.banco_entradas_revisao
     where transaction_id = p_transaction_id and user_id = u and motivo = 'conta_pessoal';
  end if;
  perform public.banco_reconciliar(u);
  -- what the app thinks now (null = counts as a sale; 'grande' etc. = still waiting for the admin)
  select c.motivo into m from public.banco_entradas_classificadas(u, a.transaction_date, a.transaction_date) c
   where c.transaction_id = p_transaction_id limit 1;
  return jsonb_build_object('ok', true, 'dia', a.transaction_date, 'valor', a.amount, 'venda', p_venda, 'motivo', m);
end $$;
revoke all on function public.banco_pix_e_venda(text, boolean) from public, anon;
grant execute on function public.banco_pix_e_venda(text, boolean) to authenticated;

-- the admin decides any classified Pix (creates the review row when it was never queued)
create or replace function public.admin_banco_revisao_decidir(p_transaction_id text, p_aprovar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid; d date; v numeric; m text;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  select a.user_id, a.transaction_date, a.amount into u, d, v
    from public.auto_detected_sales a where a.transaction_id = p_transaction_id limit 1;
  if u is null then return; end if;
  insert into public.banco_entradas_revisao (transaction_id, user_id, amount, motivo, status, decidido_em, decidido_por)
  values (p_transaction_id, u, v, 'admin', case when p_aprovar then 'aprovada' else 'negada' end, now(), auth.uid())
  on conflict (transaction_id) do update
    set status = excluded.status, decidido_em = now(), decidido_por = auth.uid(),
        -- a seller's own mark becomes the admin's: from now on it lifts every check
        motivo = case when banco_entradas_revisao.motivo = 'conta_pessoal' then 'admin' else banco_entradas_revisao.motivo end;
  m := to_char(coalesce(d, (now() at time zone 'America/Sao_Paulo')::date), 'YYYY-MM');
  perform public.banco_reconciliar(u);
  perform public.ranking_atualizar(u, m);
  perform public.recalculate_ranking_positions(m);
end $$;
