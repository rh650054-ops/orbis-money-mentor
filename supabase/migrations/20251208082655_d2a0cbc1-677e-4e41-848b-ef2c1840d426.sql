-- Create monthly challenges table to store user challenges and levels
CREATE TABLE public.monthly_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_desafio TEXT NOT NULL DEFAULT 'dias_trabalhados_mes',
  meta_progresso INTEGER NOT NULL DEFAULT 20,
  progresso_atual INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  mes_referencia TEXT NOT NULL,
  nivel_atual TEXT DEFAULT 'Iniciante',
  xp_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_referencia)
);

-- Enable RLS
ALTER TABLE public.monthly_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own challenges"
ON public.monthly_challenges
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenges"
ON public.monthly_challenges
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges"
ON public.monthly_challenges
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenges"
ON public.monthly_challenges
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_monthly_challenges_updated_at
BEFORE UPDATE ON public.monthly_challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();