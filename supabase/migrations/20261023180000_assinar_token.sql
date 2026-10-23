-- 23/10/2026 (Rick): in the store app, "Assinar" opens app.vantapp.com.br/assinar in the
-- phone browser — a page that already knows who is subscribing (name, e-mail, phone) and
-- sends the person to Hotmart with the data prefilled, without logging in again.
-- The app asks for a one-time token (30 min); the page reads it without a session.
create table if not exists public.assinar_tokens (
  token      text primary key,
  user_id    uuid not null,
  criado_em  timestamptz not null default now(),
  usado_em   timestamptz
);
alter table public.assinar_tokens enable row level security;
revoke all on public.assinar_tokens from anon, authenticated;

create or replace function public.assinar_token_criar()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  delete from public.assinar_tokens where criado_em < now() - interval '1 day';
  insert into public.assinar_tokens (token, user_id) values (v_token, auth.uid());
  return v_token;
end $$;
revoke execute on function public.assinar_token_criar() from public, anon;
grant execute on function public.assinar_token_criar() to authenticated;

create or replace function public.assinar_token_ler(p_token text)
returns table (nome text, email text, telefone text, user_id uuid, plano_atual text)
language sql stable security definer set search_path = public as $$
  select split_part(btrim(coalesce(p.nickname, '')), ' ', 1),
         case when lower(coalesce(p.email,'')) like '%@orbis.internal' then null else p.email end,
         p.phone, p.user_id,
         case when exists (select 1 from public.orbis_pro o where o.user_id = p.user_id and o.ativo and o.cancelado_em is null and (o.expira_em is null or o.expira_em > now())) then 'pro'
              when exists (select 1 from public.subscriptions s where s.user_id = p.user_id and s.status in ('active','past_due')) then 'essencial'
              else null end
    from public.assinar_tokens t join public.profiles p on p.user_id = t.user_id
   where t.token = p_token and t.criado_em > now() - interval '30 minutes';
$$;
revoke execute on function public.assinar_token_ler(text) from public;
grant execute on function public.assinar_token_ler(text) to anon, authenticated;
