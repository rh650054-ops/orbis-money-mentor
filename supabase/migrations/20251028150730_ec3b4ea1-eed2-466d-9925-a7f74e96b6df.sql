-- Remove the actual unique constraint that's preventing multiple entries per day
-- The constraint name is daily_sales_user_date_unique (not the one we tried before)

ALTER TABLE public.daily_sales DROP CONSTRAINT IF EXISTS daily_sales_user_date_unique;