-- ============================================================
-- OPEN FINANCE: MAQUININHA CONTA + SÓCIOS CONTAM O LANÇADO — 09/10/2026
--
-- 1) Maquininha conta (Rick, 09/10 01:26): "essas vendas de maquininha também
--    têm que contabilizar no Open Finance … de qualquer forma cai na minha
--    conta". Entrada de maquininha numa conta de TRABALHO ("Vendas" na
--    InfinitePay, "Recebimento de vendas", "Liquidação de vendas"…) passa a
--    contar como dinheiro de venda que caiu, ao lado do Pix. Caso real: Mohamed
--    08/10, InfinitePay "Vendas" R$ 35,01 às 19h15, no meio do Foco.
--    banco_entradas_por_dia separa pix × maquininha; banco_pix_por_dia segue
--    com a MESMA assinatura e passa a devolver o total (pix + maquininha).
--    A janela do dia NÃO muda (regra do Rick de 07/10).
--
-- 2) Sócios contam o lançado (Mohamed 04/10 + Rick 09/10): Rick e Mohamed
--    continuam vendo o banco no Foco, mas o Pix NÃO é travado pelo banco —
--    vale o que eles lançam, até o Open Finance ser anunciado pra todos.
--    open_finance_lancado = lista de exceção. banco_entrou_do_dia devolve
--    `trava` (false pra quem está na lista).
--
-- Idempotente, sem comandos de apagar. Ninguém além de Rick e Mohamed vê o
-- banco no Foco hoje (open_finance_testers), então nenhum cliente muda de tela.
-- ============================================================

-- ---------- 1) o que é entrada de maquininha ----------
create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path to 'public' as $$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*)$';
$$;
revoke all on function public.banco_eh_maquininha(text) from public, anon, authenticated;

-- ---------- 1b) entradas de venda por dia: pix × maquininha ----------
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

-- mesma assinatura de antes: ranking, DEFCON antigo e vant_pro_hoje passam a ver o total
create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select e.dia, e.total, e.qtd, e.ultimo from public.banco_entradas_por_dia(p_user, p_de, p_ate) e;
$$;

-- ---------- 2) quem conta o lançado mesmo com banco ----------
create table if not exists public.open_finance_lancado (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  nota text
);
alter table public.open_finance_lancado enable row level security;
revoke all on public.open_finance_lancado from anon, authenticated;

insert into public.open_finance_lancado (user_id, nota) values
  ('e38b0499-abbc-439d-b592-c8cac4c83741', 'Mohamed, sócio — conta o lançado até o anúncio do Open Finance (04/10)'),
  ('79312077-3496-44b0-b543-4c9f81425425', 'Rick, dono — conta o lançado até o anúncio do Open Finance (09/10)')
on conflict do nothing;

-- ---------- 2b) o que entrou hoje, com pix × maquininha e a trava ----------
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
      and public.open_finance_teste(auth.uid())
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
         not exists (select 1 from public.open_finance_lancado l where l.user_id = auth.uid());
$$;
revoke all on function public.banco_entrou_do_dia(date) from public, anon;
grant execute on function public.banco_entrou_do_dia(date) to authenticated;
