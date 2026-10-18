-- ============================================================
-- SECURITY SWEEP — 18/10/2026 (Rick: "não sei se tem alguma falha na segurança
-- que seja possível algum hacker penetrar").
--
-- 1) Subscriber list leak. lista_assinantes / leads_assinantes_no_app /
--    total_assinantes_app are SECURITY DEFINER with no check: ANY signed-in
--    user (a free trial included) could pull the name + e-mail of every paying
--    subscriber through /rest/v1/rpc. Nothing in the app calls them.
--    -> only the server (service_role) keeps access.
-- 2) Views readable without login: vw_custos_ia_dia (AI cost per day) and
--    crm_leads_por_ref (leads per partner code). Unused by the app/CRM.
--    -> no access for anon/authenticated.
-- 3) Hotmart purchase hijack. The trigger that links a pending Hotmart purchase
--    to a profile fired when a user CHANGED their profile e-mail/CPF. Anyone who
--    knew a buyer's e-mail could put it in their own profile and get that
--    buyer's paid plan (152 purchases were waiting to be linked).
--    -> on UPDATE by a normal user, a purchase is linked only to the e-mail the
--       user actually logs in with (auth.users). Signup (service_role) and admins
--       keep the old behaviour.
-- 4) Admin by CPF. Admin power follows the CPF stored in the profile. A user
--    whose profile has no CPF yet could set it to an admin's CPF if that CPF
--    were ever free (admin profile deleted, admin added before signing up).
--    -> nobody but the server/an admin can set a profile CPF that is on the
--       admin list.
-- 5) x1_cinturao_apos_duelo / x1_cinturao_trg callable without login.
--    -> no execute for anon (they run from the trigger).
-- Idempotent, nothing dropped.
-- ============================================================

-- 1) subscriber lists: server only
revoke execute on function public.lista_assinantes() from public, anon, authenticated;
revoke execute on function public.leads_assinantes_no_app() from public, anon, authenticated;
revoke execute on function public.total_assinantes_app() from public, anon, authenticated;
grant execute on function public.lista_assinantes() to service_role;
grant execute on function public.leads_assinantes_no_app() to service_role;
grant execute on function public.total_assinantes_app() to service_role;

-- 2) internal views
revoke select on public.vw_custos_ia_dia from anon, authenticated;
revoke select on public.crm_leads_por_ref from anon, authenticated;

-- 3) Hotmart claim only by the login e-mail when a normal user edits the profile
create or replace function public.reivindicar_compras_hotmart()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  compra record;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  v_confiavel boolean := tg_op = 'INSERT'
                         or coalesce(auth.role(), '') = 'service_role'
                         or public.is_orbis_admin();
  v_login text;
begin
  if not v_confiavel then
    -- a user editing their own profile: only the e-mail they log in with counts
    select lower(btrim(coalesce(u.email, ''))) into v_login from auth.users u where u.id = new.user_id;
    v_email := coalesce(v_login, '');
    v_cpf := '';
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
end $$;

-- 4) an admin CPF can't be taken by a normal user
create or replace function public.profiles_cpf_de_admin()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
begin
  if v_cpf = '' then return new; end if;
  if tg_op = 'UPDATE' and regexp_replace(coalesce(old.cpf, ''), '\D', '', 'g') = v_cpf then return new; end if;
  if coalesce(auth.role(), '') = 'service_role' or public.is_orbis_admin() then return new; end if;
  if exists (select 1 from public.admin_access a
              where regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = v_cpf) then
    raise exception 'CPF indisponível.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.profiles_cpf_de_admin() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_cpf_de_admin' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_profiles_cpf_de_admin before insert or update of cpf on public.profiles
      for each row execute function public.profiles_cpf_de_admin();
  end if;
end $$;

-- 5) trigger-only functions: no direct call without login
revoke execute on function public.x1_cinturao_apos_duelo(uuid, timestamptz) from public, anon;
revoke execute on function public.x1_cinturao_trg() from public, anon;
