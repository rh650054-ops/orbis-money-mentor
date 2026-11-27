-- 27/11/2026: the Apple Sandbox test account (teste.sandbox.rick@vant.com.br) could no longer log in.
-- Why: accounts without a CPF log in through the "E-mail" tab only via the fallback of 23/10/2026,
-- which accepts an auth account whose OWN login e-mail is the typed one ONLY when profiles.is_demo.
-- Turning that account into a Sandbox account (is_demo = false, authorized by Rick) closed the only
-- door it had; the password itself never changed (Supabase Auth recorded no failed password grant).
-- Fix: the same fallback also accepts accounts registered in public.apple_contas_de_teste (the
-- Apple Sandbox test accounts, added and removed only by the backend). Same bcrypt check, same
-- 10-tries-per-15-minutes brake. Nothing changes for CPF accounts or demo accounts; a CPF-less
-- account that is neither demo nor Sandbox test is still refused, as before.
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

  select (regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g') || '@orbis.internal'),
         p.user_id
    into v_internal, v_uid
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email))
    and regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g') <> ''
  limit 1;

  if v_uid is null then
    select lower(u.email), u.id into v_internal, v_uid
      from auth.users u join public.profiles p on p.user_id = u.id
     where lower(u.email) = lower(btrim(p_email))
       and (coalesce(p.is_demo, false)
            or exists (select 1 from public.apple_contas_de_teste t where t.user_id = u.id))
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
