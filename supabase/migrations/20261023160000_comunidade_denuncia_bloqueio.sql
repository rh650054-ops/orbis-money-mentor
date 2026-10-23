-- 23/10/2026: the stores (Google UGC policy, Apple 1.2) require, in apps where users post
-- content: report a post/comment/user, block a user, and moderation. The community had none.
--  • community_denuncias: who reported what and why. 3 different people reporting the same
--    post/comment hides it on its own (is_deleted = true) until the team reviews it.
--  • community_bloqueios: who blocked whom; the feed and comments hide blocked authors.

create table if not exists public.community_denuncias (
  id           bigserial primary key,
  denunciante  uuid not null default auth.uid(),
  post_id      uuid references public.community_posts(id) on delete cascade,
  comment_id   uuid references public.community_comments(id) on delete cascade,
  denunciado   uuid not null,
  motivo       text not null check (motivo in ('ofensivo','golpe','spam','sexual','outro')),
  detalhe      text check (detalhe is null or length(detalhe) <= 500),
  status       text not null default 'aberta' check (status in ('aberta','removida','mantida')),
  criado_em    timestamptz not null default now(),
  check (post_id is not null or comment_id is not null),
  unique (denunciante, post_id, comment_id)
);
create index if not exists community_denuncias_status_idx on public.community_denuncias (status, criado_em desc);
alter table public.community_denuncias enable row level security;
drop policy if exists denuncias_le on public.community_denuncias;
create policy denuncias_le on public.community_denuncias for select
  using (denunciante = auth.uid() or public.is_orbis_admin());
revoke insert, update, delete on public.community_denuncias from anon, authenticated;
grant select on public.community_denuncias to authenticated;

create table if not exists public.community_bloqueios (
  quem       uuid not null default auth.uid(),
  bloqueado  uuid not null,
  criado_em  timestamptz not null default now(),
  primary key (quem, bloqueado),
  check (quem <> bloqueado)
);
alter table public.community_bloqueios enable row level security;
drop policy if exists bloqueios_meus on public.community_bloqueios;
create policy bloqueios_meus on public.community_bloqueios for select using (quem = auth.uid());
drop policy if exists bloqueios_insere on public.community_bloqueios;
create policy bloqueios_insere on public.community_bloqueios for insert with check (quem = auth.uid());
drop policy if exists bloqueios_apaga on public.community_bloqueios;
create policy bloqueios_apaga on public.community_bloqueios for delete using (quem = auth.uid());
grant select, insert, delete on public.community_bloqueios to authenticated;

-- report: one per person per item; the 3rd distinct report hides the item
create or replace function public.community_denunciar(p_post uuid, p_comment uuid, p_motivo text, p_detalhe text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_autor uuid; v_n int; v_escondeu boolean := false;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if (p_post is null) = (p_comment is null) then raise exception 'informe o post ou o comentário'; end if;
  if p_comment is not null then
    select user_id into v_autor from public.community_comments where id = p_comment;
  else
    select user_id into v_autor from public.community_posts where id = p_post;
  end if;
  if v_autor is null then raise exception 'não encontrado'; end if;
  if v_autor = auth.uid() then raise exception 'não dá pra denunciar o próprio conteúdo'; end if;

  insert into public.community_denuncias (denunciante, post_id, comment_id, denunciado, motivo, detalhe)
  values (auth.uid(), case when p_comment is null then p_post end, p_comment, v_autor,
          coalesce(nullif(p_motivo, ''), 'outro'), nullif(btrim(coalesce(p_detalhe, '')), ''))
  on conflict (denunciante, post_id, comment_id) do nothing;

  select count(distinct denunciante) into v_n from public.community_denuncias
   where status = 'aberta'
     and ((p_comment is not null and comment_id = p_comment) or (p_comment is null and post_id = p_post));
  if v_n >= 3 then
    if p_comment is not null then
      update public.community_comments set is_deleted = true where id = p_comment and not is_deleted;
    else
      update public.community_posts set is_deleted = true where id = p_post and not is_deleted;
    end if;
    v_escondeu := true;
  end if;
  return jsonb_build_object('ok', true, 'escondido', v_escondeu);
end $$;
revoke execute on function public.community_denunciar(uuid, uuid, text, text) from public, anon;
grant execute on function public.community_denunciar(uuid, uuid, text, text) to authenticated;

-- team moderation (CRM › Admin › Denúncias): open reports grouped by item, and the decision
create or replace function public.admin_denuncias_abertas()
returns table (post_id uuid, comment_id uuid, autor text, texto text, imagem text, motivos text,
               denuncias int, escondido boolean, primeira timestamptz)
language sql stable security definer set search_path = public as $$
  select d.post_id, d.comment_id,
         coalesce(cp.nickname, cc.nickname, 'Vendedor'),
         coalesce(cc.content, cp.content, ''),
         cp.image_url,
         string_agg(distinct d.motivo, ', '),
         count(distinct d.denunciante)::int,
         coalesce(cc.is_deleted, cp.is_deleted, false),
         min(d.criado_em)
    from public.community_denuncias d
    left join public.community_posts cp on cp.id = d.post_id
    left join public.community_comments cc on cc.id = d.comment_id
   where d.status = 'aberta' and public.is_orbis_admin()
   group by d.post_id, d.comment_id, cp.nickname, cc.nickname, cc.content, cp.content, cp.image_url, cc.is_deleted, cp.is_deleted
   order by min(d.criado_em);
$$;
revoke execute on function public.admin_denuncias_abertas() from public, anon;
grant execute on function public.admin_denuncias_abertas() to authenticated;

create or replace function public.admin_denuncia_resolver(p_post uuid, p_comment uuid, p_remover boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if p_comment is not null then
    update public.community_comments set is_deleted = p_remover where id = p_comment;
    update public.community_denuncias set status = case when p_remover then 'removida' else 'mantida' end
     where comment_id = p_comment and status = 'aberta';
  else
    update public.community_posts set is_deleted = p_remover where id = p_post;
    update public.community_denuncias set status = case when p_remover then 'removida' else 'mantida' end
     where post_id = p_post and comment_id is null and status = 'aberta';
  end if;
end $$;
revoke execute on function public.admin_denuncia_resolver(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_denuncia_resolver(uuid, uuid, boolean) to authenticated;
