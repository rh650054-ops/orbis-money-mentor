-- Adicionar coluna de custo de mercadoria na tabela daily_sales
ALTER TABLE public.daily_sales 
ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

COMMENT ON COLUMN public.daily_sales.cost IS 'Valor gasto em mercadoria/produtos no dia';