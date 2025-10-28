-- Add CHECK constraints for input validation on daily_sales table
ALTER TABLE public.daily_sales
  ADD CONSTRAINT check_total_profit_non_negative CHECK (total_profit >= 0),
  ADD CONSTRAINT check_total_debt_non_negative CHECK (total_debt >= 0),
  ADD CONSTRAINT check_unpaid_sales_non_negative CHECK (unpaid_sales >= 0),
  ADD CONSTRAINT check_cash_sales_non_negative CHECK (cash_sales >= 0),
  ADD CONSTRAINT check_pix_sales_non_negative CHECK (pix_sales >= 0),
  ADD CONSTRAINT check_card_sales_non_negative CHECK (card_sales >= 0),
  ADD CONSTRAINT check_notes_length CHECK (char_length(notes) <= 2000);

-- Add CHECK constraints for input validation on profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT check_nickname_length CHECK (char_length(nickname) <= 100),
  ADD CONSTRAINT check_email_length CHECK (char_length(email) <= 255);

-- Add CHECK constraints for input validation on routine_activities table
ALTER TABLE public.routine_activities
  ADD CONSTRAINT check_name_length CHECK (char_length(name) <= 200),
  ADD CONSTRAINT check_notes_length CHECK (char_length(notes) <= 2000),
  ADD CONSTRAINT check_start_time_format CHECK (start_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT check_end_time_format CHECK (end_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

-- Add CHECK constraints for input validation on routines table
ALTER TABLE public.routines
  ADD CONSTRAINT check_daily_profit_non_negative CHECK (daily_profit >= 0),
  ADD CONSTRAINT check_daily_debt_non_negative CHECK (daily_debt >= 0),
  ADD CONSTRAINT check_notes_length CHECK (char_length(notes) <= 2000),
  ADD CONSTRAINT check_wake_time_format CHECK (wake_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT check_work_start_format CHECK (work_start ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT check_lunch_time_format CHECK (lunch_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT check_work_end_format CHECK (work_end ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT check_sleep_time_format CHECK (sleep_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');