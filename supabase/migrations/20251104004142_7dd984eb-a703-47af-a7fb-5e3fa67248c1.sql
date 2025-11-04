-- Add goal timer columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS goal_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS goal_timer_started_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS goal_timer_active BOOLEAN DEFAULT false;