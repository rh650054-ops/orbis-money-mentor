-- ============================================================================
-- SEGURANCA CRITICA — fecha 3 buracos de uma vez (idempotente):
--   1. Usuario se auto-conceder assinatura paga (self-INSERT em subscriptions).
--   2. Usuario virar ADMIN trocando o proprio CPF pro do dono (coluna cpf sem trava).
--   3. Admin NAO conseguir ativar assinatura pelo painel (o trigger bloqueava ate o admin).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) subscriptions: tira o self-INSERT do usuario. So o service_role
--     (webhooks Hotmart/Pluggy) pode escrever. O usuario continua so LENDO a
--     propria assinatura.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- ---------------------------------------------------------------------------
-- (2)+(3) Trigger de billing do profiles:
--   - trava a coluna CPF depois de definida  -> ninguem vira admin trocando o CPF;
--   - da bypass pros admins de verdade (admin_access) -> admin consegue ATIVAR.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Edge functions / webhooks usam a SERVICE ROLE -> liberados pra tudo.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins do Orbis (reconhecidos por admin_access). SEGURO porque o CPF e'
  -- imutavel logo abaixo: usuario comum nao consegue virar admin trocando o CPF.
  IF public.is_orbis_admin() THEN
    RETURN NEW;
  END IF;

  -- ===== usuario comum: identidade e billing sao IMUTAVEIS =====

  -- CPF imutavel depois de definido (fecha a invasao "virar admin pelo CPF").
  -- Permite definir na 1a vez (cadastro), bloqueia trocar depois.
  IF OLD.cpf IS NOT NULL AND btrim(OLD.cpf) <> '' THEN
    NEW.cpf := OLD.cpf;
  END IF;

  NEW.is_demo         := OLD.is_demo;
  NEW.billing_exempt  := OLD.billing_exempt;
  NEW.plan_type       := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id;
  NEW.trial_start     := OLD.trial_start;
  NEW.trial_end       := OLD.trial_end;

  -- plan_status: usuario comum so pode REBAIXAR pra 'expired'. Bloqueia 'active'.
  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired' THEN
    NEW.plan_status := OLD.plan_status;
  END IF;

  -- is_trial_active: so pode DESLIGAR (true -> false). Bloqueia reativar.
  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) THEN
    NEW.is_trial_active := OLD.is_trial_active;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing ON public.profiles;
CREATE TRIGGER protect_profile_billing
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing_columns();

-- Teste rapido (opcional, rode logado como um usuario comum no app):
--   - tentar update profiles set plan_status='active' -> deve continuar como estava
--   - tentar update profiles set cpf='<outro>' -> deve continuar com o cpf antigo
-- E no painel admin, o botao "Ativar" agora deve mudar o plan_status de verdade.
