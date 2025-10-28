-- Remove unique constraint to allow multiple sales entries per day
-- This is necessary to track individual transactions instead of aggregated daily totals

-- First, drop the unique constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_sales_user_id_date_key'
  ) THEN
    ALTER TABLE public.daily_sales DROP CONSTRAINT daily_sales_user_id_date_key;
  END IF;
END $$;

-- Add index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_daily_sales_user_date ON public.daily_sales(user_id, date DESC);