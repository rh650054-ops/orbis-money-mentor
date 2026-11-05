-- 05/11/2026 (Carlos Manoel, influenciador): the CPF in the profile and the CPF you log in
-- with (auth email <cpf>@orbis.internal) drifted apart. The CRM "Abrir / editar" changed only
-- profiles.cpf, so the person kept logging in with that CPF into ANOTHER account (an old,
-- expired one) and saw the full subscription paywall instead of the courtesy account.
--
-- admin_mover_login_cpf(user, cpf, confirmar):
--   * admin only (is_orbis_dono) or service_role;
--   * moves the LOGIN together with the profile CPF, so "the CPF you see is the CPF you type";
--   * if another account logs in with that CPF it is not deleted: its login becomes
--     <cpf>.antiga.<8 chars of id>@orbis.internal and its nickname gets " (antiga)";
--   * confirmar = false only reports who holds that CPF today (the CRM asks before moving);
--   * accounts that log in by real e-mail keep their login; only profiles.cpf changes.
create or replace function public.admin_mover_login_cpf(p_user uuid, p_cpf text, p_confirmar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_alvo text;
  v_meu text;
  v_outro uuid;
  v_outro_nome text;
  v_outro_plano text;
  v_novo_outro text;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_orbis_dono()) then
    raise exception 'Somente admin.' using errcode = '42501';
  end if;
  if not public.cpf_valido(v_cpf) then
    raise exception 'CPF inválido.' using errcode = '23514';
  end if;
  v_alvo := v_cpf || '@orbis.internal';
  select lower(email) into v_meu from auth.users where id = p_user;
  if v_meu is null then raise exception 'Conta não encontrada.'; end if;

  -- account that logs in with this CPF today (if any, and not this one)
  select u.id, p.nickname, p.plan_status into v_outro, v_outro_nome, v_outro_plano
    from auth.users u left join public.profiles p on p.user_id = u.id
   where lower(u.email) = v_alvo and u.id <> p_user;

  if not p_confirmar then
    return jsonb_build_object(
      'login_por_cpf', v_meu like '%@orbis.internal',
      'ja_entra_com_esse_cpf', v_meu = v_alvo,
      'outra_conta', case when v_outro is null then null else
        jsonb_build_object('user_id', v_outro, 'nome', v_outro_nome, 'plano', v_outro_plano) end);
  end if;

  -- the other account keeps everything, only its login moves out of the way
  if v_outro is not null then
    v_novo_outro := v_cpf || '.antiga.' || left(replace(v_outro::text, '-', ''), 8) || '@orbis.internal';
    update auth.users set email = v_novo_outro, updated_at = now() where id = v_outro;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_novo_outro)), updated_at = now()
     where user_id = v_outro and provider = 'email';
    update public.profiles
       set nickname = case when coalesce(nickname, '') ilike '%(antiga)%' then nickname
                           else btrim(coalesce(nickname, '') || ' (antiga)') end,
           cpf = case when regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf then null else cpf end
     where user_id = v_outro;
  end if;

  -- this account: CPF login moves only if it logs in by CPF (real e-mail logins stay)
  if v_meu like '%@orbis.internal' and v_meu <> v_alvo then
    update auth.users set email = v_alvo, updated_at = now() where id = p_user;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_alvo)), updated_at = now()
     where user_id = p_user and provider = 'email';
  end if;
  update public.profiles set cpf = v_cpf where user_id = p_user;

  return jsonb_build_object('ok', true, 'login', case when v_meu like '%@orbis.internal' then v_alvo else v_meu end,
                            'outra_conta_movida_para', v_novo_outro);
end $$;

revoke all on function public.admin_mover_login_cpf(uuid, text, boolean) from public, anon;
grant execute on function public.admin_mover_login_cpf(uuid, text, boolean) to authenticated, service_role;
