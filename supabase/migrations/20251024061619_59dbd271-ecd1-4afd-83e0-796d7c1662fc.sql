-- Adicionar constraint UNIQUE para permitir upsert correto no daily_sales
ALTER TABLE daily_sales
ADD CONSTRAINT daily_sales_user_date_unique UNIQUE (user_id, date);