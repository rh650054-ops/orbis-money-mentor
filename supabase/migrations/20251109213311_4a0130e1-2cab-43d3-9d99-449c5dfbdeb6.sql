-- Add CPF and phone fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create unique indexes to prevent duplicate registrations
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique ON public.profiles(cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles(phone) WHERE phone IS NOT NULL;

-- Add comment to explain the constraint
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário - deve ser único no sistema';
COMMENT ON COLUMN public.profiles.phone IS 'Celular do usuário - deve ser único no sistema';