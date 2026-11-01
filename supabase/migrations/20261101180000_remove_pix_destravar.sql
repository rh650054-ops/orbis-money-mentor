-- 01/11/2026 (Rick): "Destravar pra editar" (sócios destravando Pix/cartão no fim do Foco)
-- sai do app — nunca foi usado (nenhum daily_sales.pix_manual = true). Remove as duas RPCs.
-- A coluna daily_sales.pix_manual fica (default false; a leitura do banco ainda a respeita).
drop function if exists public.pix_destravar(text);
drop function if exists public.pix_dia_manual(date, boolean);
