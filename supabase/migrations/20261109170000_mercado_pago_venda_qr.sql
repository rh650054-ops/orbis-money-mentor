-- 09/11/2026: Mercado Pago QR / payment-link sales come as "Venda: Produto" or
-- "Venda: Pago Bank Transfer Pix", with is_pix = false. banco_eh_maquininha did not know the
-- "Venda: <something>" form, so these were classified 'nao_e_venda' and never counted. While the
-- copies inflated the bank this was hidden by the +500 cap; once the copies were removed a
-- seller's Sunday dropped from R$ 434 (his real bank) to R$ 260.
-- Change: also accept "venda: ..." and "venda com pix ..." as a sale received by the bank.
-- They show under the machine/card side (maquininha); the total of the day is what matters.
create or replace function public.banco_eh_maquininha(p_descr text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(lower(trim(p_descr)), '') ~
    '^(vendas?|recebimento de vendas?|liquida[cç][aã]o de vendas?|vendas? (no |com )?(cart[aã]o|d[eé]bito|cr[eé]dito).*|antecipa[cç][aã]o de vendas?.*|concepto|vendas? - dispon[ií]vel.*|venda presencial.*|vendas?: .+|vendas? com pix.*)$';
$$;
