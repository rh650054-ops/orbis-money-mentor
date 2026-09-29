-- ============================================================================
-- BUG-001 parte 2 — Recuperacao de senha self-service por e-mail
-- ----------------------------------------------------------------------------
-- A conta no Auth usa e-mail interno (<CPF>@orbis.internal), entao o reset
-- nativo do Supabase nunca chega na pessoa. O novo fluxo manda o link de
-- recovery (gerado pelo servidor) para o e-mail PESSOAL do perfil — mas so
-- depois que esse e-mail foi confirmado com um codigo de 6 digitos, porque o
-- e-mail do perfil e digitado livremente no cadastro (qualquer um poderia
-- cadastrar o e-mail de outra pessoa e roubar a conta pelo reset).
--
-- Nada aqui e aberto ao cliente: a tabela de codigos tem RLS ligado e ZERO
-- policies (so o service_role, via edge function, le e escreve).
-- ============================================================================

-- 1. Marca de "e-mail confirmado" no perfil (NULL = nunca confirmou)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verificado_em timestamptz;

COMMENT ON COLUMN public.profiles.email_verificado_em IS
  'Quando a pessoa confirmou o e-mail com codigo. NULL = nao confirmado; reset de senha por e-mail exige NOT NULL.';

-- 2. Codigos de confirmacao (um por usuario; substitui o anterior)
CREATE TABLE IF NOT EXISTS public.email_codigos (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  codigo_hash  text NOT NULL,           -- sha256 do codigo; o codigo em si nunca e gravado
  expira_em    timestamptz NOT NULL,
  tentativas   integer NOT NULL DEFAULT 0,
  enviado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_codigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_codigos FROM anon, authenticated;

COMMENT ON TABLE public.email_codigos IS
  'Codigos de confirmacao de e-mail. Sem policies de proposito: acesso apenas pelo service_role (edge function email-confirmar).';
