-- Contador de uso da IA por usuário/dia (controle de custo + limite por plano).
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Usuário lê o próprio uso (pra mostrar "X de Y mensagens hoje"); a escrita é via service_role (edge function).
DROP POLICY IF EXISTS "users read own ai_usage" ON public.ai_usage;
CREATE POLICY "users read own ai_usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
