-- 22/10/2026 (Rick): the CRM message is signed by whoever is logged in ("a Rayanne", "o Paulo").
-- Already applied via SQL on 22/10; kept here for history.
alter table public.crm_equipe add column if not exists artigo text not null default 'o' check (artigo in ('o','a'));
update public.crm_equipe set artigo = 'a' where user_id = 'd47bf839-c63d-479a-809e-faee8fc3402a';
create or replace function public.crm_equipe_lista()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin'; end if;
  return jsonb_build_object(
    'eu', auth.uid(),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'nome', split_part(btrim(coalesce(p.nickname,'')), ' ', 1),
        'foto', p.avatar_url, 'papel', a.papel, 'artigo', coalesce(e.artigo, 'o'),
        'esteiras', coalesce(e.esteiras, '{}'), 'closer', coalesce(e.closer, false))
        order by a.papel, p.nickname)
      from public.admin_access a
      join public.profiles p on regexp_replace(coalesce(p.cpf,''),'\D','','g') = regexp_replace(coalesce(a.cpf,''),'\D','','g')
      left join public.crm_equipe e on e.user_id = p.user_id
     where a.enabled and regexp_replace(coalesce(p.cpf,''),'\D','','g') <> ''), '[]'::jsonb));
end $function$;
