-- Rollback of 20261126150000_hotmart_negociacoes ("Gerar Pix").
-- The functions go away; the table is KEPT (it is the record of charges asked to Hotmart — a Pix
-- already generated there stays payable at Hotmart whatever happens here). Drop it by hand only
-- after confirming it is empty or exported.
drop function if exists public.hotmart_negociacao_minha();
drop function if exists public.hotmart_negociacao_gravar(uuid, text, text, text, text, timestamptz, text);
drop function if exists public.hotmart_negociacao_reservar(uuid, text, bigint, integer, numeric, timestamptz, text);
