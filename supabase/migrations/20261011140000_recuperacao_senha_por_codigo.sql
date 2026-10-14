-- ============================================================
-- RECUPERAÇÃO DE SENHA POR CÓDIGO (Rick, 11/10/2026)
-- Fluxo: CPF → código de 6 dígitos no e-mail CONFIRMADO → o servidor valida →
-- token de troca (uso único, 10 min) → nova senha pelo Auth admin → sessões derrubadas.
--
-- Este arquivo:
--   1. profiles: de onde veio a confirmação (email_verificado_por) e histórico sem prova
--      (email_verificado_legado_em). Nada é apagado.
--   2. trava: o app (anon/authenticated) não escreve email_verificado_*, nem no cadastro;
--      trocar o e-mail zera a confirmação e invalida códigos/desafios pendentes.
--   3. email_codigos: tipo (codigo|link) e confirmação ATÔMICA presa ao e-mail atual
--      (não restaura mais um e-mail substituído).
--   4. senha_desafios: hash do código preso a um id aleatório, 15 min, 5 tentativas,
--      uso único; reenviar invalida o anterior.
--   5. funções só do servidor (service_role): criar / verificar / consumir troca /
--      reabrir / concluir (derruba sessões).
--   6. email_confirmar_por_recuperacao vira no-op (sessão comum não prova posse do e-mail).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. de onde veio a confirmação + histórico
-- ------------------------------------------------------------
alter table public.profiles add column if not exists email_verificado_por text;
alter table public.profiles add column if not exists email_verificado_legado_em timestamptz;

comment on column public.profiles.email_verificado_por is
  'Prova de posse do e-mail: codigo (código de 6 dígitos), link (link do cadastro), app (código ou link antes de 11/10/2026). Só o servidor escreve.';
comment on column public.profiles.email_verificado_legado_em is
  'Carimbo antigo SEM prova de posse (lote de 29/09/2026 e confirmação por recuperação de 08/10). Guardado como histórico; não libera recuperação de senha.';

-- Avaliação do histórico (consultas de 11/10):
--   • 796 carimbos em 29/09 17:37 UTC, num lote só, direto no banco: sem prova.
--   • 1 carimbo em 08/10 via email_confirmar_por_recuperacao(): sem prova.
--     Os dois vieram de now() no SQL (precisão de microssegundo).
--   • 10 carimbos do app (código/link), gravados pelo servidor em milissegundo: com prova.
-- Os sem prova vão pro histórico; os com prova ficam valendo como 'app'.
do $$
begin
  -- bypass das travas de perfil só dentro desta transação (protect_* checam auth.role())
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  alter table public.profiles disable trigger update_profiles_updated_at;

  update public.profiles
     set email_verificado_legado_em = email_verificado_em,
         email_verificado_em = null
   where email_verificado_em is not null
     and email_verificado_por is null
     and email_verificado_em <> date_trunc('milliseconds', email_verificado_em);

  update public.profiles
     set email_verificado_por = 'app'
   where email_verificado_em is not null
     and email_verificado_por is null;

  alter table public.profiles enable trigger update_profiles_updated_at;
  perform set_config('request.jwt.claims', '{}', true);
end $$;

alter table public.profiles drop constraint if exists profiles_email_verificado_coerente;
alter table public.profiles add constraint profiles_email_verificado_coerente check (
  (email_verificado_em is null and email_verificado_por is null)
  or (email_verificado_em is not null and email is not null
      and coalesce(email_verificado_por, '') in ('codigo', 'link', 'app'))
);

-- ------------------------------------------------------------
-- 4 (antes da trava, que referencia). desafios de recuperação
-- ------------------------------------------------------------
create table if not exists public.senha_desafios (
  id               uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  email            text not null,
  codigo_hash      text not null,
  criado_em        timestamptz not null default now(),
  expira_em        timestamptz not null,
  tentativas       integer not null default 0,
  consumido_em     timestamptz,
  invalidado_em    timestamptz,
  troca_hash       text unique,
  troca_expira_em  timestamptz,
  troca_usada_em   timestamptz,
  senha_trocada_em timestamptz
);
create index if not exists senha_desafios_user_idx on public.senha_desafios (user_id, criado_em desc);
alter table public.senha_desafios enable row level security;
revoke all on table public.senha_desafios from public, anon, authenticated;

comment on table public.senha_desafios is
  'Recuperação de senha por código. Só hash (sha256 de id:código), 15 min, 5 tentativas, uso único. Sem policies: só as funções do servidor mexem.';

-- ------------------------------------------------------------
-- 2. trava de confirmação
-- ------------------------------------------------------------
create or replace function public.profiles_email_verificado_trava()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  cliente boolean := current_user in ('anon', 'authenticated')
                     or coalesce(auth.role(), '') in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    -- ninguém nasce confirmado: a prova vem depois, pelo servidor
    new.email_verificado_em := null;
    new.email_verificado_por := null;
    new.email_verificado_legado_em := null;
    return new;
  end if;

  -- histórico é imutável
  new.email_verificado_legado_em := old.email_verificado_legado_em;

  if cliente then
    new.email_verificado_em := old.email_verificado_em;
    new.email_verificado_por := old.email_verificado_por;
  end if;

  -- e-mail mudou (para qualquer um, inclusive o servidor): confirmação cai
  if lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
    new.email_verificado_em := null;
    new.email_verificado_por := null;
  end if;
  return new;
end $$;

-- "zz_" = roda por último entre os BEFORE (depois do profiles_valida_identidade normalizar o e-mail)
drop trigger if exists zz_profiles_email_verificado_trava on public.profiles;
create trigger zz_profiles_email_verificado_trava
  before insert or update on public.profiles
  for each row execute function public.profiles_email_verificado_trava();

create or replace function public.profiles_email_trocado_invalida()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.email_codigos where user_id = new.user_id;
  update public.senha_desafios
     set invalidado_em = now()
   where user_id = new.user_id
     and invalidado_em is null
     and troca_usada_em is null;
  return null;
end $$;
revoke all on function public.profiles_email_trocado_invalida() from public, anon, authenticated;

drop trigger if exists profiles_email_trocado_invalida on public.profiles;
create trigger profiles_email_trocado_invalida
  after update of email on public.profiles
  for each row
  when (lower(btrim(new.email)) is distinct from lower(btrim(old.email)))
  execute function public.profiles_email_trocado_invalida();

-- ------------------------------------------------------------
-- 3. email_codigos: tipo + confirmação atômica
-- ------------------------------------------------------------
alter table public.email_codigos add column if not exists tipo text not null default 'codigo';
-- linhas que já existiam: link do cadastro vale 24h, código vale 15 min
update public.email_codigos set tipo = 'link'
 where tipo = 'codigo' and expira_em - enviado_em > interval '1 hour';
alter table public.email_codigos drop constraint if exists email_codigos_tipo_chk;
alter table public.email_codigos add constraint email_codigos_tipo_chk check (tipo in ('codigo', 'link'));
create index if not exists email_codigos_hash_idx on public.email_codigos (codigo_hash);

-- Código digitado no app (logado). Ordem de trava: perfil → código (igual à troca de e-mail).
-- Retorna: ok | errado | bloqueado | expirado | sem_codigo | email_mudou
create or replace function public.email_confirmar_codigo(p_user uuid, p_codigo_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email text;
  r public.email_codigos%rowtype;
begin
  select email into v_email from public.profiles where user_id = p_user for update;
  select * into r from public.email_codigos where user_id = p_user and tipo = 'codigo' for update;
  if not found then return 'sem_codigo'; end if;

  if r.expira_em <= now() then
    delete from public.email_codigos where user_id = p_user;
    return 'expirado';
  end if;
  if r.tentativas >= 5 then
    delete from public.email_codigos where user_id = p_user;
    return 'bloqueado';
  end if;
  if r.codigo_hash is distinct from p_codigo_hash then
    update public.email_codigos set tentativas = tentativas + 1 where user_id = p_user;
    return case when r.tentativas + 1 >= 5 then 'bloqueado' else 'errado' end;
  end if;

  delete from public.email_codigos where user_id = p_user;   -- uso único
  if v_email is null or lower(v_email) <> lower(r.email) then
    return 'email_mudou';
  end if;
  update public.profiles
     set email_verificado_em = now(), email_verificado_por = 'codigo'
   where user_id = p_user and lower(email) = lower(r.email);
  return 'ok';
end $$;

-- Link de 1 clique do cadastro. Retorna: ok | invalido | expirado | email_mudou
create or replace function public.email_confirmar_link(p_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid;
  v_email text;
  r public.email_codigos%rowtype;
begin
  select user_id into v_user from public.email_codigos where codigo_hash = p_hash and tipo = 'link';
  if v_user is null then return 'invalido'; end if;

  select email into v_email from public.profiles where user_id = v_user for update;
  select * into r from public.email_codigos
   where user_id = v_user and codigo_hash = p_hash and tipo = 'link' for update;
  if not found then return 'invalido'; end if;              -- usado em paralelo

  delete from public.email_codigos where user_id = v_user;   -- uso único
  if r.expira_em <= now() then return 'expirado'; end if;
  if v_email is null or lower(v_email) <> lower(r.email) then return 'email_mudou'; end if;

  update public.profiles
     set email_verificado_em = now(), email_verificado_por = 'link'
   where user_id = v_user and lower(email) = lower(r.email);
  return 'ok';
end $$;

-- ------------------------------------------------------------
-- 5. funções da recuperação (só o servidor)
-- ------------------------------------------------------------

-- Cria o desafio se o CPF tiver e-mail confirmado COM prova. Senão não devolve nada
-- (a função de borda responde igual nos dois casos). Reenviar invalida os anteriores.
-- Teto por conta: 5 desafios por hora (além do freio por CPF e por IP na borda).
create or replace function public.senha_desafio_criar(p_id uuid, p_cpf text)
returns table(email text, nome text, codigo text)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  p record;
  v_n bigint;
  v_codigo text;
begin
  select pr.user_id, pr.email, pr.nickname
    into p
    from public.profiles pr
   where pr.cpf = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
     and pr.email is not null
     and pr.email_verificado_em is not null
     and pr.email_verificado_por in ('codigo', 'link', 'app')
   for update;                       -- serializa reenvios da mesma conta
  if not found then return; end if;

  if (select count(*) from public.senha_desafios d
       where d.user_id = p.user_id and d.criado_em > now() - interval '1 hour') >= 5 then
    return;
  end if;

  update public.senha_desafios d
     set invalidado_em = now()
   where d.user_id = p.user_id and d.invalidado_em is null and d.troca_usada_em is null;

  -- 6 dígitos de 4 bytes criptográficos, com rejeição pra não ter viés de módulo
  loop
    v_n := ('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    exit when v_n < 4294000000;
  end loop;
  v_codigo := lpad((v_n % 1000000)::text, 6, '0');

  insert into public.senha_desafios (id, user_id, email, codigo_hash, expira_em)
  values (p_id, p.user_id, p.email,
          encode(digest(p_id::text || ':' || v_codigo, 'sha256'), 'hex'),
          now() + interval '15 minutes');

  return query select p.email::text, p.nickname::text, v_codigo;
end $$;

-- E-mail não saiu: o desafio morre (a pessoa pede outro).
create or replace function public.senha_desafio_invalidar(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.senha_desafios set invalidado_em = now()
   where id = p_id and invalidado_em is null and troca_usada_em is null;
$$;

-- Confere o código. Valida e consome na mesma transação, com a linha travada.
-- Retorna status ok | errado | bloqueado | expirado | invalido e, no ok, o token de troca
-- (32 bytes aleatórios; só o hash fica no banco; vale 10 min).
create or replace function public.senha_desafio_verificar(p_id uuid, p_codigo text)
returns table(status text, troca_token text)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  d public.senha_desafios%rowtype;
  v_email text;
  v_tok text;
begin
  select * into d from public.senha_desafios where id = p_id for update;
  if not found or d.invalidado_em is not null or d.consumido_em is not null then
    return query select 'invalido'::text, null::text; return;
  end if;
  if d.expira_em <= now() then
    update public.senha_desafios set invalidado_em = now() where id = p_id;
    return query select 'expirado'::text, null::text; return;
  end if;
  if d.tentativas >= 5 then
    update public.senha_desafios set invalidado_em = now() where id = p_id;
    return query select 'bloqueado'::text, null::text; return;
  end if;

  -- o e-mail do desafio ainda é o e-mail confirmado da conta?
  select pr.email into v_email from public.profiles pr
   where pr.user_id = d.user_id and pr.email_verificado_em is not null;
  if v_email is null or lower(v_email) <> lower(d.email) then
    update public.senha_desafios set invalidado_em = now() where id = p_id;
    return query select 'invalido'::text, null::text; return;
  end if;

  if coalesce(p_codigo, '') !~ '^[0-9]{6}$'
     or encode(digest(p_id::text || ':' || p_codigo, 'sha256'), 'hex') <> d.codigo_hash then
    update public.senha_desafios
       set tentativas = tentativas + 1,
           invalidado_em = case when tentativas + 1 >= 5 then now() else invalidado_em end
     where id = p_id;
    return query select (case when d.tentativas + 1 >= 5 then 'bloqueado' else 'errado' end)::text, null::text;
    return;
  end if;

  v_tok := encode(gen_random_bytes(32), 'hex');
  update public.senha_desafios
     set consumido_em = now(),
         troca_hash = encode(digest(v_tok, 'sha256'), 'hex'),
         troca_expira_em = now() + interval '10 minutes'
   where id = p_id;
  return query select 'ok'::text, v_tok;
end $$;

-- Consome o token de troca (uma vez só, mesmo com pedidos simultâneos).
create or replace function public.senha_troca_consumir(p_token text)
returns table(desafio_id uuid, user_id uuid)
language sql
security definer
set search_path = public, extensions, pg_catalog
as $$
  update public.senha_desafios d
     set troca_usada_em = now()
   where d.troca_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and d.troca_usada_em is null
     and d.invalidado_em is null
     and d.troca_expira_em > now()
     and exists (select 1 from public.profiles pr
                  where pr.user_id = d.user_id
                    and pr.email_verificado_em is not null
                    and lower(pr.email) = lower(d.email))
  returning d.id, d.user_id;
$$;

-- O Auth recusou a senha (ex.: política do projeto): devolve o token pra pessoa tentar outra
-- dentro dos mesmos 10 min.
create or replace function public.senha_troca_reabrir(p_desafio uuid)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.senha_desafios
     set troca_usada_em = null
   where id = p_desafio and senha_trocada_em is null
     and invalidado_em is null and troca_expira_em > now();
$$;

-- Senha trocada: registra e derruba TODAS as sessões (refresh tokens). Os access tokens
-- já emitidos continuam válidos até expirar (JWT, até 1h) — não dá pra revogar JWT.
create or replace function public.senha_troca_concluir(p_desafio uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_user uuid;
begin
  update public.senha_desafios set senha_trocada_em = now()
   where id = p_desafio and troca_usada_em is not null
  returning user_id into v_user;
  if v_user is null then return; end if;

  delete from auth.refresh_tokens where user_id = v_user::text;
  delete from auth.sessions where user_id = v_user;

  update public.senha_desafios set invalidado_em = now()
   where user_id = v_user and id <> p_desafio and invalidado_em is null and troca_usada_em is null;
end $$;

-- ------------------------------------------------------------
-- 6. o furo: sessão comum não confirma e-mail
-- ------------------------------------------------------------
-- Vira no-op (app antigo ainda chama no fim do reset; não pode dar erro). A trava do
-- passo 2 já bloquearia a escrita de qualquer jeito.
create or replace function public.email_confirmar_por_recuperacao()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return;
end $$;

-- ------------------------------------------------------------
-- permissões: só service_role
-- ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.email_confirmar_codigo(uuid, text)',
    'public.email_confirmar_link(text)',
    'public.senha_desafio_criar(uuid, text)',
    'public.senha_desafio_invalidar(uuid)',
    'public.senha_desafio_verificar(uuid, text)',
    'public.senha_troca_consumir(text)',
    'public.senha_troca_reabrir(uuid)',
    'public.senha_troca_concluir(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
