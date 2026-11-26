-- 26/11/2026 — App Review 5.1.1(i) / 5.1.2(i): AI consent is valid only for the disclosure the
-- vendor actually saw. The 26/11 disclosure adds Cerebras and lists what each feature sends, so
-- permissions given on the 23/11 text no longer release anything.
--
--   * consentimento_ia.versao: the disclosure version the answer refers to. The edge functions
--     (supabase/functions/_shared/consentimento-ia.ts) send data to an AI only when
--     permitido = true AND versao = the current version. Old rows → '2026-11-23' (not current).
--   * consentimento_ia_historico: every answer is kept (grant, refusal, revocation), never updated.
--   * Granting only through responder_consentimento_ia(p_permitido, p_versao) (current app).
--     Direct writes (older app versions) may only REVOKE (permitido = false): an old app can
--     never turn AI on with the old text.
--   * Deleting the account deletes both (on delete cascade), as the privacy policy promises.

alter table public.consentimento_ia add column if not exists versao text;
update public.consentimento_ia set versao = '2026-11-23' where versao is null;

create table if not exists public.consentimento_ia_historico (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  permitido boolean not null,
  versao text,
  origem text not null,
  criado_em timestamptz not null default now()
);
create index if not exists consentimento_ia_historico_user on public.consentimento_ia_historico (user_id, criado_em desc);
alter table public.consentimento_ia_historico enable row level security;
drop policy if exists "consentimento_ia_historico: dono le" on public.consentimento_ia_historico;
create policy "consentimento_ia_historico: dono le" on public.consentimento_ia_historico
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.consentimento_ia_historico from authenticated, anon;
grant select on public.consentimento_ia_historico to authenticated;

-- what existed before this migration enters the history once
insert into public.consentimento_ia_historico (user_id, permitido, versao, origem, criado_em)
select c.user_id, c.permitido, c.versao, 'antes_da_versao', c.respondido_em
from public.consentimento_ia c
where not exists (select 1 from public.consentimento_ia_historico h where h.user_id = c.user_id and h.origem = 'antes_da_versao');

create or replace function public._consentimento_ia_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.consentimento_ia_historico (user_id, permitido, versao, origem)
  values (new.user_id, new.permitido, new.versao, coalesce(nullif(current_setting('vant.consentimento_origem', true), ''), 'direto'));
  return new;
end $$;
revoke all on function public._consentimento_ia_registrar() from public, anon, authenticated;

drop trigger if exists consentimento_ia_registrar on public.consentimento_ia;
create trigger consentimento_ia_registrar after insert or update on public.consentimento_ia
  for each row execute function public._consentimento_ia_registrar();

-- direct writes: revoke only (older app versions keep a working "turn off")
drop policy if exists "consentimento_ia: dono cria" on public.consentimento_ia;
create policy "consentimento_ia: dono cria" on public.consentimento_ia
  for insert to authenticated with check (user_id = auth.uid() and permitido = false);
drop policy if exists "consentimento_ia: dono muda" on public.consentimento_ia;
create policy "consentimento_ia: dono muda" on public.consentimento_ia
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and permitido = false);

-- the only way to grant: says which disclosure version the vendor saw
create or replace function public.responder_consentimento_ia(p_permitido boolean, p_versao text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if p_permitido is null then raise exception 'resposta_invalida' using errcode = '22023'; end if;
  if p_versao is null or p_versao !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'versao_invalida' using errcode = '22023'; end if;
  perform set_config('vant.consentimento_origem', 'app', true);
  insert into public.consentimento_ia (user_id, permitido, versao, respondido_em)
  values (uid, p_permitido, p_versao, now())
  on conflict (user_id) do update set permitido = excluded.permitido, versao = excluded.versao, respondido_em = now();
end $$;
revoke all on function public.responder_consentimento_ia(boolean, text) from public, anon;
grant execute on function public.responder_consentimento_ia(boolean, text) to authenticated;
