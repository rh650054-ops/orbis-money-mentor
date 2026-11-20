-- 20/11/2026: wholesale Pix of a seller who is also a supplier (Rick: the rule applies only to that seller).
--
-- One seller also supplies resellers: they pay him by Pix, mostly above R$ 100, and he does not type
-- those sales in the app. The repeat resellers were already out ('recorrente'), but new ones and the
-- ones who paid fewer than 3 times entered the ranking (~R$ 720 in Nov) and covered street calote.
--
-- Rule, switched on per seller: banco_regras_vendedor.pix_atacado_acima. A Pix above that value is
-- 'atacado' (not a sale) unless a sale of the same value was typed that day. Machine money is not
-- affected; an admin approval still lifts it. Sellers without a row: nothing changes.

create table if not exists public.banco_regras_vendedor (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pix_atacado_acima numeric not null check (pix_atacado_acima > 0),
  motivo text,
  criado_em timestamptz not null default now()
);
alter table public.banco_regras_vendedor enable row level security;
revoke all on public.banco_regras_vendedor from anon, authenticated;

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
  -- 20/11: per-seller wholesale limit (banco_regras_vendedor); null = rule off for this seller
  regra as (select r.pix_atacado_acima from public.banco_regras_vendedor r where r.user_id = p_user),
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
        -- far above the ticket is the seller's own card on his machine (real case: R$ 2.060 + R$ 500 at
        -- 22h, after the sales day). Rick, 19/11: "passou no cartão dele não pode nem ir pra revisão,
        -- isso não é venda" — same rule as own transfers: never a sale, no review, no approval lifts it.
        when b.maq and lower(coalesce(b.description, '')) ~ '^libera[cç][aã]o de dinheiro'
             and b.amount > greatest(150, 6 * pf.ticket) then 'cartao_proprio'
        when b.maq then null
        -- 15/11: from here on, a Pix marked as a sale counts
        when b.aprovacao = 'total' then null
        -- 20/11 (Rick): a seller who also supplies resellers gets their Pix above his limit when no
        -- sale of that value was typed that day — wholesale he does not record in the app. Not a street
        -- sale: it does not count in the ranking and does not cover calote. Only sellers with a row in
        -- banco_regras_vendedor; typed sales of the same value still count.
        when b.amount > (select r.pix_atacado_acima from regra r)
         and not b.maq
         and not exists (
           select 1 from public.challenge_sessions cs
             join public.defcon_sales s on s.session_id = cs.id
            where cs.user_id = p_user and cs.date = b.transaction_date and abs(s.amount - b.amount) < 0.01) then 'atacado'
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
