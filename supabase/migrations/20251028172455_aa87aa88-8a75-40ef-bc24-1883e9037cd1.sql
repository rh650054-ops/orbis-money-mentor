-- Add monthly_goal column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN monthly_goal numeric DEFAULT 0;