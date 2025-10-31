-- Adicionar campos para contas demo na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN is_demo boolean DEFAULT false,
  ADD COLUMN demo_created_by uuid NULL,
  ADD COLUMN demo_note text DEFAULT 'Conta de demonstração criada manualmente',
  ADD COLUMN billing_exempt boolean DEFAULT false;

-- Criar índice para consultas de contas demo
CREATE INDEX idx_profiles_is_demo ON public.profiles(is_demo) WHERE is_demo = true;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.is_demo IS 'Indica se a conta é uma conta demo sem restrições';
COMMENT ON COLUMN public.profiles.demo_created_by IS 'UUID do admin que criou a conta demo';
COMMENT ON COLUMN public.profiles.demo_note IS 'Nota sobre o propósito da conta demo';
COMMENT ON COLUMN public.profiles.billing_exempt IS 'Isenta a conta de verificações de pagamento';