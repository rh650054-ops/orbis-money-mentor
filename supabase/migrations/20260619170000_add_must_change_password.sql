-- Adiciona flag para forçar troca de senha temporária gerada pelo admin.
-- Setada como true pelo admin-reset-password; o próprio usuário limpa ao trocar a senha.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
