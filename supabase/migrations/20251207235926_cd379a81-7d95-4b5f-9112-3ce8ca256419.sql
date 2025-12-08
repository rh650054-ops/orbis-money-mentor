-- Add detailed payment fields and timer fields to hourly_goal_blocks table
ALTER TABLE public.hourly_goal_blocks
ADD COLUMN IF NOT EXISTS valor_dinheiro numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_cartao numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_pix numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_calote numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS timer_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS timer_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS timer_paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS timer_elapsed_seconds integer DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.hourly_goal_blocks.valor_dinheiro IS 'Sales amount in cash for this hour block';
COMMENT ON COLUMN public.hourly_goal_blocks.valor_cartao IS 'Sales amount via card for this hour block';
COMMENT ON COLUMN public.hourly_goal_blocks.valor_pix IS 'Sales amount via Pix for this hour block';
COMMENT ON COLUMN public.hourly_goal_blocks.valor_calote IS 'Chargebacks/defaults amount for this hour block';
COMMENT ON COLUMN public.hourly_goal_blocks.timer_status IS 'Timer status: idle, running, paused, finished';
COMMENT ON COLUMN public.hourly_goal_blocks.timer_started_at IS 'Timestamp when timer was started';
COMMENT ON COLUMN public.hourly_goal_blocks.timer_paused_at IS 'Timestamp when timer was paused';
COMMENT ON COLUMN public.hourly_goal_blocks.timer_elapsed_seconds IS 'Accumulated elapsed seconds when timer was paused';