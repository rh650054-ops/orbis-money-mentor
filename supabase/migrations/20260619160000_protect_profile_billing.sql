-- SEGURANÇA (CRÍTICO): impede que um usuário comum se auto-conceda acesso grátis
-- editando o próprio perfil. A policy de UPDATE em profiles não tinha checagem por
-- coluna, então o cliente conseguia rodar:
--   update profiles set is_demo=true, billing_exempt=true, plan_status='active'
-- e liberar acesso pago/ilimitado sem pagar nada.
--
-- Aqui um trigger BEFORE UPDATE "tranca" as colunas de billing/acesso pra usuários
-- comuns, MAS:
--   - permite os rebaixamentos legítimos (expirar o teste: plan_status->'expired',
--     is_trial_active->false), que o app/RPC fazem como o próprio usuário;
--   - deixa a service role (edge functions / webhooks Hotmart) livre pra ativar.

CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Edge functions / webhooks usam a SERVICE ROLE key -> liberados pra tudo.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Colunas de acesso/billing são IMUTÁVEIS pro usuário comum.
  NEW.is_demo         := OLD.is_demo;
  NEW.billing_exempt  := OLD.billing_exempt;
  NEW.plan_type       := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id;
  NEW.trial_start     := OLD.trial_start;
  NEW.trial_end       := OLD.trial_end;

  -- plan_status: só pode virar 'expired' (rebaixar). Bloqueia 'active' e afins.
  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired' THEN
    NEW.plan_status := OLD.plan_status;
  END IF;

  -- is_trial_active: só pode DESLIGAR (true -> false). Bloqueia reativar.
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
