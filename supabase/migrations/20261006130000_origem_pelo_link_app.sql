-- ============================================================
-- ORIGEM PELO LINK DO APP — 06/10/2026
-- Rick: "outra maneira de criar link de influenciador sem depender do cupom? algo sem falhas?"
-- Furo: quem entrava pelo link do APP (/r/CODIGO) só tinha o código guardado no aparelho.
-- A conta só ganhava a origem se viesse da landing (lead com o mesmo e-mail) ou se a
-- compra chegasse com o cupom. Abriu no Instagram e assinou pelo Chrome/PC → venda sem dono.
-- Agora, logo depois do login, o app manda o código guardado e o servidor grava na CONTA
-- (origem_ref). Daí em diante qualquer aparelho monta o checkout com sck=CODIGO, e o
-- orbis_atribuicao já reconhece o perfil ('link') e o sck ('cupom').
-- Regras do carimbo (dinheiro de parceiro, então o servidor decide):
--   • só grava se a conta ainda NÃO tem origem (primeiro que trouxe, pra sempre);
--   • só código de parceiro ATIVO;
--   • só contas novas (até 7 dias de criadas) — impede alguém "adotar" cliente antigo.
-- ============================================================

-- a trava de colunas do perfil continua barrando o usuário; abre só quando a escrita
-- vem desta função (flag local da transação, que o PostgREST não deixa o cliente setar)
create or replace function public.protect_profile_billing_columns()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_orbis_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.cpf IS NOT NULL AND btrim(OLD.cpf) <> '' THEN
    NEW.cpf := OLD.cpf;
  END IF;

  NEW.is_demo         := OLD.is_demo;
  NEW.billing_exempt  := OLD.billing_exempt;
  NEW.plan_type       := OLD.plan_type;
  NEW.subscription_id := OLD.subscription_id;
  NEW.trial_start     := OLD.trial_start;
  NEW.trial_end       := OLD.trial_end;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status AND NEW.plan_status <> 'expired' THEN
    NEW.plan_status := OLD.plan_status;
  END IF;

  IF COALESCE(NEW.is_trial_active, false) AND NOT COALESCE(OLD.is_trial_active, false) THEN
    NEW.is_trial_active := OLD.is_trial_active;
  END IF;

  NEW.verificado     := OLD.verificado;
  NEW.verificado_em  := OLD.verificado_em;
  NEW.verificado_por := OLD.verificado_por;

  NEW.ranking_hidden := OLD.ranking_hidden;

  -- Origem da indicação: permanente. Só o gatilho de cadastro, o webhook da Hotmart
  -- (service_role) e parc_fixar_minha_origem (flag abaixo, e só quando está vazia).
  IF NOT (coalesce(current_setting('vant.fixar_origem', true), '') = '1' AND OLD.origem_ref IS NULL) THEN
    NEW.origem_ref       := OLD.origem_ref;
    NEW.origem_fixada_em := OLD.origem_fixada_em;
  END IF;

  NEW.vision_points := OLD.vision_points;
  NEW.streak_days   := OLD.streak_days;

  RETURN NEW;
END;
$function$;

create or replace function public.parc_fixar_minha_origem(p_code text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_atual text; v_criado timestamptz; v_ok text;
begin
  if v_uid is null then return null; end if;
  select origem_ref, created_at into v_atual, v_criado from public.profiles where user_id = v_uid;
  if not found then return null; end if;
  -- já tem dono: devolve (o app usa pra montar o checkout em qualquer aparelho)
  if v_atual is not null then return upper(btrim(v_atual)); end if;
  if length(v_code) < 3 then return null; end if;
  if v_criado < now() - interval '7 days' then return null; end if;
  select code into v_ok from public.parceiros where upper(code) = v_code and status = 'ativo';
  if v_ok is null then return null; end if;

  perform set_config('vant.fixar_origem', '1', true);
  update public.profiles set origem_ref = v_ok, origem_fixada_em = now()
   where user_id = v_uid and origem_ref is null;
  perform set_config('vant.fixar_origem', '', true);
  return v_ok;
end $$;

revoke all on function public.parc_fixar_minha_origem(text) from public, anon;
grant execute on function public.parc_fixar_minha_origem(text) to authenticated;
