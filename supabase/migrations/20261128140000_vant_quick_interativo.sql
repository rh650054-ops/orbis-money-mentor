-- ============================================================================================
-- VANT Quick interactive (Phase 1): a sale or an approach registered from the home screen widget
-- or the lock screen Live Activity, in the background, without opening the app.
--
-- OFF BY DEFAULT: defcon_persistencia_config.vant_quick = false refuses every action.
-- Requires Phase 2 (20261128130000): it only writes on MARKED sessions, through defcon_lancar_conta,
-- so the totals stay the server's (ledger + guards), exactly like a sale made in the app.
--
-- Credential: a random device token, shown ONCE to the app (kept in the iPhone Keychain), stored
-- here only as its SHA-256. It can only register a quick sale / approach and read today's panel of
-- its own account. Expires in 30 days, revoked on sign-out / account switch / by the user.
-- ============================================================================================

create table if not exists public.vant_quick_config (
  user_id uuid primary key,
  valor numeric not null check (valor > 0 and valor <= 5000),
  metodo text not null check (metodo in ('dinheiro','pix','cartao')),
  atualizado_em timestamptz not null default now()
);
alter table public.vant_quick_config enable row level security;
drop policy if exists "dono le config vant quick" on public.vant_quick_config;
create policy "dono le config vant quick" on public.vant_quick_config for select using (user_id = auth.uid());
revoke insert, update, delete on public.vant_quick_config from anon, authenticated;

create table if not exists public.vant_quick_credenciais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  hash bytea not null unique,
  aparelho text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  uso_dia date,
  usos_no_dia integer not null default 0
);
create index if not exists vant_quick_credenciais_conta on public.vant_quick_credenciais (user_id) where revogado_em is null;
alter table public.vant_quick_credenciais enable row level security;
revoke all on public.vant_quick_credenciais from anon, authenticated;   -- not even the hash is readable

-- Usage limits sized for a street seller: a sale + approach every ~2 s at peak, a long day.
-- (One sale per second per device would already be far above any real rhythm.)
create or replace function public.vant_quick_limites(out intervalo_ms integer, out por_dia integer)
language sql immutable as $$ select 700, 3000 $$;

-- ---------- the app (signed in) ----------
create or replace function public.vant_quick_salvar_config(p_valor numeric, p_metodo text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 5000 then raise exception 'valor_invalido'; end if;
  if p_metodo not in ('dinheiro','pix','cartao') then raise exception 'metodo_invalido'; end if;
  insert into public.vant_quick_config (user_id, valor, metodo) values (auth.uid(), round(p_valor, 2), p_metodo)
  on conflict (user_id) do update set valor = excluded.valor, metodo = excluded.metodo, atualizado_em = now();
end $$;
grant execute on function public.vant_quick_salvar_config(numeric, text) to authenticated;

-- A new credential for this device. The previous one of the same device is revoked (rotation); at
-- most 5 live devices per account. The token is returned ONCE and never stored in clear.
create or replace function public.vant_quick_emitir(p_aparelho text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); v_token text; v_id uuid; v_expira timestamptz := now() + interval '30 days';
begin
  if uid is null then raise exception 'nao_autenticado'; end if;
  if coalesce(length(trim(p_aparelho)), 0) not between 8 and 100 then raise exception 'aparelho_invalido'; end if;
  update public.vant_quick_credenciais set revogado_em = now()
   where user_id = uid and aparelho = p_aparelho and revogado_em is null;
  if (select count(*) from public.vant_quick_credenciais where user_id = uid and revogado_em is null and expira_em > now()) >= 5 then
    raise exception 'aparelhos_demais';
  end if;
  -- 244 random bits (two v4 UUIDs), hex: never derived from anything about the account
  v_token := 'vq1_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.vant_quick_credenciais (user_id, hash, aparelho, expira_em)
  values (uid, sha256(convert_to(v_token, 'UTF8')), p_aparelho, v_expira) returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_expira);
end $$;
revoke all on function public.vant_quick_emitir(text) from public, anon;
grant execute on function public.vant_quick_emitir(text) to authenticated;

-- Sign-out, account switch or "desconectar": this device (p_aparelho) or every device (null).
create or replace function public.vant_quick_revogar(p_aparelho text default null) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  update public.vant_quick_credenciais set revogado_em = now()
   where user_id = auth.uid() and revogado_em is null and (p_aparelho is null or aparelho = p_aparelho);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vant_quick_revogar(text) from public, anon;
grant execute on function public.vant_quick_revogar(text) to authenticated;

-- ---------- the widget / Live Activity (through the vant-quick edge function, service role) ----------
-- Today's panel of an account, as the widget and the Live Activity show it. Server numbers only.
create or replace function public.vant_quick_painel(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare s record; b record; c record; v_vendas integer; v_ab integer; v_bloco_inicio timestamptz; v_fat numeric;
begin
  select * into s from public.challenge_sessions
   where user_id = p_uid and date = (now() at time zone 'America/Sao_Paulo')::date;
  if not found then return jsonb_build_object('sessao', null); end if;
  select count(*) filter (where not late and coalesce(method,'') <> 'gorjeta') into v_vendas from public.defcon_sales where session_id = s.id;
  select v_vendas + count(*) into v_ab from public.defcon_abordagens where session_id = s.id;
  select hb.* into b from public.hourly_goal_blocks hb where hb.id = public.defcon_bloco_do_plano(s.id, s.current_block_index);
  select * into c from public.vant_quick_config where user_id = p_uid;
  v_bloco_inicio := b.timer_started_at;
  -- the same total the DEFCON screen shows: the plan's hour blocks (cash, card, Pix, calote)
  select coalesce(round(sum(coalesce(hb.valor_dinheiro,0) + coalesce(hb.valor_cartao,0) + coalesce(hb.valor_pix,0) + coalesce(hb.valor_calote,0)), 2), 0)
    into v_fat from public.daily_goal_plans p join public.hourly_goal_blocks hb on hb.plan_id = p.id
   where p.user_id = p_uid and p.date = s.date;
  return jsonb_build_object(
    'sessao', s.id, 'data', s.date, 'estado', s.status, 'servidor', s.totais_servidor,
    'faturamento', v_fat, 'meta', s.daily_goal,
    'restante', greatest(0, round(s.daily_goal - v_fat, 2)),
    'progresso', case when s.daily_goal > 0 then least(1, round(v_fat / s.daily_goal, 4)) else 0 end,
    'vendas', v_vendas, 'abordagens', v_ab,
    'conversao', case when v_ab > 0 then round(v_vendas::numeric / v_ab, 4) end,
    'bloco', s.current_block_index + 1, 'totalBlocos', s.total_blocks,
    'blocoEstado', b.timer_status,
    'blocoInicio', v_bloco_inicio, 'blocoFim', v_bloco_inicio + interval '1 hour',
    'rapida', case when c.user_id is null then null else jsonb_build_object('valor', c.valor, 'metodo', c.metodo) end);
end $$;
revoke all on function public.vant_quick_painel(uuid) from public, anon, authenticated;

-- p_acao: 'venda' | 'abordagem' | 'painel' | 'status'. p_id = the tap's id (the same id is resent
-- when an answer did not arrive: it is applied once). p_origem: 'widget' | 'atividade'.
-- 'status' (the iPhone asking later about a tap whose answer never arrived): "existe" true when the
-- server has it; when it does not, the id is CLOSED at that moment, so the original request, if it
-- is still travelling, can never land afterwards: the answer the iPhone got never changes.
-- Returns {ok, motivo?, aplicado?, painel}. A refusal never writes anything.
create or replace function public.vant_quick_executar(p_token text, p_acao text, p_id uuid default null, p_origem text default 'widget')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare cr record; s record; b record; c record; v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
        lim record; r jsonb;
begin
  if p_acao not in ('venda','abordagem','painel','status') then return jsonb_build_object('ok', false, 'motivo', 'acao_invalida'); end if;
  if p_origem not in ('widget','atividade') then return jsonb_build_object('ok', false, 'motivo', 'origem_invalida'); end if;
  if p_token is null or p_token !~ '^vq1_[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'motivo', 'credencial_invalida'); end if;

  select * into cr from public.vant_quick_credenciais where hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or cr.revogado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'credencial_invalida'); end if;
  if cr.expira_em <= now() then return jsonb_build_object('ok', false, 'motivo', 'credencial_expirada'); end if;

  if p_acao = 'painel' then    -- reading never counts against the usage limits
    return jsonb_build_object('ok', true, 'painel', public.vant_quick_painel(cr.user_id));
  end if;
  if p_id is null then return jsonb_build_object('ok', false, 'motivo', 'id_obrigatorio'); end if;
  -- the same tap id is handled one request at a time (a late original vs. the status question)
  perform pg_advisory_xact_lock(hashtextextended('vant_quick:' || p_id::text, 0));

  if p_acao = 'status' then    -- never counts against the limits, never writes a sale
    if exists (select 1 from public.defcon_sales where id = p_id and user_id = cr.user_id)
       or exists (select 1 from public.defcon_abordagens where id = p_id and user_id = cr.user_id) then
      return jsonb_build_object('ok', true, 'existe', true, 'painel', public.vant_quick_painel(cr.user_id));
    end if;
    insert into public.defcon_ids_encerrados (id, user_id, motivo) values (p_id, cr.user_id, 'consultada_sem_registro')
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'existe', false, 'painel', public.vant_quick_painel(cr.user_id));
  end if;

  if not coalesce((select vant_quick from public.defcon_persistencia_config), false) then
    return jsonb_build_object('ok', false, 'motivo', 'desativado');
  end if;
  -- a resend of a tap already applied answers what happened, without counting the use again
  if exists (select 1 from public.defcon_sales where id = p_id and user_id = cr.user_id)
     or exists (select 1 from public.defcon_abordagens where id = p_id and user_id = cr.user_id) then
    return jsonb_build_object('ok', true, 'aplicado', false, 'repetido', true, 'painel', public.vant_quick_painel(cr.user_id));
  end if;
  -- the iPhone was already told "not registered" for this id (status): it stays that way
  if exists (select 1 from public.defcon_ids_encerrados where id = p_id) then
    return jsonb_build_object('ok', false, 'motivo', 'encerrada');
  end if;

  lim := public.vant_quick_limites();
  if cr.ultimo_uso_em is not null and now() - cr.ultimo_uso_em < make_interval(secs => lim.intervalo_ms / 1000.0) then
    return jsonb_build_object('ok', false, 'motivo', 'rapido_demais');
  end if;
  if cr.uso_dia = v_dia and cr.usos_no_dia >= lim.por_dia then
    return jsonb_build_object('ok', false, 'motivo', 'limite_do_dia');
  end if;

  select * into s from public.challenge_sessions where user_id = cr.user_id and date = v_dia for update;
  if not found or s.status <> 'active' then return jsonb_build_object('ok', false, 'motivo', 'sem_defcon'); end if;
  if not s.totais_servidor then return jsonb_build_object('ok', false, 'motivo', 'defcon_nao_habilitado'); end if;
  -- an old build wrote to this session: two writers counting at once could diverge (ADR 0001 §7.1)
  if s.cliente_antigo_em is not null then return jsonb_build_object('ok', false, 'motivo', 'atualize_outro_aparelho'); end if;
  select hb.* into b from public.hourly_goal_blocks hb where hb.id = public.defcon_bloco_do_plano(s.id, s.current_block_index);
  if not found or coalesce(b.timer_status, '') <> 'running' then return jsonb_build_object('ok', false, 'motivo', 'bloco_parado'); end if;

  if p_acao = 'venda' then
    select * into c from public.vant_quick_config where user_id = cr.user_id;
    if not found then return jsonb_build_object('ok', false, 'motivo', 'sem_valor'); end if;
    r := public.defcon_lancar_conta(cr.user_id, p_id, 'venda', s.id, s.current_block_index, c.valor, c.metodo, null, null, null, p_origem);
  else
    r := public.defcon_lancar_conta(cr.user_id, p_id, 'abordagem', s.id, s.current_block_index, null, null, null, null, null, p_origem);
  end if;

  update public.vant_quick_credenciais
     set ultimo_uso_em = now(),
         usos_no_dia = case when uso_dia = v_dia then usos_no_dia + 1 else 1 end, uso_dia = v_dia
   where id = cr.id;
  return jsonb_build_object('ok', true, 'aplicado', (r ->> 'aplicado')::boolean, 'painel', public.vant_quick_painel(cr.user_id));
end $$;
revoke all on function public.vant_quick_executar(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.vant_quick_executar(text, text, uuid, text) to service_role;

-- Whether the app should offer the interactive buttons to this account: both switches on.
-- (Display only: the executor checks the same switches again on every tap.)
create or replace function public.vant_quick_disponivel() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('interativo',
    auth.uid() is not null
    and coalesce((select vant_quick and marcar_novas from public.defcon_persistencia_config), false)
    and exists (select 1 from public.defcon_persistencia_contas where user_id = auth.uid() and ativo))
$$;
revoke all on function public.vant_quick_disponivel() from public, anon;
grant execute on function public.vant_quick_disponivel() to authenticated;
