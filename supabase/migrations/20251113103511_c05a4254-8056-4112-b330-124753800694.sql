-- Adicionar colunas para trial de 3 dias
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_days_remaining integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone DEFAULT now();

-- Atualizar perfis existentes para começar trial
UPDATE profiles 
SET trial_days_remaining = 3, 
    trial_started_at = now()
WHERE trial_days_remaining IS NULL;
