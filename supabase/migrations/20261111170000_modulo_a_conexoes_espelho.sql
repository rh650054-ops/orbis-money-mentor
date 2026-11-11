-- Open Finance V2 · Module A (connections and consent) · A-PR1: new records + mirror.
--
-- ADDITIVE ONLY. This file creates new tables and new functions and nothing else:
--   * no existing table, function, trigger or policy is altered;
--   * no foreign key points at bank_connections or bank_saldos (it could block deletes that
--     work today), so the origin of every mirrored row is kept as a plain id column instead;
--   * the ONE link to something that already exists is the same one bank_connections and 68
--     other tables have: user_id references auth.users ON DELETE CASCADE. It changes nothing in
--     auth.users (Postgres keeps its own internal triggers for the key) and it is what makes the
--     vendor's rows disappear, in the same transaction, whenever the account is deleted;
--   * nothing here writes to daily_sales, auto_detected_sales, extrato_lancamentos, ranking,
--     prizes, goals, badges or charges;
--   * the mirror deletes and merges nothing, in the new tables or in the old ones. Rows of the
--     new tables are deleted only when the vendor's account is deleted (see "Account deletion").
--
-- What the model separates (contract: provider, Item, bank account, consent, purpose, history):
--   of_provedores      who reads the bank for us (Pluggy is the only bank-connection provider)
--   of_vinculos        one row per provider Item (today: one row per bank_connections row)
--   of_contas          one row per bank account; belongs to the vendor, not to the Item
--   of_vinculo_contas  which Item sees which account, since when and until when
--   of_consentimentos  authorisation state of each Item; never deduced from "UPDATED"
--   of_finalidades     purpose (trabalho / pessoal / misto / nao_definida) with validity dates
--   of_eventos         raw provider events (empty in A-PR1; A-PR2 starts filling it)
--   of_mudancas        every state change, with its reason
--   of_espelho_execucoes  one row per mirror run (numbers only, no identifier)
--   of_retencoes       explicit, dated orders to keep a vendor's records after deletion
--   of_retidos         the copies kept under such an order, and nothing else
--
-- The mirror (of_espelho_atualizar) copies what bank_connections and bank_saldos say today into
-- these records. It runs only when somebody calls it: this migration schedules nothing.
-- Rollback: supabase/modulo-a/rollback-a-pr1.sql. Procedure: supabase/modulo-a/A-PR1.md.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.of_provedores (
  codigo text primary key,
  nome text not null,
  criado_em timestamptz not null default now()
);
insert into public.of_provedores (codigo, nome) values ('pluggy', 'Pluggy');

create table public.of_vinculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provedor text not null default 'pluggy' references public.of_provedores (codigo),
  item_id text not null,
  instituicao text,
  estado text not null
    check (estado in ('criando', 'ativo', 'pausado', 'em_revisao', 'substituido', 'removido')),
  estado_motivo text,
  -- bank_connections.id this row was mirrored from. Deliberately NOT a foreign key.
  origem_conexao_id uuid not null,
  criado_em timestamptz not null default now(),
  espelhado_em timestamptz not null default now(),
  unique (provedor, item_id),
  unique (origem_conexao_id),
  -- lets every child row prove it belongs to the same vendor as its link (see the foreign keys)
  unique (id, user_id)
);
create index of_vinculos_user on public.of_vinculos (user_id);

create table public.of_contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  instituicao text,
  -- Only a deposit account may ever receive sales. A-PR1 cannot know the type yet.
  tipo text not null default 'desconhecido'
    check (tipo in ('deposito', 'cartao', 'investimento', 'emprestimo', 'desconhecido')),
  -- How sure we are that this is one specific bank account. A-PR1 never proves identity, so
  -- every mirrored account is 'nao_identificada' and is never merged with another one.
  identidade text not null default 'nao_identificada'
    check (identidade in ('numero', 'titular', 'nao_identificada')),
  identidade_chave text,
  -- bank_saldos.conta_id this row was mirrored from. Deliberately NOT a foreign key.
  origem_conta_id text unique,
  criado_em timestamptz not null default now(),
  espelhado_em timestamptz not null default now(),
  check ((identidade = 'nao_identificada') = (identidade_chave is null)),
  unique (id, user_id)
);
create index of_contas_user on public.of_contas (user_id);
-- Two rows may claim the same proven identity only by mistake: make that impossible.
create unique index of_contas_identidade_provada
  on public.of_contas (user_id, lower(coalesce(instituicao, '')), identidade, identidade_chave)
  where identidade <> 'nao_identificada';

create table public.of_vinculo_contas (
  vinculo_id uuid not null,
  conta_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  conta_no_provedor text,
  desde timestamptz not null default now(),
  ate timestamptz,
  primary key (vinculo_id, conta_id),
  -- The vendor is part of both keys: the database itself refuses to tie one vendor's Item to
  -- another vendor's account, whatever the code does.
  foreign key (vinculo_id, user_id) references public.of_vinculos (id, user_id) on delete cascade,
  foreign key (conta_id, user_id) references public.of_contas (id, user_id) on delete cascade
);
create index of_vinculo_contas_conta on public.of_vinculo_contas (conta_id);

create table public.of_consentimentos (
  vinculo_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'nao_informado': the provider told us nothing explicit about the authorisation.
  -- 'desconhecido':  the provider told us something we do not recognise (raw value kept).
  estado text not null default 'nao_informado'
    check (estado in ('autorizado', 'expirando', 'aguardando_vendedor', 'credencial_invalida',
                      'expirado', 'revogado', 'nao_informado', 'desconhecido')),
  estado_bruto text,
  valido_ate timestamptz,
  produtos text[],
  confirmado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  foreign key (vinculo_id, user_id) references public.of_vinculos (id, user_id) on delete cascade
);

create table public.of_finalidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vinculo_id uuid not null,
  -- null = the purpose the accounts of this Item inherit until one is set per account.
  -- A-PR1 only writes this inherited row, translated from bank_connections.papel.
  conta_id uuid,
  finalidade text not null check (finalidade in ('trabalho', 'pessoal', 'misto', 'nao_definida')),
  vale_desde timestamptz,
  vale_ate timestamptz,
  origem text not null check (origem in ('papel_legado', 'vendedor', 'automatica')),
  registrado_em timestamptz not null default now(),
  foreign key (vinculo_id, user_id) references public.of_vinculos (id, user_id) on delete cascade,
  foreign key (conta_id, user_id) references public.of_contas (id, user_id) on delete cascade
);
create index of_finalidades_vinculo on public.of_finalidades (vinculo_id);
-- At most one purpose in force per Item (inherited) and per account.
create unique index of_finalidades_vigente
  on public.of_finalidades (vinculo_id, coalesce(conta_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where vale_ate is null;

create table public.of_eventos (
  id bigint generated always as identity primary key,
  provedor text not null references public.of_provedores (codigo),
  -- The vendor the event belongs to, once known. Events are erased with the vendor.
  user_id uuid references auth.users (id) on delete cascade,
  evento_id text,
  item_id text,
  tipo text,
  bruto jsonb not null,
  provedor_em timestamptz,
  chegou_em timestamptz not null default now(),
  aplicado boolean,
  resultado text
);
create unique index of_eventos_unico on public.of_eventos (provedor, evento_id) where evento_id is not null;
create index of_eventos_item on public.of_eventos (item_id);
create index of_eventos_user on public.of_eventos (user_id);

create table public.of_mudancas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vinculo_id uuid,
  conta_id uuid,
  campo text not null,
  de text,
  para text,
  motivo text not null,
  fonte text not null check (fonte in ('espelho', 'provedor', 'vendedor', 'sistema')),
  evento_id bigint references public.of_eventos (id) on delete set null,
  provedor_em timestamptz,
  registrado_em timestamptz not null default now(),
  foreign key (vinculo_id, user_id) references public.of_vinculos (id, user_id) on delete cascade,
  foreign key (conta_id, user_id) references public.of_contas (id, user_id) on delete cascade
);
create index of_mudancas_vinculo on public.of_mudancas (vinculo_id);
create index of_mudancas_user on public.of_mudancas (user_id);
create index of_vinculo_contas_user on public.of_vinculo_contas (user_id);
create index of_consentimentos_user on public.of_consentimentos (user_id);
create index of_finalidades_user on public.of_finalidades (user_id);

create table public.of_espelho_execucoes (
  id bigint generated always as identity primary key,
  iniciou_em timestamptz not null default now(),
  terminou_em timestamptz,
  resumo jsonb,
  divergencias integer,
  problemas jsonb
);

-- ---------------------------------------------------------------------------------------------
-- Account deletion and retention.
--
-- Default: when a vendor's account is deleted, every row of theirs in the tables above is
-- deleted with it, whichever path deleted the account:
--   * the self-service routine (apagar_dados_do_usuario) sweeps every public table that has a
--     user_id column, in no particular order. Deletes cascade between the new tables, so no
--     order can fail;
--   * the admin routine and the dashboard remove the auth user: the foreign keys cascade.
--
-- Exception: a RETENTION, registered beforehand by the server, with a reason, a legal basis and
-- an end date. While one is in force for that vendor, each row is copied to of_retidos just
-- before it is deleted. Nothing is retained without such an order, and the copies are removed
-- when the order is closed or expires.
--
-- The two tables below name the vendor "titular_id", NOT "user_id", and carry no foreign key,
-- on purpose: the self-service routine deletes from any table with a user_id column, and a
-- foreign key would cascade. Either would erase the very records an obligation says to keep.
-- ---------------------------------------------------------------------------------------------
create table public.of_retencoes (
  id bigint generated always as identity primary key,
  titular_id uuid not null,
  motivo text not null check (length(btrim(motivo)) >= 10),
  base_legal text not null check (length(btrim(base_legal)) >= 5),
  registrada_por text not null check (length(btrim(registrada_por)) >= 3),
  registrada_em timestamptz not null default now(),
  valida_ate timestamptz not null,
  encerrada_em timestamptz,
  encerrada_motivo text,
  check (valida_ate > registrada_em),
  check ((encerrada_em is null) = (encerrada_motivo is null))
);
create index of_retencoes_titular on public.of_retencoes (titular_id);

create table public.of_retidos (
  id bigint generated always as identity primary key,
  retencao_id bigint not null references public.of_retencoes (id),
  titular_id uuid not null,
  tabela text not null,
  registro jsonb not null,
  guardado_em timestamptz not null default now()
);
create index of_retidos_retencao on public.of_retidos (retencao_id);

-- Runs just before a row of the vendor's records is deleted. Copies it only under a retention
-- in force; otherwise does nothing and the row is simply gone.
create function public.of_guardar_se_retido()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ret bigint;
begin
  if old.user_id is null then return old; end if;
  select r.id into v_ret from public.of_retencoes r
   where r.titular_id = old.user_id and r.encerrada_em is null and r.valida_ate > now()
   order by r.valida_ate desc limit 1;
  if found then
    insert into public.of_retidos (retencao_id, titular_id, tabela, registro)
    values (v_ret, old.user_id, tg_table_name, to_jsonb(old));
  end if;
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['of_vinculos', 'of_contas', 'of_vinculo_contas', 'of_consentimentos',
                           'of_finalidades', 'of_mudancas', 'of_eventos'] loop
    execute format('create trigger %I before delete on public.%I for each row execute function public.of_guardar_se_retido()',
                   t || '_guardar_se_retido', t);
  end loop;
end $$;

-- Registers a retention. p_valida_ate is mandatory: no retention is open-ended.
create function public.of_retencao_registrar(p_titular uuid, p_motivo text, p_base_legal text, p_valida_ate timestamptz, p_por text)
returns bigint language sql set search_path = public, pg_temp as $$
  insert into public.of_retencoes (titular_id, motivo, base_legal, valida_ate, registrada_por)
  values (p_titular, p_motivo, p_base_legal, p_valida_ate, p_por) returning id
$$;

-- Closes a retention and erases everything kept under it. Returns how many copies were erased.
create function public.of_retencao_encerrar(p_retencao bigint, p_motivo text)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare v_n integer;
begin
  if p_motivo is null or length(btrim(p_motivo)) < 3 then raise exception 'motivo obrigatorio'; end if;
  delete from public.of_retidos where retencao_id = p_retencao;
  get diagnostics v_n = row_count;
  update public.of_retencoes set encerrada_em = now(), encerrada_motivo = p_motivo
   where id = p_retencao and encerrada_em is null;
  return v_n;
end $$;

-- Closes every retention whose end date has passed and erases what was kept under them.
create function public.of_retencao_expurgar_vencidas()
returns integer language plpgsql set search_path = public, pg_temp as $$
declare r record; v_total integer := 0;
begin
  for r in select id from public.of_retencoes where encerrada_em is null and valida_ate <= now() loop
    v_total := v_total + public.of_retencao_encerrar(r.id, 'prazo_vencido');
  end loop;
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Access: server only. No vendor, logged in or not, reads or writes these tables.
-- (Supabase grants new public tables to anon/authenticated by default: take that back, and
-- enable row level security with no policy as a second lock.)
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['of_provedores', 'of_vinculos', 'of_contas', 'of_vinculo_contas', 'of_consentimentos',
                           'of_finalidades', 'of_eventos', 'of_mudancas', 'of_espelho_execucoes',
                           'of_retencoes', 'of_retidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
  foreach t in array array['of_eventos_id_seq', 'of_mudancas_id_seq', 'of_espelho_execucoes_id_seq',
                           'of_retencoes_id_seq', 'of_retidos_id_seq'] loop
    execute format('revoke all on sequence public.%I from public, anon, authenticated', t);
    execute format('grant usage, select on sequence public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- "Is this a sales account?" answered ONLY from the new records, for comparison with the rule
-- in force (public.banco_conta_de_venda). Same three ways to be a sales account:
--   purpose not defined; purpose trabalho/misto already in force at p_quando; or the vendor's
--   only live link. A removed link never is.
-- ---------------------------------------------------------------------------------------------
create function public.of_vinculo_conta_de_venda(p_vinculo uuid, p_quando timestamptz)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.of_vinculos v
      left join public.of_finalidades f
             on f.vinculo_id = v.id and f.conta_id is null and f.vale_ate is null
     where v.id = p_vinculo and v.estado <> 'removido'
       and (
         coalesce(f.finalidade, 'nao_definida') = 'nao_definida'
         or (f.finalidade in ('trabalho', 'misto')
             and (f.vale_desde is null or p_quando is null or p_quando >= f.vale_desde))
         or (select count(*) from public.of_vinculos o
              where o.user_id = v.user_id and o.estado <> 'removido') = 1
       ));
$$;

-- ---------------------------------------------------------------------------------------------
-- Comparison with the rule in force. Returns one row per problem; an empty result means the
-- mirror answers exactly like banco_conta_de_venda for every connection, asked at four moments:
-- now, "no date", the instant the work purpose starts counting, and one microsecond before it.
-- ---------------------------------------------------------------------------------------------
create function public.of_espelho_conferir(p_quando timestamptz default now())
returns table (conexao_id uuid, vinculo_id uuid, problema text, instante timestamptz, legado boolean, espelho boolean)
language sql stable set search_path = public, pg_temp as $$
  with pares as (
    select b.id as conexao_id, v.id as vinculo_id,
           case when b.papel = 'trabalho' and b.papel_desde is not null then
             case when coalesce(b.papel_auto, false)
                  then (date_trunc('month', b.papel_desde at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                  else b.papel_desde end
           end as corte
      from public.bank_connections b
      left join public.of_vinculos v on v.origem_conexao_id = b.id
  ), instantes as (
    select p.conexao_id, p.vinculo_id, i.rotulo, i.instante
      from pares p
     cross join lateral (values ('agora', p_quando), ('sem_data', null::timestamptz),
                                ('no_corte', p.corte), ('antes_do_corte', p.corte - interval '1 microsecond')) as i(rotulo, instante)
     where p.vinculo_id is not null and (i.rotulo in ('agora', 'sem_data') or p.corte is not null)
  )
  select p.conexao_id, null::uuid, 'sem_vinculo', null::timestamptz, null::boolean, null::boolean
    from pares p where p.vinculo_id is null
  union all
  select i.conexao_id, i.vinculo_id, 'resposta_diferente:' || i.rotulo, i.instante, r.legado, r.espelho
    from instantes i
   cross join lateral (select public.banco_conta_de_venda(i.conexao_id, i.instante) as legado,
                              public.of_vinculo_conta_de_venda(i.vinculo_id, i.instante) as espelho) r
   where r.legado is distinct from r.espelho
  union all
  select null::uuid, v.id, 'vinculo_sem_origem', null::timestamptz, null::boolean, null::boolean
    from public.of_vinculos v
   where v.estado <> 'removido'
     and not exists (select 1 from public.bank_connections b where b.id = v.origem_conexao_id);
$$;

-- ---------------------------------------------------------------------------------------------
-- Possible duplicate connections: same vendor, same institution, same holder and the same
-- account names (the signature the cleanup robot uses today). REPORT ONLY: nothing is removed,
-- merged or flagged on the connection. No holder name or document leaves this function.
-- ---------------------------------------------------------------------------------------------
create function public.of_espelho_duplicadas()
returns table (grupo bigint, user_id uuid, instituicao text, qtd integer, vinculos uuid[], conexoes uuid[], criadas_em timestamptz[])
language sql stable set search_path = public, pg_temp as $$
  with c as (
    select v.id as vinculo_id, b.id as conexao_id, b.user_id, b.created_at,
           lower(coalesce(b.institution_name, '')) as inst,
           lower(coalesce(b.dono_nome, '')) as dono,
           (select string_agg(s.nome, ',' order by s.nome)
              from public.bank_saldos s
             where s.bank_connection_id = b.id and coalesce(s.nome, '') <> '') as contas
      from public.bank_connections b
      join public.of_vinculos v on v.origem_conexao_id = b.id
     where coalesce(b.status, '') <> 'deleted'
  )
  select dense_rank() over (order by c.user_id, c.inst, c.dono, c.contas),
         c.user_id, c.inst, count(*)::integer,
         array_agg(c.vinculo_id order by c.created_at, c.conexao_id),
         array_agg(c.conexao_id order by c.created_at, c.conexao_id),
         array_agg(c.created_at order by c.created_at, c.conexao_id)
    from c
   where c.contas is not null
   group by c.user_id, c.inst, c.dono, c.contas
  having count(*) > 1;
$$;

-- ---------------------------------------------------------------------------------------------
-- Report in numbers only (no ids, no names): what the mirror holds and what it could not fit.
-- ---------------------------------------------------------------------------------------------
create function public.of_espelho_relatorio()
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
begin
  return jsonb_build_object(
    'vinculos', (select count(*) from public.of_vinculos),
    'vinculos_por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
                              from (select estado, count(*) n from public.of_vinculos group by estado) z),
    'vinculos_sem_conta', (select count(*) from public.of_vinculos v
                            where not exists (select 1 from public.of_vinculo_contas l where l.vinculo_id = v.id and l.ate is null)),
    'vinculos_com_uma_conta', (select count(*) from (select l.vinculo_id from public.of_vinculo_contas l
                                where l.ate is null group by l.vinculo_id having count(*) = 1) z),
    'vinculos_com_varias_contas', (select count(*) from (select l.vinculo_id from public.of_vinculo_contas l
                                    where l.ate is null group by l.vinculo_id having count(*) > 1) z),
    'contas', (select count(*) from public.of_contas),
    'contas_nao_identificadas', (select count(*) from public.of_contas where identidade = 'nao_identificada'),
    'contas_por_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb)
                          from (select tipo, count(*) n from public.of_contas group by tipo) z),
    'contas_sem_vinculo', (select count(*) from public.of_contas c
                            where not exists (select 1 from public.of_vinculo_contas l where l.conta_id = c.id and l.ate is null)),
    'consentimentos_por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
                                    from (select estado, count(*) n from public.of_consentimentos group by estado) z),
    'finalidades_em_vigor', (select coalesce(jsonb_object_agg(finalidade, n), '{}'::jsonb)
                               from (select finalidade, count(*) n from public.of_finalidades
                                      where vale_ate is null group by finalidade) z),
    'grupos_possivelmente_duplicados', (select count(*) from public.of_espelho_duplicadas()),
    'conexoes_em_grupos_duplicados', (select coalesce(sum(qtd), 0) from public.of_espelho_duplicadas()),
    'conexoes_de_origem', (select count(*) from public.bank_connections),
    'conexoes_de_origem_incompletas', (select count(*) from public.bank_connections
                                        where user_id is null or item_id is null or btrim(item_id) = ''),
    'contas_de_origem', (select count(*) from public.bank_saldos),
    'retencoes_em_vigor', (select count(*) from public.of_retencoes where encerrada_em is null and valida_ate > now()),
    'retencoes_vencidas_a_expurgar', (select count(*) from public.of_retencoes where encerrada_em is null and valida_ate <= now()),
    'registros_retidos', (select count(*) from public.of_retidos)
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- The mirror. Idempotent: running it again with nothing changed writes nothing but a run row.
-- One run at a time (transaction-level advisory lock). One bad row never stops the others: it
-- is counted, described in the run row and skipped.
-- It only INSERTS and UPDATES rows of the of_* tables. It never deletes, never merges two
-- accounts and never touches a table that existed before this migration. The run row keeps
-- numbers and problem kinds only: no vendor, connection, Item or account identifier.
-- ---------------------------------------------------------------------------------------------
create function public.of_espelho_atualizar()
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  r record;
  v public.of_vinculos%rowtype;
  c public.of_contas%rowtype;
  f public.of_finalidades%rowtype;
  v_exec bigint;
  v_estado text;
  v_fin text;
  v_desde timestamptz;
  v_n integer;
  v_restricao text;
  n_vinc_novos integer := 0;      n_vinc_estado integer := 0;   n_vinc_reapontados integer := 0;
  n_vinc_sem_origem integer := 0; n_fin_novas integer := 0;     n_fin_trocadas integer := 0;
  n_contas_novas integer := 0;    n_elos_novos integer := 0;    n_elos_fechados integer := 0;
  n_incompletas integer := 0;     n_conflitos integer := 0;     n_papel_desconhecido integer := 0;
  n_contas_sem_vinculo integer := 0;
  v_problemas jsonb := '[]'::jsonb;
  v_div integer;
  v_resumo jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.of_espelho_atualizar', 0));
  insert into public.of_espelho_execucoes default values returning id into v_exec;

  -- 1) One link per connection.
  for r in
    select b.id, b.user_id, b.item_id, b.institution_name, b.status, b.pausado_em,
           b.papel, b.papel_desde, b.papel_auto
      from public.bank_connections b
     order by b.created_at, b.id
  loop
    begin
      if r.user_id is null or r.item_id is null or btrim(r.item_id) = '' then
        n_incompletas := n_incompletas + 1;
        continue;
      end if;
      v_estado := case when coalesce(r.status, '') = 'deleted' then 'removido'
                       when r.pausado_em is not null then 'pausado'
                       else 'ativo' end;

      select * into v from public.of_vinculos x where x.origem_conexao_id = r.id;
      if not found then
        -- The same Item under a new connection row (the old row is gone): it is the same link.
        select * into v from public.of_vinculos x
         where x.provedor = 'pluggy' and x.item_id = r.item_id
           and not exists (select 1 from public.bank_connections o where o.id = x.origem_conexao_id);
        if found then
          if v.user_id <> r.user_id then
            n_conflitos := n_conflitos + 1;
            v_problemas := v_problemas || jsonb_build_object('onde', 'conexao', 'problema', 'item_de_outro_vendedor');
            continue;
          end if;
          insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte)
          values (v.user_id, v.id, 'origem', v.origem_conexao_id::text, r.id::text, 'conexao_recriada_para_o_mesmo_item', 'espelho');
          update public.of_vinculos set origem_conexao_id = r.id, espelhado_em = now() where id = v.id;
          v.origem_conexao_id := r.id;
          n_vinc_reapontados := n_vinc_reapontados + 1;
        end if;
      end if;

      if v.id is null then
        insert into public.of_vinculos (user_id, provedor, item_id, instituicao, estado, origem_conexao_id)
        values (r.user_id, 'pluggy', r.item_id, r.institution_name, v_estado, r.id)
        returning * into v;
        insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte)
        values (v.user_id, v.id, 'estado', null, v_estado, 'espelho_inicial', 'espelho');
        n_vinc_novos := n_vinc_novos + 1;
      else
        if v.user_id <> r.user_id then
          n_conflitos := n_conflitos + 1;
          v_problemas := v_problemas || jsonb_build_object('onde', 'conexao', 'problema', 'vendedor_mudou');
          continue;
        end if;
        -- States this mirror does not own (set by later steps) are left alone, except removal.
        if v.estado is distinct from v_estado
           and (v.estado in ('ativo', 'pausado', 'removido') or v_estado = 'removido') then
          insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte)
          values (v.user_id, v.id, 'estado', v.estado, v_estado, 'conexao_mudou', 'espelho');
          update public.of_vinculos
             set estado = v_estado, estado_motivo = null, espelhado_em = now() where id = v.id;
          n_vinc_estado := n_vinc_estado + 1;
        end if;
        if v.item_id is distinct from r.item_id or v.instituicao is distinct from r.institution_name then
          update public.of_vinculos
             set item_id = r.item_id, instituicao = r.institution_name, espelhado_em = now() where id = v.id;
        end if;
      end if;

      -- Consent starts as "not informed". The mirror never overwrites what is already there.
      insert into public.of_consentimentos (vinculo_id, user_id) values (v.id, v.user_id)
      on conflict (vinculo_id) do nothing;

      -- Purpose inherited from the old role, with the same start instant the rule in force uses.
      v_fin := case r.papel when 'trabalho' then 'trabalho' when 'pessoal' then 'pessoal' else 'nao_definida' end;
      if r.papel is not null and r.papel not in ('trabalho', 'pessoal') then
        n_papel_desconhecido := n_papel_desconhecido + 1;
      end if;
      v_desde := case
        when r.papel = 'trabalho' and r.papel_desde is not null then
          case when coalesce(r.papel_auto, false)
               then (date_trunc('month', r.papel_desde at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
               else r.papel_desde end
        when r.papel = 'pessoal' then r.papel_desde
        else null end;

      select * into f from public.of_finalidades x
       where x.vinculo_id = v.id and x.conta_id is null and x.vale_ate is null;
      if not found then
        insert into public.of_finalidades (user_id, vinculo_id, conta_id, finalidade, vale_desde, origem)
        values (v.user_id, v.id, null, v_fin, v_desde, 'papel_legado');
        n_fin_novas := n_fin_novas + 1;
      elsif f.origem = 'papel_legado'
            and (f.finalidade is distinct from v_fin or f.vale_desde is distinct from v_desde) then
        update public.of_finalidades set vale_ate = now() where id = f.id;
        insert into public.of_finalidades (user_id, vinculo_id, conta_id, finalidade, vale_desde, origem)
        values (v.user_id, v.id, null, v_fin, v_desde, 'papel_legado');
        n_fin_trocadas := n_fin_trocadas + 1;
      end if;
    exception when others then
      -- Never the error text: it can quote the row's values. Only the code and the constraint.
      get stacked diagnostics v_restricao = constraint_name;
      v_problemas := v_problemas || jsonb_build_object('onde', 'conexao', 'problema', sqlstate, 'restricao', nullif(v_restricao, ''));
    end;
  end loop;

  -- 2) Links whose connection row no longer exists: kept, marked removed. History stays.
  for r in
    select x.id, x.user_id, x.estado from public.of_vinculos x
     where x.estado <> 'removido'
       and not exists (select 1 from public.bank_connections b where b.id = x.origem_conexao_id)
  loop
    insert into public.of_mudancas (user_id, vinculo_id, campo, de, para, motivo, fonte)
    values (r.user_id, r.id, 'estado', r.estado, 'removido', 'origem_apagada', 'espelho');
    update public.of_vinculos
       set estado = 'removido', estado_motivo = 'origem_apagada', espelhado_em = now() where id = r.id;
    n_vinc_sem_origem := n_vinc_sem_origem + 1;
  end loop;

  -- 3) One account per balance row. Never merged: A-PR1 has no proof of identity.
  for r in
    select s.conta_id, s.user_id, s.bank_connection_id, s.banco from public.bank_saldos s order by s.conta_id
  loop
    begin
      if r.conta_id is null or r.user_id is null then
        n_incompletas := n_incompletas + 1;
        continue;
      end if;
      select * into c from public.of_contas x where x.origem_conta_id = r.conta_id;
      if not found then
        insert into public.of_contas (user_id, instituicao, origem_conta_id)
        values (r.user_id, r.banco, r.conta_id) returning * into c;
        n_contas_novas := n_contas_novas + 1;
      elsif c.user_id <> r.user_id then
        n_conflitos := n_conflitos + 1;
        v_problemas := v_problemas || jsonb_build_object('onde', 'conta', 'problema', 'vendedor_mudou');
        continue;
      end if;

      select * into v from public.of_vinculos x where x.origem_conexao_id = r.bank_connection_id;
      if not found then
        n_contas_sem_vinculo := n_contas_sem_vinculo + 1;
        continue;
      end if;
      if v.user_id <> r.user_id then
        n_conflitos := n_conflitos + 1;
        v_problemas := v_problemas || jsonb_build_object('onde', 'conta', 'problema', 'conta_e_conexao_de_vendedores_diferentes');
        continue;
      end if;

      -- The balance row moved to another connection: close the old tie, keep it as history.
      update public.of_vinculo_contas set ate = now()
       where conta_id = c.id and vinculo_id <> v.id and ate is null;
      get diagnostics v_n = row_count;
      n_elos_fechados := n_elos_fechados + v_n;

      insert into public.of_vinculo_contas (vinculo_id, conta_id, user_id, conta_no_provedor)
      values (v.id, c.id, v.user_id, r.conta_id)
      on conflict (vinculo_id, conta_id) do update set ate = null
        where public.of_vinculo_contas.ate is not null;
      get diagnostics v_n = row_count;
      n_elos_novos := n_elos_novos + v_n;
    exception when others then
      get stacked diagnostics v_restricao = constraint_name;
      v_problemas := v_problemas || jsonb_build_object('onde', 'conta', 'problema', sqlstate, 'restricao', nullif(v_restricao, ''));
    end;
  end loop;

  -- 4) Ties whose balance row is gone (or now belongs to another connection): closed, kept.
  update public.of_vinculo_contas l set ate = now()
   where l.ate is null
     and not exists (
       select 1 from public.of_contas k
         join public.of_vinculos x on x.id = l.vinculo_id
         join public.bank_saldos s on s.conta_id = k.origem_conta_id and s.bank_connection_id = x.origem_conexao_id
        where k.id = l.conta_id);
  get diagnostics v_n = row_count;
  n_elos_fechados := n_elos_fechados + v_n;

  -- 5) Compare with the rule in force and close the run row.
  select count(*) into v_div from public.of_espelho_conferir();
  v_resumo := jsonb_build_object(
    'execucao', v_exec,
    'vinculos_novos', n_vinc_novos, 'vinculos_com_estado_alterado', n_vinc_estado,
    'vinculos_reapontados', n_vinc_reapontados, 'vinculos_sem_origem', n_vinc_sem_origem,
    'finalidades_novas', n_fin_novas, 'finalidades_trocadas', n_fin_trocadas,
    'contas_novas', n_contas_novas, 'elos_abertos', n_elos_novos, 'elos_fechados', n_elos_fechados,
    'registros_incompletos', n_incompletas, 'conflitos', n_conflitos,
    'papel_desconhecido', n_papel_desconhecido, 'contas_sem_vinculo', n_contas_sem_vinculo,
    'problemas', jsonb_array_length(v_problemas), 'divergencias', v_div);
  update public.of_espelho_execucoes
     set terminou_em = clock_timestamp(), resumo = v_resumo, divergencias = v_div,
         problemas = nullif(v_problemas, '[]'::jsonb)
   where id = v_exec;
  return v_resumo;
end $$;

-- Functions: server only as well.
do $$
declare f text;
begin
  foreach f in array array[
    'public.of_vinculo_conta_de_venda(uuid, timestamptz)', 'public.of_espelho_conferir(timestamptz)',
    'public.of_espelho_duplicadas()', 'public.of_espelho_relatorio()', 'public.of_espelho_atualizar()',
    'public.of_guardar_se_retido()', 'public.of_retencao_registrar(uuid, text, text, timestamptz, text)',
    'public.of_retencao_encerrar(bigint, text)', 'public.of_retencao_expurgar_vencidas()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
