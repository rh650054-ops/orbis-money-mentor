-- Adicionar colunas de gamificação ao perfil do usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_check_in_date date,
ADD COLUMN IF NOT EXISTS vision_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS check_in_mood text,
ADD COLUMN IF NOT EXISTS check_in_focus text,
ADD COLUMN IF NOT EXISTS daily_sales_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS check_in_start_time text;

-- Criar índice para melhorar performance nas consultas de streak
CREATE INDEX IF NOT EXISTS idx_profiles_last_check_in ON public.profiles(user_id, last_check_in_date);

-- Comentários explicativos
COMMENT ON COLUMN public.profiles.streak_days IS 'Número consecutivo de dias com check-in';
COMMENT ON COLUMN public.profiles.last_check_in_date IS 'Data do último check-in realizado';
COMMENT ON COLUMN public.profiles.vision_points IS 'Pontos Visionários acumulados pelo usuário';
COMMENT ON COLUMN public.profiles.check_in_mood IS 'Humor do dia no check-in matinal';
COMMENT ON COLUMN public.profiles.check_in_focus IS 'Foco principal do dia';
COMMENT ON COLUMN public.profiles.daily_sales_goal IS 'Meta de vendas diária definida no check-in';
COMMENT ON COLUMN public.profiles.check_in_start_time IS 'Horário de início definido no check-in';