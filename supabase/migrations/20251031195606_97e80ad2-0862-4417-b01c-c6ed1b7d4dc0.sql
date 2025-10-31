-- Adicionar constraint única para prevenir duplicatas no checklist
-- Isso garante que não pode haver duas entradas com o mesmo user_id, date, activity_name e activity_time
ALTER TABLE public.daily_checklist 
ADD CONSTRAINT daily_checklist_unique_activity 
UNIQUE (user_id, date, activity_name, activity_time);