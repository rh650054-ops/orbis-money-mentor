-- Create work_sessions table
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  start_timestamp TIMESTAMPTZ NOT NULL,
  end_timestamp TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  planning_date DATE NOT NULL,
  total_vendido NUMERIC DEFAULT 0,
  meta_dia NUMERIC NOT NULL,
  ritmo_ideal_inicial NUMERIC NOT NULL,
  constancia_dia BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create hour_blocks_v2 table
CREATE TABLE IF NOT EXISTS public.hour_blocks_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bloco_index INTEGER NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  ritmo_ideal_hora NUMERIC NOT NULL,
  valor_real NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create daily_reports table
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_vendido NUMERIC NOT NULL,
  melhor_hora INTEGER,
  pior_hora INTEGER,
  ritmo_medio NUMERIC NOT NULL,
  porcentagem_meta NUMERIC NOT NULL,
  conselho TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hour_blocks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.work_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.work_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.work_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.work_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for hour_blocks_v2
CREATE POLICY "Users can view their own blocks"
  ON public.hour_blocks_v2 FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own blocks"
  ON public.hour_blocks_v2 FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blocks"
  ON public.hour_blocks_v2 FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blocks"
  ON public.hour_blocks_v2 FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for daily_reports
CREATE POLICY "Users can view their own reports"
  ON public.daily_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports"
  ON public.daily_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_work_sessions_user_date ON public.work_sessions(user_id, planning_date);
CREATE INDEX idx_hour_blocks_v2_session ON public.hour_blocks_v2(session_id);
CREATE INDEX idx_daily_reports_session ON public.daily_reports(session_id);

-- Create trigger for updated_at
CREATE TRIGGER update_work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hour_blocks_v2_updated_at
  BEFORE UPDATE ON public.hour_blocks_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();