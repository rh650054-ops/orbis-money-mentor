-- Add unique constraint on work_sessions for user_id + planning_date
-- This allows upsert operations to work correctly
ALTER TABLE public.work_sessions
ADD CONSTRAINT work_sessions_user_id_planning_date_key UNIQUE (user_id, planning_date);