-- ============================================================
-- X1 · LOTE 5 (Rick, 03/10/2026) — mockups mock-x1-desafiar / mock-x1-falta
--   1) TÔ NA PISTA: interruptor do dia. Quem está na pista aparece como
--      disponível e o amistoso contra ele começa na hora, sem esperar aceite
--      (x1_na_arena passa a contar a pista, além do DEFCON aberto).
--   2) CINTURÃO DA CIDADE: um campeão por cidade. Primeiro a vencer um X1 na
--      cidade pega o cinturão; quem vence o campeão (da mesma cidade) toma;
--      o campeão que vence alguém da cidade soma uma defesa.
--   3) TORCIDA CERTEIRA: quem torce e acerta ganha 1 ponto de patente.
--   4) PROVOCAÇÃO PRONTA: 5 frases fixas (sem texto livre), máx. 3 por luta,
--      uma a cada 2 min, só durante a luta.
-- Idempotente, sem comandos de apagar (desligar a pista = marcar outro dia).
-- ============================================================

-- ---------- 1) TÔ NA PISTA ----------
create table if not exists public.x1_pista (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dia date not null,
  ligado_em timestamptz not null default now()
);
alter table public.x1_pista enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'x1_pista' and policyname = 'x1_pista_dono_le') then
    create policy x1_pista_dono_le on public.x1_pista for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

create or replace function public.x1_na_pista(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.x1_pista
                 where user_id = p_user and dia = (now() at time zone 'America/Sao_Paulo')::date);
$$;

-- "na arena" = DEFCON aberto hoje OU pista ligada hoje
create or replace function public.x1_na_arena(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.challenge_sessions s
    where s.user_id = p_user and s.status = 'active'
      and s.date = (now() at time zone 'America/Sao_Paulo')::date
      and s.started_at >= now() - interval '12 hours')
  or public.x1_na_pista(p_user);
$$;

create or replace function public.x1_pista_ligar(p_on boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if me is null then raise exception 'sem login'; end if;
  insert into public.x1_pista (user_id, dia, ligado_em)
  values (me, case when p_on then hoje else date '1900-01-01' end, now())
  on conflict (user_id) do update set dia = excluded.dia, ligado_em = excluded.ligado_em;
  return public.x1_minha_pista();
end $$;

-- meu estado + quantos vendedores estão de olho hoje (quem abriu DEFCON ou ligou a pista)
create or replace function public.x1_minha_pista()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d)
  select jsonb_build_object(
    'ligado', public.x1_na_pista(auth.uid()),
    'no_defcon', exists (select 1 from public.challenge_sessions s, hoje
                         where s.user_id = auth.uid() and s.status = 'active' and s.date = hoje.d),
    'na_pista', (select count(*)::int from public.x1_pista p, hoje where p.dia = hoje.d and p.user_id <> auth.uid()),
    'te_veem', (select count(distinct u)::int from (
        select s.user_id u from public.challenge_sessions s, hoje where s.date = hoje.d
        union select p.user_id from public.x1_pista p, hoje where p.dia = hoje.d) t
      where u <> auth.uid())
  )
  where auth.uid() is not null;
$$;

-- DISPONÍVEIS AGORA: na pista ou com DEFCON aberto, sem duelo comigo hoje
create or replace function public.x1_disponiveis()
returns table(user_id uuid, nome text, avatar_url text, cidade text, vendido_hoje numeric,
              na_pista boolean, no_defcon boolean, patente text, vitorias int, posicao int)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  cand as (
    select s.user_id from public.challenge_sessions s, hoje
     where s.date = hoje.d and s.status = 'active' and s.started_at >= now() - interval '12 hours'
    union
    select p.user_id from public.x1_pista p, hoje where p.dia = hoje.d
  )
  select c.user_id, coalesce(pp.nickname, 'Vendedor'), pp.avatar_url,
         case when coalesce(pr.show_city, false) then pr.city end,
         coalesce((select sum(total_sold) from public.challenge_sessions s, hoje where s.user_id = c.user_id and s.date = hoje.d), 0)::numeric,
         public.x1_na_pista(c.user_id),
         exists (select 1 from public.challenge_sessions s, hoje where s.user_id = c.user_id and s.status = 'active' and s.date = hoje.d),
         r.patente, r.vitorias,
         (select l.posicao_faturamento from public.leaderboard_stats l
           where l.user_id = c.user_id and l.mes_referencia = to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM')
           limit 1)
  from cand c
  left join public.public_profiles pp on pp.user_id = c.user_id
  left join public.profiles pr on pr.user_id = c.user_id
  left join lateral public.x1_recorde(c.user_id) r on true
  where auth.uid() is not null and c.user_id <> auth.uid()
    and not exists (select 1 from public.x1_challenges x, hoje
                    where x.scheduled_date = hoje.d and x.status in ('active', 'pending')
                      and ((x.challenger_id = auth.uid() and x.opponent_id = c.user_id)
                        or (x.opponent_id = auth.uid() and x.challenger_id = c.user_id)))
  order by public.x1_na_pista(c.user_id) desc, 5 desc
  limit 20;
$$;

-- ---------- 2) CINTURÃO DA CIDADE ----------
create table if not exists public.x1_cinturao (
  cidade_chave text primary key,
  cidade text not null,
  uf text,
  user_id uuid not null references auth.users(id) on delete cascade,
  desde timestamptz not null default now(),
  defesas int not null default 0
);
create table if not exists public.x1_cinturao_historico (
  id bigserial primary key,
  cidade_chave text not null,
  user_id uuid not null,
  de_user_id uuid,
  challenge_id uuid,
  tipo text not null check (tipo in ('conquistou', 'tomou', 'defendeu')),
  em timestamptz not null default now()
);
create index if not exists x1_cinturao_hist_cidade_idx on public.x1_cinturao_historico (cidade_chave, em desc);
alter table public.x1_cinturao enable row level security;
alter table public.x1_cinturao_historico enable row level security;

create or replace function public.x1_cidade_chave(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select nullif(lower(trim(coalesce(city, ''))), '') || '|' || upper(trim(coalesce(state, '')))
  from public.profiles where user_id = p_user;
$$;

create or replace function public.x1_cinturao_apos_duelo(p_ch uuid, p_quando timestamptz default now())
returns void language plpgsql security definer set search_path to 'public' as $$
declare x record; perdedor uuid; ck_v text; ck_p text; dono uuid; cid text; uf_ text;
begin
  select * into x from public.x1_challenges where id = p_ch;
  if x is null or x.status <> 'finished' or x.winner_user_id is null or x.opponent_id is null then return; end if;
  perdedor := case when x.winner_user_id = x.challenger_id then x.opponent_id else x.challenger_id end;
  ck_v := public.x1_cidade_chave(x.winner_user_id);
  ck_p := public.x1_cidade_chave(perdedor);
  if ck_v is null then return; end if;
  select user_id into dono from public.x1_cinturao where cidade_chave = ck_v;
  select city, state into cid, uf_ from public.profiles where user_id = x.winner_user_id;

  if dono is null then
    -- cidade sem campeão: o primeiro a vencer leva
    insert into public.x1_cinturao (cidade_chave, cidade, uf, user_id, desde, defesas)
    values (ck_v, trim(cid), upper(trim(coalesce(uf_, ''))), x.winner_user_id, p_quando, 0)
    on conflict (cidade_chave) do nothing;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, null, x.id, 'conquistou', p_quando);
  elsif dono = perdedor and ck_v = ck_p then
    -- venceu o campeão da própria cidade: toma o cinturão
    update public.x1_cinturao set user_id = x.winner_user_id, desde = p_quando, defesas = 0 where cidade_chave = ck_v;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, perdedor, x.id, 'tomou', p_quando);
  elsif dono = x.winner_user_id and ck_v = ck_p then
    -- o campeão venceu alguém da cidade: defesa
    update public.x1_cinturao set defesas = defesas + 1 where cidade_chave = ck_v;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, perdedor, x.id, 'defendeu', p_quando);
  end if;
end $$;

create or replace function public.x1_cinturao_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'finished' and coalesce(old.status, '') <> 'finished' and new.winner_user_id is not null then
    perform public.x1_cinturao_apos_duelo(new.id, now());
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_x1_cinturao' and tgrelid = 'public.x1_challenges'::regclass) then
    create trigger trg_x1_cinturao after update of status on public.x1_challenges
      for each row execute function public.x1_cinturao_trg();
  end if;
end $$;

-- histórico: replay dos duelos já encerrados, em ordem (só se ainda não há cinturão nenhum)
do $$ declare r record; begin
  if not exists (select 1 from public.x1_cinturao) then
    for r in select id, coalesce(reviewed_at, updated_at) q from public.x1_challenges
             where status = 'finished' and winner_user_id is not null order by coalesce(reviewed_at, updated_at) loop
      perform public.x1_cinturao_apos_duelo(r.id, r.q);
    end loop;
  end if;
end $$;

-- o cinturão da MINHA cidade (ou de uma cidade escolhida) + linha do tempo
create or replace function public.x1_cinturao_cidade(p_chave text default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with ck as (select coalesce(p_chave, public.x1_cidade_chave(auth.uid())) c),
  cz as (select z.* from public.x1_cinturao z, ck where z.cidade_chave = ck.c)
  select case when auth.uid() is null then null else jsonb_build_object(
    'cidade_chave', (select c from ck),
    'cidade', coalesce((select cidade from cz), (select trim(city) from public.profiles where user_id = auth.uid())),
    'uf', coalesce((select uf from cz), (select upper(trim(state)) from public.profiles where user_id = auth.uid())),
    'campeao', (select jsonb_build_object(
        'user_id', cz.user_id, 'nome', coalesce(pp.nickname, 'Vendedor'), 'avatar_url', pp.avatar_url,
        'desde', cz.desde, 'dias', greatest(0, ((now() at time zone 'America/Sao_Paulo')::date - (cz.desde at time zone 'America/Sao_Paulo')::date)),
        'defesas', cz.defesas, 'vitorias', (select vitorias from public.x1_recorde(cz.user_id)),
        'patente', (select patente from public.x1_recorde(cz.user_id)),
        'sou_eu', cz.user_id = auth.uid())
      from cz left join public.public_profiles pp on pp.user_id = cz.user_id),
    'linha', coalesce((select jsonb_agg(jsonb_build_object(
        'em', h.em, 'tipo', h.tipo,
        'nome', coalesce(a.nickname, 'Vendedor'), 'de_nome', b.nickname) order by h.em desc)
      from (select * from public.x1_cinturao_historico, ck where cidade_chave = ck.c order by em desc limit 5) h
      left join public.public_profiles a on a.user_id = h.user_id
      left join public.public_profiles b on b.user_id = h.de_user_id), '[]'::jsonb)
  ) end;
$$;

-- ---------- 3) TORCIDA CERTEIRA ----------
create or replace function public.x1_palpites(p_user uuid default null)
returns table(acertos int, total int)
language sql stable security definer set search_path to 'public' as $$
  select count(*) filter (where (t.lado = 'challenger' and x.winner_user_id = x.challenger_id)
                             or (t.lado = 'opponent' and x.winner_user_id = x.opponent_id))::int,
         count(*)::int
  from public.x1_torcida t join public.x1_challenges x on x.id = t.challenge_id
  where t.user_id = coalesce(p_user, auth.uid()) and x.status = 'finished' and x.winner_user_id is not null;
$$;

-- patente: + 1 ponto por palpite certo (antes: 10 por vitória + 2 por missão)
create or replace function public.x1_recorde(p_user uuid)
returns table(vitorias integer, derrotas integer, empates integer, sequencia integer, patente text, nivel integer, aposta_max numeric, proxima integer, duelos integer, pontos integer, pontos_proxima integer, potencia numeric)
language plpgsql stable security definer set search_path to 'public' as $function$
declare v int; d int; e int; seq int := 0; r record; m int; pts int; ac int;
begin
  select count(*) filter (where winner_user_id = p_user),
         count(*) filter (where winner_user_id is not null and winner_user_id <> p_user),
         count(*) filter (where winner_user_id is null)
    into v, d, e
  from public.x1_challenges
  where status = 'finished' and (challenger_id = p_user or opponent_id = p_user);
  for r in select winner_user_id from public.x1_challenges
           where status = 'finished' and (challenger_id = p_user or opponent_id = p_user)
           order by coalesce(reviewed_at, updated_at) desc loop
    if r.winner_user_id = p_user then seq := seq + 1;
    elsif r.winner_user_id is null then continue;
    else exit; end if;
  end loop;
  select count(*) into m from public.x1_missoes_feitas where user_id = p_user;
  select pa.acertos into ac from public.x1_palpites(p_user) pa;
  pts := coalesce(v,0) * 10 + coalesce(m,0) * 2 + coalesce(ac,0);
  return query
    select coalesce(v,0), coalesce(d,0), coalesce(e,0), seq, p.nome, p.nivel, p.aposta_max,
           case when p.proxima is null then null else ceil(p.proxima / 10.0)::int end,
           coalesce(v,0)+coalesce(d,0)+coalesce(e,0), pts, p.proxima, public.x1_potencia(p_user)
    from public.x1_patente_pontos(pts) p;
end; $function$;

-- ---------- 4) PROVOCAÇÃO PRONTA ----------
create table if not exists public.x1_provocacoes (
  id bigserial primary key,
  challenge_id uuid not null references public.x1_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  frase text not null check (frase in ('Vai desistir? 😏', 'Tô só esquentando', 'Isso é tudo?', 'Revanche amanhã', 'Respeito 🤝')),
  criado_em timestamptz not null default now()
);
create index if not exists x1_provocacoes_ch_idx on public.x1_provocacoes (challenge_id, criado_em desc);
alter table public.x1_provocacoes enable row level security;

create or replace function public.x1_provocar(p_id uuid, p_frase text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); x record; n int; ult timestamptz;
begin
  if me is null then raise exception 'sem login'; end if;
  select * into x from public.x1_challenges where id = p_id;
  if x is null or (x.challenger_id <> me and x.opponent_id is distinct from me) then raise exception 'só quem luta provoca'; end if;
  if x.status <> 'active' then raise exception 'a luta não está rolando'; end if;
  select count(*), max(criado_em) into n, ult from public.x1_provocacoes where challenge_id = p_id and user_id = me;
  if n >= 3 then raise exception 'máximo de 3 provocações por luta'; end if;
  if ult is not null and ult > now() - interval '2 minutes' then raise exception 'espera 2 minutos pra provocar de novo'; end if;
  insert into public.x1_provocacoes (challenge_id, user_id, frase) values (p_id, me, p_frase);
end $$;

create or replace function public.x1_provocacoes_da_luta(p_id uuid)
returns table(id bigint, user_id uuid, nome text, avatar_url text, frase text, criado_em timestamptz, minha boolean)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.user_id, coalesce(pp.nickname, 'Vendedor'), pp.avatar_url, p.frase, p.criado_em, p.user_id = auth.uid()
  from public.x1_provocacoes p left join public.public_profiles pp on pp.user_id = p.user_id
  where p.challenge_id = p_id and auth.uid() is not null
  order by p.criado_em desc limit 20;
$$;
