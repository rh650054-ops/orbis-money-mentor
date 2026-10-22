-- 22/10/2026 (Rick): two "Pro" accounts had no payment and nobody knew who activated them.
-- 1) Manual activation/deactivation goes through one RPC that requires a reason and logs who did it.
-- 2) A profile created without CPF gets the CPF from the login (cpf@orbis.internal), so Hotmart
--    purchases link by themselves and the CRM/Admin can find the person.

-- ---------- 1) manual subscription log ----------
create table if not exists public.assinatura_manual (
  id          bigserial primary key,
  user_id     uuid not null,
  feito_por   uuid not null,
  acao        text not null check (acao in ('ativar', 'desativar')),
  motivo      text not null check (length(btrim(motivo)) >= 5),
  created_at  timestamptz not null default now()
);
create index if not exists assinatura_manual_user_idx on public.assinatura_manual (user_id, created_at desc);
alter table public.assinatura_manual enable row level security;
drop policy if exists assinatura_manual_admin_le on public.assinatura_manual;
create policy assinatura_manual_admin_le on public.assinatura_manual for select using (public.is_orbis_admin());
-- writes only through the RPC below (security definer)
revoke insert, update, delete on public.assinatura_manual from anon, authenticated;
grant select on public.assinatura_manual to authenticated;

create or replace function public.admin_assinatura_manual(p_user uuid, p_ativar boolean, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if length(v_motivo) < 5 then raise exception 'Escreva o motivo (pelo menos 5 letras).'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'perfil não encontrado'; end if;
  update public.profiles
     set plan_status = case when p_ativar then 'active' else 'expired' end,
         plan_type   = case when p_ativar then 'pro' else 'expired' end,
         is_trial_active = false
   where user_id = p_user;
  insert into public.assinatura_manual (user_id, feito_por, acao, motivo)
  values (p_user, auth.uid(), case when p_ativar then 'ativar' else 'desativar' end, v_motivo);
  return jsonb_build_object('ok', true, 'plan_status', case when p_ativar then 'active' else 'expired' end);
end $$;
revoke execute on function public.admin_assinatura_manual(uuid, boolean, text) from public, anon;
grant execute on function public.admin_assinatura_manual(uuid, boolean, text) to authenticated;

-- last manual action per user, for the Admin list
create or replace function public.admin_assinatura_manual_ultimas()
returns table (user_id uuid, acao text, motivo text, quem text, quando timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (m.user_id) m.user_id, m.acao, m.motivo,
         split_part(btrim(coalesce(p.nickname, '')), ' ', 1), m.created_at
    from public.assinatura_manual m
    left join public.profiles p on p.user_id = m.feito_por
   where public.is_orbis_admin()
   order by m.user_id, m.created_at desc;
$$;
revoke execute on function public.admin_assinatura_manual_ultimas() from public, anon;
grant execute on function public.admin_assinatura_manual_ultimas() to authenticated;

-- ---------- 2) CPF from the login when the profile comes without one ----------
create or replace function public.profiles_cpf_do_login()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_login text; v_cpf text;
begin
  if new.cpf is not null and btrim(new.cpf) <> '' then return new; end if;
  select lower(coalesce(u.email, '')) into v_login from auth.users u where u.id = new.user_id;
  if v_login like '%@orbis.internal' then
    v_cpf := split_part(v_login, '@', 1);
    if public.cpf_valido(v_cpf)
       and not exists (select 1 from public.profiles p where regexp_replace(coalesce(p.cpf,''),'\D','','g') = v_cpf and p.user_id <> new.user_id) then
      new.cpf := v_cpf;
    end if;
  end if;
  return new;
end $$;
-- "a0_" so it runs before the other BEFORE INSERT triggers (alphabetical order)
drop trigger if exists a0_profiles_cpf_do_login on public.profiles;
create trigger a0_profiles_cpf_do_login before insert on public.profiles
  for each row execute function public.profiles_cpf_do_login();

-- profiles that already exist without CPF but log in by CPF (team CPFs stay out: the admin trigger blocks them)
update public.profiles p
   set cpf = split_part(lower(u.email), '@', 1)
  from auth.users u
 where u.id = p.user_id
   and (p.cpf is null or btrim(p.cpf) = '')
   and lower(u.email) like '%@orbis.internal'
   and public.cpf_valido(split_part(lower(u.email), '@', 1))
   and not exists (select 1 from public.profiles q where regexp_replace(coalesce(q.cpf,''),'\D','','g') = split_part(lower(u.email), '@', 1))
   and not exists (select 1 from public.admin_access a where regexp_replace(coalesce(a.cpf,''),'\D','','g') = split_part(lower(u.email), '@', 1));
