-- 23/10/2026: the store reviewers (Google/Apple) log in with a demo account created in
-- CRM › Admin › Demo. Those accounts log in with a plain e-mail (no CPF), and the app's
-- "E-mail" tab only knew how to turn a profile e-mail into cpf@orbis.internal, so they
-- could not get in. Fallback: when no CPF profile matches, an auth account whose OWN login
-- e-mail is the typed one (demo accounts only) is accepted after the same bcrypt check and
-- the same 10-tries-per-15-minutes brake. Nothing changes for CPF accounts.
create or replace function public.resolve_login_email(p_email text, p_password text)
 returns text language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_catalog'
as $function$
declare
  v_internal text;
  v_uid uuid;
  v_hash text;
  v_chave text;
  v_erros integer;
  v_janela timestamptz;
begin
  if p_email is null or btrim(p_email) = '' or p_password is null or p_password = '' then
    return null;
  end if;

  v_chave := encode(digest(lower(btrim(p_email)), 'sha256'), 'hex');

  select tentativas, janela into v_erros, v_janela
    from public.login_tentativas where chave = v_chave;

  if v_janela is not null and v_janela > now() - interval '15 minutes'
     and coalesce(v_erros, 0) >= 10 then
    return null;
  end if;

  if v_janela is null or v_janela <= now() - interval '15 minutes' then
    insert into public.login_tentativas (chave, tentativas, janela)
    values (v_chave, 0, now())
    on conflict (chave) do update set tentativas = 0, janela = now();
  end if;

  -- CPF account: personal e-mail in the profile -> cpf@orbis.internal
  select (regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g') || '@orbis.internal'),
         p.user_id
    into v_internal, v_uid
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email))
    and regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g') <> ''
  limit 1;

  -- demo account (CRM › Admin › Demo): the login e-mail itself, only for is_demo profiles
  if v_uid is null then
    select lower(u.email), u.id into v_internal, v_uid
      from auth.users u join public.profiles p on p.user_id = u.id
     where lower(u.email) = lower(btrim(p_email))
       and coalesce(p.is_demo, false)
     limit 1;
  end if;

  if v_uid is null then
    update public.login_tentativas set tentativas = tentativas + 1 where chave = v_chave;
    return null;
  end if;

  select u.encrypted_password into v_hash from auth.users u where u.id = v_uid;
  if v_hash is null then
    update public.login_tentativas set tentativas = tentativas + 1 where chave = v_chave;
    return null;
  end if;

  if v_hash = crypt(p_password, v_hash) then
    delete from public.login_tentativas where chave = v_chave;
    return v_internal;
  end if;

  update public.login_tentativas set tentativas = tentativas + 1 where chave = v_chave;
  return null;
end;
$function$;
