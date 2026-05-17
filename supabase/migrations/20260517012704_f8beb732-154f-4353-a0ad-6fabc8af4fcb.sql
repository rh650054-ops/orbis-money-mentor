ALTER TABLE public.hourly_goal_blocks ADD COLUMN IF NOT EXISTS valor_gorjeta NUMERIC DEFAULT 0;
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS tip_sales NUMERIC DEFAULT 0;