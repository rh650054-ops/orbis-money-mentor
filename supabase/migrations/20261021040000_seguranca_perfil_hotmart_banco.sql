-- ============================================================
-- Segurança antes das lojas (Rick aprovou em 21/10/2026). Auditoria de 20/10.
-- ============================================================

-- 1) PERFIL: o usuário não apaga mais o próprio perfil (a exclusão de conta é pela
--    função delete-my-account, no servidor) e, na CRIAÇÃO, os campos de plano são
--    sempre os do teste grátis. Antes: apagar + recriar o perfil pela API deixava
--    gravar plan_status='active', billing_exempt=true etc. (Pro de graça).
drop policy if exists "Users can delete their own profile" on public.profiles;

create or replace function public.profiles_protege_criacao()
returns trigger language plpgsql set search_path = public as $$
begin
  -- servidor (service_role), admin e o gatilho de cadastro (handle_new_user, sem JWT) passam
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_orbis_admin() then
    return new;
  end if;
  new.plan_status      := 'trial';
  new.plan_type        := 'trial';
  new.is_trial_active  := true;
  new.trial_start      := (now() at time zone 'America/Sao_Paulo')::date;
  new.trial_end        := (now() at time zone 'America/Sao_Paulo')::date + 3;
  new.billing_exempt   := false;
  new.is_demo          := false;
  new.subscription_id  := null;
  new.verificado       := false;
  new.verificado_em    := null;
  new.verificado_por   := null;
  new.ranking_hidden   := false;
  new.vision_points    := 0;
  new.streak_days      := 0;
  if coalesce(current_setting('vant.fixar_origem', true), '') <> '1' then
    new.origem_ref := null;
    new.origem_fixada_em := null;
  end if;
  return new;
end $$;
-- nome com "a_" pra rodar ANTES dos outros gatilhos de criação (ordem alfabética)
drop trigger if exists a_profiles_protege_criacao on public.profiles;
create trigger a_profiles_protege_criacao before insert on public.profiles
  for each row execute function public.profiles_protege_criacao();

-- 2) COMPRA DA HOTMART só liga pela conta de LOGIN.
--    a) cadastro feito pelo app (cliente) não é mais "confiável": e-mail = o do login,
--       CPF não vale (antes, quem criava o perfil com o e-mail/CPF de um comprador
--       puxava a compra dele).
create or replace function public.reivindicar_compras_hotmart()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  compra record;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  v_confiavel boolean := coalesce(auth.role(), '') = 'service_role'
                         or public.is_orbis_admin()
                         or (tg_op = 'INSERT' and coalesce(auth.role(), '') not in ('authenticated', 'anon'));
  v_login text;
begin
  if not v_confiavel then
    select lower(btrim(coalesce(u.email, ''))) into v_login from auth.users u where u.id = new.user_id;
    v_email := coalesce(v_login, '');
    -- conta de login por CPF: o CPF dela é o do login, não o digitado
    v_cpf := case when v_email like '%@orbis.internal' then split_part(v_email, '@', 1) else '' end;
    if v_email like '%@orbis.internal' then v_email := ''; end if;
  end if;
  if v_email = '' and v_cpf = '' then return new; end if;
  select * into compra from public.unlinked_purchases
   where linked_at is null
     and (upper(coalesce(event_type,'')) like '%PURCHASE_APPROVED%'
          or upper(coalesce(event_type,'')) like '%PURCHASE_COMPLETE%'
          or upper(coalesce(event_type,'')) like '%SUBSCRIPTION_RENEWAL%')
     and ((v_email <> '' and lower(btrim(coalesce(buyer_email,''))) = v_email)
          or (v_cpf <> '' and regexp_replace(coalesce(buyer_cpf,''), '\D', '', 'g') = v_cpf))
   order by created_at desc limit 1;
  if compra.id is null then return new; end if;
  insert into public.subscriptions (user_id, provider, status, current_period_end, grace_until,
                                    hotmart_purchase_id, hotmart_subscription_id, last_event_at)
  values (new.user_id, 'hotmart', 'active', now() + interval '30 days', now() + interval '33 days',
          compra.hotmart_purchase_id, compra.hotmart_subscription_id, now())
  on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end,
    grace_until = excluded.grace_until, hotmart_purchase_id = excluded.hotmart_purchase_id,
    hotmart_subscription_id = excluded.hotmart_subscription_id, last_event_at = now(), updated_at = now();
  update public.unlinked_purchases set linked_at = now(), linked_to_user_id = new.user_id where id = compra.id;
  new.plan_status := 'active';
  new.is_trial_active := false;
  return new;
end $function$;

--    b) o webhook acha o dono pela CONTA DE LOGIN (cpf@orbis.internal ou e-mail do
--       login), nunca pelo e-mail digitado no perfil (que qualquer um troca).
--       Últimos 60 dias: 170 de 173 compras já casavam pelo CPF do login.
create or replace function public.orbis_achar_usuario(p_email text, p_cpf text)
returns uuid language plpgsql security definer set search_path = public as $function$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
        v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if v_cpf <> '' then
    select id into v_id from auth.users where lower(email) = v_cpf || '@orbis.internal' limit 1;
    if v_id is not null then return v_id; end if;
    -- conta de e-mail que tem esse CPF no perfil (CPF é único e não muda depois de gravado)
    select user_id into v_id from public.profiles where regexp_replace(coalesce(cpf,''), '\D', '', 'g') = v_cpf limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  if v_email <> '' then
    select id into v_id from auth.users where lower(email) = v_email limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  return null;
end $function$;

-- 3) CPF único também no formato só-números (o índice antigo comparava o texto cru)
create unique index if not exists profiles_cpf_digitos_unique
  on public.profiles ((regexp_replace(cpf, '\D', '', 'g'))) where cpf is not null and btrim(cpf) <> '';

-- 4) DADOS DO BANCO: só o servidor grava (Pluggy/Mercado Pago). Antes o usuário podia
--    editar/apagar o próprio extrato (comprovante de renda, gastos, verificado).
revoke insert, update, delete on public.extrato_lancamentos from anon, authenticated;
drop policy if exists extrato_lanc_upd on public.extrato_lancamentos;
drop policy if exists extrato_lanc_del on public.extrato_lancamentos;
revoke insert, update, delete on public.bank_connections, public.auto_detected_sales from anon, authenticated;
drop policy if exists "Users insert own bank_connections" on public.bank_connections;
drop policy if exists "Users update own bank_connections" on public.bank_connections;
drop policy if exists "Users delete own bank_connections" on public.bank_connections;
drop policy if exists "Users insert own auto_detected_sales" on public.auto_detected_sales;
drop policy if exists "Users update own auto_detected_sales" on public.auto_detected_sales;
drop policy if exists "Users delete own auto_detected_sales" on public.auto_detected_sales;

-- 5) FUNÇÕES QUE VAZAVAM DADOS ou são do sistema: fora do alcance do usuário comum
--    (o servidor e o cron continuam usando).
revoke execute on function public.lista_cortesias() from public, anon, authenticated;
revoke execute on function public.leads_registrados_no_app() from public, anon, authenticated;
revoke execute on function public.parceiros_painel(text, text) from public, anon, authenticated;
revoke execute on function public.parceiros_resumo(text) from public, anon, authenticated;
revoke execute on function public.resumo_mensal(numeric) from public, anon, authenticated;
revoke execute on function public.expire_overdue_subscriptions() from public, anon, authenticated;
revoke execute on function public.cleanup_old_rate_limits() from public, anon, authenticated;
