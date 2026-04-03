
-- Add unique constraints for CPF and phone to prevent duplicate registrations
-- Using partial unique indexes to allow NULL values (optional fields)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique ON public.profiles (cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;
