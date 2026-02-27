
-- Add unique constraints for CPF, email, and phone on profiles table
-- Using partial unique indexes to allow NULLs (multiple users can have NULL cpf/phone)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique ON public.profiles (cpf) WHERE cpf IS NOT NULL AND cpf != '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (email) WHERE email IS NOT NULL AND email != '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';
