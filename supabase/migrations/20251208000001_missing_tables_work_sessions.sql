-- Create work_sessions table (was created directly in old Supabase dashboard, not via migration)
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_date DATE NOT NULL,
  start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_timestamp TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  meta_dia NUMERIC NOT NULL DEFAULT 0,
  total_vendido NUMERIC DEFAULT 0,
  ritmo_ideal_inicial NUMERIC NOT NULL DEFAULT 0,
  constancia_dia BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own work sessions"
  ON public.work_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own work sessions"
  ON public.work_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work sessions"
  ON public.work_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work sessions"
  ON public.work_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create hour_blocks_v2 table (also missing from migrations)
CREATE TABLE IF NOT EXISTS public.hour_blocks_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bloco_index INTEGER NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  ritmo_ideal_hora NUMERIC NOT NULL DEFAULT 0,
  valor_real NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.hour_blocks_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hour blocks v2"
  ON public.hour_blocks_v2 FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hour blocks v2"
  ON public.hour_blocks_v2 FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hour blocks v2"
  ON public.hour_blocks_v2 FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hour blocks v2"
  ON public.hour_blocks_v2 FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_hour_blocks_v2_updated_at
  BEFORE UPDATE ON public.hour_blocks_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create daily_reports table (also missing from migrations)
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_vendido NUMERIC NOT NULL DEFAULT 0,
  porcentagem_meta NUMERIC NOT NULL DEFAULT 0,
  ritmo_medio NUMERIC NOT NULL DEFAULT 0,
  melhor_hora INTEGER DEFAULT NULL,
  pior_hora INTEGER DEFAULT NULL,
  conselho TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily reports"
  ON public.daily_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily reports"
  ON public.daily_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily reports"
  ON public.daily_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily reports"
  ON public.daily_reports FOR DELETE
  USING (auth.uid() = user_id);
