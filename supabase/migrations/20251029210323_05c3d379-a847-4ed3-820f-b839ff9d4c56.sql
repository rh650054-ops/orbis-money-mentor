-- Add trial and payment fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start date,
ADD COLUMN IF NOT EXISTS trial_end date,
ADD COLUMN IF NOT EXISTS is_trial_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS plan_status text DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS subscription_id text,
ADD COLUMN IF NOT EXISTS next_payment_date date,
ADD COLUMN IF NOT EXISTS last_payment_date date;

-- Update handle_new_user function to set trial dates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    email, 
    nickname,
    trial_start,
    trial_end,
    is_trial_active,
    plan_status,
    plan_type
  )
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '3 days',
    true,
    'trial',
    'trial'
  );
  RETURN NEW;
END;
$$;

-- Function to check if trial is expired
CREATE OR REPLACE FUNCTION public.check_trial_expired(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT trial_end, is_trial_active, plan_status
  INTO profile_record
  FROM public.profiles
  WHERE user_id = user_uuid;
  
  IF profile_record.trial_end IS NOT NULL 
     AND profile_record.trial_end < CURRENT_DATE 
     AND profile_record.is_trial_active = true THEN
    
    UPDATE public.profiles
    SET is_trial_active = false,
        plan_status = 'expired'
    WHERE user_id = user_uuid;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;