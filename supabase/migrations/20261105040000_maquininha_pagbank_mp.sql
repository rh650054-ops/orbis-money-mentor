-- 04/11/2026 (audit OF2): card-machine payouts that weren't recognized as card sales, so they fell into
-- the Pix rules (payer, recurring, "conta pessoal") and were sometimes dropped:
--   PagBank: "Vendas - Disponivel DEBITO/CREDITO <bandeira>" and "Vendas - Disponivel PIX" (~170 in 30 days)
--   Mercado Pago: "Venda presencial"
-- Only adds these two shapes; everything that was a card sale stays one.
create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto|vendas? - dispon[ií]vel.*|venda presencial.*)$';
$$;

-- bank-verified ranking days pick up the recognized sales
select public.ranking_cache_atualizar(45);
