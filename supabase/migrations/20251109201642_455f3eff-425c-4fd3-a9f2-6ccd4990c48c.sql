-- Adicionar colunas para planejamento semanal e controle de ofensiva
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_work_days integer DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_goal numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_daily_goal numeric DEFAULT 200;

-- Criar tabela para rastrear dias trabalhados e folgas planejadas
CREATE TABLE IF NOT EXISTS daily_work_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('worked', 'planned_off', 'missed')),
  goal_achieved boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE daily_work_log ENABLE ROW LEVEL SECURITY;

-- Policies for daily_work_log
CREATE POLICY "Users can view their own work log"
  ON daily_work_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own work log"
  ON daily_work_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work log"
  ON daily_work_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work log"
  ON daily_work_log FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_work_log_updated_at
  BEFORE UPDATE ON daily_work_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();