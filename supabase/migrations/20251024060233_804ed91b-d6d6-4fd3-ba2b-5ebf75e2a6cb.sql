-- Criar tabela para registros diários de vendas
CREATE TABLE public.daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_profit NUMERIC DEFAULT 0,
  total_debt NUMERIC DEFAULT 0,
  unpaid_sales INTEGER DEFAULT 0,
  cash_sales NUMERIC DEFAULT 0,
  pix_sales NUMERIC DEFAULT 0,
  card_sales NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Habilitar RLS
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para daily_sales
CREATE POLICY "Users can view their own sales records" 
ON public.daily_sales 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sales records" 
ON public.daily_sales 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales records" 
ON public.daily_sales 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales records" 
ON public.daily_sales 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_sales_updated_at
BEFORE UPDATE ON public.daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela para atividades personalizadas da rotina
CREATE TABLE public.routine_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.routine_activities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para routine_activities
CREATE POLICY "Users can view their own activities" 
ON public.routine_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities" 
ON public.routine_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" 
ON public.routine_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities" 
ON public.routine_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_routine_activities_updated_at
BEFORE UPDATE ON public.routine_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();