-- Add working days selection and freeze tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS working_days text[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
ADD COLUMN IF NOT EXISTS missed_days_this_week integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS week_start_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS freeze_used_this_week boolean DEFAULT false;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_working_days ON public.profiles USING GIN(working_days);

-- Update daily_work_log to track more details
ALTER TABLE public.daily_work_log
ADD COLUMN IF NOT EXISTS sales_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS percentage_achieved numeric DEFAULT 0;