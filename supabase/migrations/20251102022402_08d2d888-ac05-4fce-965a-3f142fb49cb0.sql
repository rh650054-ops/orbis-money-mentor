-- Add timer-related columns to daily_checklist table
ALTER TABLE public.daily_checklist
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS progress FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add check constraint for status values
ALTER TABLE public.daily_checklist
ADD CONSTRAINT status_check CHECK (status IN ('pending', 'active', 'completed'));

-- Add index for better query performance on active timers
CREATE INDEX IF NOT EXISTS idx_daily_checklist_status ON public.daily_checklist(status) WHERE status = 'active';