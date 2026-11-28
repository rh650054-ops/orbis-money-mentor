-- ============================================================================================
-- DEFCON — the server becomes the source of the financial totals (ADR 0001, Phase 2).
--
-- INACTIVE BY DEFAULT. Nothing changes for anyone until an account is switched on in
-- defcon_persistencia_contas AND the global switch marcar_novas is true. Only sessions created
-- after that are marked (challenge_sessions.totais_servidor = true); every other session keeps
-- today's behaviour exactly.
--
-- In a marked session:
--   * the truth is the ledger: defcon_sales (already one row per sale, id from the client),
--     defcon_abordagens (standalone approaches) and defcon_ajustes ("Como recebeu" re-splits,
--     manual amounts, opening balance);
--   * the aggregate columns read by the app, ranking, X1, reconciliation and reports
--     (hourly_goal_blocks.valor_*, achieved_amount, approaches_count; challenge_blocks counts;
--     challenge_sessions.total_sold; daily_sales money columns) are DERIVED by defcon_recalcular;
--   * an absolute write from any client is disarmed by the guard triggers: protected columns
--     are replaced by the derived values. A split change is NEVER turned into money (a re-split
--     and a sale from an outdated screen look the same in absolute values): the new app re-splits
--     with an explicit ledger operation. Only unambiguous intents of OLD clients are kept: an
--     achieved-only bump (Nova Venda) -> manual ajuste; more standalone approaches than the ledger
--     knows -> approach rows. Taken as a difference, so an offline replay adds nothing.
--   * everything a guard could not explain is kept in defcon_conflitos.
-- ============================================================================================

-- ---------- switches ----------
create table if not exists public.defcon_persistencia_config (
  id boolean primary key default true check (id),
  marcar_novas boolean not null default false,   -- new sessions of switched-on accounts get marked
  vant_quick boolean not null default false,     -- VANT Quick interactive may register (Phase 1)
  atualizado_em timestamptz not null default now()
);
insert into public.defcon_persistencia_config (id) values (true) on conflict do nothing;

create table if not exists public.defcon_persistencia_contas (
  user_id uuid primary key,
  ativo boolean not null default true,
  desde timestamptz not null default now(),
  observacao text
);

-- ---------- marking ----------
alter table public.challenge_sessions add column if not exists totais_servidor boolean not null default false;
-- last write to this session's aggregates by a client that does not speak the ledger (old build)
alter table public.challenge_sessions add column if not exists cliente_antigo_em timestamptz;

-- ---------- ledger ----------
create table if not exists public.defcon_abordagens (
  id uuid primary key,
  user_id uuid not null,
  session_id uuid not null references public.challenge_sessions(id) on delete cascade,
  block_index integer not null,
  origem text not null check (origem in ('app','widget','atividade','legado')),
  criado_em timestamptz not null default now()
);
create index if not exists defcon_abordagens_sessao on public.defcon_abordagens (session_id, block_index);

create table if not exists public.defcon_ajustes (
  id uuid primary key,
  user_id uuid not null,
  session_id uuid not null references public.challenge_sessions(id) on delete cascade,
  block_index integer not null,
  tipo text not null check (tipo in ('redistribuicao','valor_manual','saldo_inicial')),
  -- signed differences applied to the block
  dinheiro numeric not null default 0, cartao numeric not null default 0, pix numeric not null default 0,
  calote numeric not null default 0, extra numeric not null default 0,
  origem text not null check (origem in ('app','legado','servidor')),
  criado_em timestamptz not null default now()
);
create index if not exists defcon_ajustes_sessao on public.defcon_ajustes (session_id, block_index);

-- Ids that can never become a sale/approach again ("lápides"): a deleted sale, or a VANT Quick tap
-- the iPhone asked about and the server did not have. A request delayed on the network that arrives
-- AFTER that (the sale being sent while the seller deletes it; the tap whose answer was lost) is
-- refused, so a deleted sale never survives and an answer given to the iPhone never changes.
create table if not exists public.defcon_ids_encerrados (
  id uuid primary key,
  user_id uuid not null,
  motivo text not null check (motivo in ('apagada','consultada_sem_registro')),
  criado_em timestamptz not null default now()
);
alter table public.defcon_ids_encerrados enable row level security;
revoke all on public.defcon_ids_encerrados from anon, authenticated;

create table if not exists public.defcon_conflitos (
  id bigint generated always as identity primary key,
  user_id uuid, session_id uuid, block_index integer,
  tabela text not null, motivo text not null,
  enviado jsonb, mantido jsonb,
  cliente_novo boolean not null,
  criado_em timestamptz not null default now()
);
create index if not exists defcon_conflitos_sessao on public.defcon_conflitos (session_id);

alter table public.defcon_abordagens enable row level security;
alter table public.defcon_ajustes enable row level security;
alter table public.defcon_conflitos enable row level security;
alter table public.defcon_persistencia_config enable row level security;
alter table public.defcon_persistencia_contas enable row level security;
drop policy if exists "dono le abordagens" on public.defcon_abordagens;
create policy "dono le abordagens" on public.defcon_abordagens for select using (user_id = auth.uid());
drop policy if exists "dono le ajustes" on public.defcon_ajustes;
create policy "dono le ajustes" on public.defcon_ajustes for select using (user_id = auth.uid());
-- writes only through SECURITY DEFINER functions below; conflitos/config/contas: no client access
revoke insert, update, delete on public.defcon_abordagens, public.defcon_ajustes from anon, authenticated;
revoke all on public.defcon_conflitos, public.defcon_persistencia_config, public.defcon_persistencia_contas from anon, authenticated;

-- ---------- helpers ----------
-- A client that writes through the ledger sends this header (supabase-js global header).
create or replace function public.defcon_cliente_novo() returns boolean
language sql stable set search_path to 'public' as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-vant-cliente', '') <> ''
$$;

create or replace function public.defcon_recalculando() returns boolean
language sql stable as $$ select coalesce(current_setting('vant.recalculando', true), '') = '1' $$;

-- The DEFCON block of a session is the n-th hourly block of the plan of the same user and day.
create or replace function public.defcon_bloco_do_plano(p_sessao uuid, p_idx integer) returns uuid
language sql stable set search_path to 'public' as $$
  select b.id from (
    select hb.id, row_number() over (order by hb.hour_index) - 1 as idx
    from public.challenge_sessions s
    join public.daily_goal_plans p on p.user_id = s.user_id and p.date = s.date
    join public.hourly_goal_blocks hb on hb.plan_id = p.id
    where s.id = p_sessao and hb.hour_label <> 'OFFLINE'
  ) b where b.idx = p_idx
$$;

create or replace function public.defcon_idx_do_bloco(p_bloco uuid, out sessao uuid, out idx integer)
language sql stable set search_path to 'public' as $$
  select s.id, x.idx from (
    select hb2.id, hb2.plan_id, row_number() over (order by hb2.hour_index) - 1 as idx
    from public.hourly_goal_blocks hb join public.hourly_goal_blocks hb2 on hb2.plan_id = hb.plan_id
    where hb.id = p_bloco and hb2.hour_label <> 'OFFLINE'
  ) x
  join public.daily_goal_plans p on p.id = x.plan_id
  join public.challenge_sessions s on s.user_id = p.user_id and s.date = p.date and s.totais_servidor
  where x.id = p_bloco
$$;

-- Derived values of one block, from the ledger only.
create or replace function public.defcon_derivar(p_sessao uuid, p_idx integer,
  out dinheiro numeric, out cartao numeric, out pix numeric, out calote numeric, out gorjeta numeric,
  out extra numeric, out achieved numeric, out vendas integer, out abordagens integer)
language plpgsql stable set search_path to 'public' as $$
declare a record;
begin
  select coalesce(sum(amount) filter (where coalesce(method,'dinheiro') in ('dinheiro','gorjeta')), 0),
         coalesce(sum(amount) filter (where method = 'cartao'), 0),
         coalesce(sum(amount) filter (where method = 'pix'), 0),
         coalesce(sum(amount) filter (where method = 'gorjeta'), 0),
         count(*) filter (where not late and coalesce(method,'') <> 'gorjeta')
    into dinheiro, cartao, pix, gorjeta, vendas
  from public.defcon_sales where session_id = p_sessao and block_index = p_idx;
  select coalesce(sum(j.dinheiro),0) d, coalesce(sum(j.cartao),0) c, coalesce(sum(j.pix),0) p,
         coalesce(sum(j.calote),0) cal, coalesce(sum(j.extra),0) e
    into a from public.defcon_ajustes j where j.session_id = p_sessao and j.block_index = p_idx;
  dinheiro := round(dinheiro + a.d, 2); cartao := round(cartao + a.c, 2); pix := round(pix + a.p, 2);
  calote := round(a.cal, 2); extra := round(a.e, 2); gorjeta := round(gorjeta, 2);
  achieved := round(dinheiro + cartao + pix + calote + extra, 2);
  select vendas + count(*) into abordagens from public.defcon_abordagens where session_id = p_sessao and block_index = p_idx;
end $$;

-- Writes the derived values into every aggregate column of one block + the session + the day.
create or replace function public.defcon_recalcular(p_sessao uuid, p_idx integer) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s record; d record; v_bloco uuid; v_plano uuid;
begin
  select * into s from public.challenge_sessions where id = p_sessao for update;
  if not found or not s.totais_servidor then return; end if;
  perform set_config('vant.recalculando', '1', true);
  d := public.defcon_derivar(p_sessao, p_idx);
  v_bloco := public.defcon_bloco_do_plano(p_sessao, p_idx);
  if v_bloco is not null then
    update public.hourly_goal_blocks set
      valor_dinheiro = d.dinheiro, valor_cartao = d.cartao, valor_pix = d.pix, valor_calote = d.calote,
      valor_gorjeta = d.gorjeta, achieved_amount = d.achieved, approaches_count = d.abordagens
    where id = v_bloco returning plan_id into v_plano;
  end if;
  insert into public.challenge_blocks (session_id, user_id, block_index, approaches_count, sales_count)
  values (p_sessao, s.user_id, p_idx, d.abordagens, d.vendas)
  on conflict (session_id, block_index) do update
    set approaches_count = excluded.approaches_count, sales_count = excluded.sales_count;
  update public.challenge_sessions
     set total_sold = (select coalesce(round(sum(amount), 2), 0) from public.defcon_sales where session_id = p_sessao)
   where id = p_sessao;
  -- the day's money (same formula as syncBlocksToDailySales), only when the row exists or there is money
  if v_plano is not null then
    insert into public.daily_sales (user_id, date, total_profit, total_debt, cash_sales, pix_sales, card_sales, tip_sales, unpaid_sales)
    select s.user_id, s.date,
           round(sum(coalesce(valor_dinheiro,0) + coalesce(valor_cartao,0) + coalesce(valor_pix,0)), 2),
           round(sum(coalesce(valor_calote,0)), 2), round(sum(coalesce(valor_dinheiro,0)), 2),
           round(sum(coalesce(valor_pix,0)), 2), round(sum(coalesce(valor_cartao,0)), 2),
           round(sum(coalesce(valor_gorjeta,0)), 2), case when sum(coalesce(valor_calote,0)) > 0 then 1 else 0 end
    from public.hourly_goal_blocks where plan_id = v_plano
    on conflict (user_id, date) do update set
      total_profit = excluded.total_profit, total_debt = excluded.total_debt, cash_sales = excluded.cash_sales,
      pix_sales = excluded.pix_sales, card_sales = excluded.card_sales, tip_sales = excluded.tip_sales,
      unpaid_sales = excluded.unpaid_sales;
  end if;
  perform set_config('vant.recalculando', '', true);
end $$;
revoke all on function public.defcon_recalcular(uuid, integer) from public, anon, authenticated;

-- ---------- marking new sessions ----------
create or replace function public.defcon_marcar_sessao() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  -- decided here only (a client value is ignored); the offline-day RPC replaces wholesale, never marked
  new.totais_servidor := coalesce(new.origem, '') <> 'offline'
    and coalesce((select marcar_novas from public.defcon_persistencia_config), false)
    and exists (select 1 from public.defcon_persistencia_contas where user_id = new.user_id and ativo);
  new.cliente_antigo_em := null;
  return new;
end $$;
drop trigger if exists trg_defcon_marcar_sessao on public.challenge_sessions;
create trigger trg_defcon_marcar_sessao before insert on public.challenge_sessions
  for each row execute function public.defcon_marcar_sessao();

-- A just-marked session starts from what the plan blocks already hold (e.g. a manual sale earlier
-- that day): the difference to the ledger becomes an opening-balance ajuste, so nothing is zeroed.
create or replace function public.defcon_saldo_inicial() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare b record; d record; v_idx integer := 0; dd numeric; dc numeric; dp numeric; dcal numeric; de numeric;
begin
  if not new.totais_servidor then return null; end if;
  for b in select hb.* from public.daily_goal_plans p join public.hourly_goal_blocks hb on hb.plan_id = p.id
           where p.user_id = new.user_id and p.date = new.date and hb.hour_label <> 'OFFLINE' order by hb.hour_index loop
    d := public.defcon_derivar(new.id, v_idx);
    dd := round(coalesce(b.valor_dinheiro,0) - d.dinheiro, 2);
    dc := round(coalesce(b.valor_cartao,0) - d.cartao, 2);
    dp := round(coalesce(b.valor_pix,0) - d.pix, 2);
    dcal := round(coalesce(b.valor_calote,0) - d.calote, 2);
    -- what achieved holds beyond its split (a manual amount), minus what the ledger already explains
    de := round(coalesce(b.achieved_amount,0) - (coalesce(b.valor_dinheiro,0) + coalesce(b.valor_cartao,0)
                + coalesce(b.valor_pix,0) + coalesce(b.valor_calote,0)) - d.extra, 2);
    if dd <> 0 or dc <> 0 or dp <> 0 or dcal <> 0 or de <> 0 then
      insert into public.defcon_ajustes (id, user_id, session_id, block_index, tipo, dinheiro, cartao, pix, calote, extra, origem)
      values (gen_random_uuid(), new.user_id, new.id, v_idx, 'saldo_inicial', dd, dc, dp, dcal, de, 'servidor');
    end if;
    v_idx := v_idx + 1;
  end loop;
  return null;
end $$;
drop trigger if exists trg_defcon_saldo_inicial on public.challenge_sessions;
create trigger trg_defcon_saldo_inicial after insert on public.challenge_sessions
  for each row execute function public.defcon_saldo_inicial();

-- ---------- ledger changes recompute ----------
create or replace function public.defcon_lancamento_mudou() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  if coalesce(current_setting('vant.sem_recalculo', true), '') = '1' then return null; end if;
  r := coalesce(new, old);
  if r.session_id is not null and exists (select 1 from public.challenge_sessions where id = r.session_id and totais_servidor) then
    perform public.defcon_recalcular(r.session_id, coalesce(r.block_index, 0));
  end if;
  return null;
end $$;
drop trigger if exists trg_defcon_vendas_recalc on public.defcon_sales;
create trigger trg_defcon_vendas_recalc after insert or delete on public.defcon_sales
  for each row execute function public.defcon_lancamento_mudou();
drop trigger if exists trg_defcon_abordagens_recalc on public.defcon_abordagens;
create trigger trg_defcon_abordagens_recalc after insert or delete on public.defcon_abordagens
  for each row execute function public.defcon_lancamento_mudou();
drop trigger if exists trg_defcon_ajustes_recalc on public.defcon_ajustes;
create trigger trg_defcon_ajustes_recalc after insert or delete on public.defcon_ajustes
  for each row execute function public.defcon_lancamento_mudou();

-- A sale moved between blocks / sessions (late Pix edit) is a delete + insert for the totals.
create or replace function public.defcon_venda_alterada() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.challenge_sessions where id in (old.session_id, new.session_id) and totais_servidor) then
    if old.session_id is not null then perform public.defcon_recalcular(old.session_id, coalesce(old.block_index,0)); end if;
    if new.session_id is not null then perform public.defcon_recalcular(new.session_id, coalesce(new.block_index,0)); end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_defcon_vendas_alteradas on public.defcon_sales;
create trigger trg_defcon_vendas_alteradas after update of amount, method, late, block_index, session_id on public.defcon_sales
  for each row execute function public.defcon_venda_alterada();

-- ---------- guards (absolute writes from any client) ----------
create or replace function public.defcon_guarda_bloco_hora() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare loc record; d record; v_novo boolean := public.defcon_cliente_novo();
        t_old numeric; t_new numeric;
begin
  if public.defcon_recalculando() then return new; end if;
  select * into loc from public.defcon_idx_do_bloco(new.id);
  if not found or loc.sessao is null then return new; end if;  -- unmarked: today's behaviour
  if not v_novo then update public.challenge_sessions set cliente_antigo_em = now() where id = loc.sessao and totais_servidor; end if;

  t_old := coalesce(old.valor_dinheiro,0) + coalesce(old.valor_cartao,0) + coalesce(old.valor_pix,0) + coalesce(old.valor_calote,0);
  t_new := coalesce(new.valor_dinheiro,0) + coalesce(new.valor_cartao,0) + coalesce(new.valor_pix,0) + coalesce(new.valor_calote,0);

  perform set_config('vant.sem_recalculo', '1', true);
  if (new.valor_dinheiro, new.valor_cartao, new.valor_pix, new.valor_calote)
     is distinct from (old.valor_dinheiro, old.valor_cartao, old.valor_pix, old.valor_calote) then
    -- NEVER turned into money. A re-split with the same total and a sale written from an outdated
    -- screen look identical in absolute values (widget sells 20 by Pix, the old screen writes its
    -- own cash sale of 20 over it: same total, other split). Reading it as a re-split would move
    -- the widget's Pix into cash. So: ignored and kept for the audit. The new app re-splits with an
    -- explicit ledger operation (defcon_lancar 'redistribuir'); an old app's re-split on a marked
    -- session does not apply (logged, and the account is only switched on with no old builds).
    insert into public.defcon_conflitos (user_id, session_id, block_index, tabela, motivo, enviado, mantido, cliente_novo)
    values (new.user_id, loc.sessao, loc.idx, 'hourly_goal_blocks',
            case when abs(t_new - t_old) < 0.005 then 'redistribuicao_absoluta_ignorada' else 'total_absoluto_ignorado' end,
            jsonb_build_object('dinheiro', new.valor_dinheiro, 'cartao', new.valor_cartao, 'pix', new.valor_pix, 'calote', new.valor_calote, 'achieved', new.achieved_amount),
            jsonb_build_object('dinheiro', old.valor_dinheiro, 'cartao', old.valor_cartao, 'pix', old.valor_pix, 'calote', old.valor_calote, 'achieved', old.achieved_amount), v_novo);
  elsif coalesce(new.achieved_amount,0) < coalesce(old.achieved_amount,0) then
    -- achieved went DOWN with the split untouched: an outdated screen that does not know a manual
    -- amount (today's DEFCON rewrites achieved as the split's sum). Never a money change: logged.
    insert into public.defcon_conflitos (user_id, session_id, block_index, tabela, motivo, enviado, mantido, cliente_novo)
    values (new.user_id, loc.sessao, loc.idx, 'hourly_goal_blocks', 'achieved_menor_ignorado',
            jsonb_build_object('achieved', new.achieved_amount), jsonb_build_object('achieved', old.achieved_amount), v_novo);
  elsif new.achieved_amount is distinct from old.achieved_amount then
    -- achieved alone went UP, split untouched: only the Nova Venda form does this (the DEFCON always
    -- writes the split with it), read-modify-write on the fresh row -> a manual amount. Unambiguous.
    insert into public.defcon_ajustes (id, user_id, session_id, block_index, tipo, extra, origem)
    values (gen_random_uuid(), new.user_id, loc.sessao, loc.idx, 'valor_manual',
            round(coalesce(new.achieved_amount,0) - coalesce(old.achieved_amount,0), 2), case when v_novo then 'app' else 'legado' end);
  end if;
  perform set_config('vant.sem_recalculo', '', true);

  d := public.defcon_derivar(loc.sessao, loc.idx);
  new.valor_dinheiro := d.dinheiro; new.valor_cartao := d.cartao; new.valor_pix := d.pix; new.valor_calote := d.calote;
  new.valor_gorjeta := d.gorjeta; new.achieved_amount := d.achieved; new.approaches_count := d.abordagens;
  return new;
end $$;
drop trigger if exists trg_defcon_guarda_bloco_hora on public.hourly_goal_blocks;
create trigger trg_defcon_guarda_bloco_hora before update on public.hourly_goal_blocks
  for each row execute function public.defcon_guarda_bloco_hora();

create or replace function public.defcon_guarda_contadores() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare s record; d record; v_novo boolean := public.defcon_cliente_novo();
        avulsas_cliente integer; avulsas_servidor integer; i integer;
begin
  if public.defcon_recalculando() then return new; end if;
  select * into s from public.challenge_sessions where id = new.session_id;
  if not found or not s.totais_servidor then return new; end if;
  -- INSERT ... ON CONFLICT DO UPDATE runs this BEFORE INSERT first: when the row exists the UPDATE
  -- branch will run this again with the real "old" row, so do nothing here (no side effect twice)
  if tg_op = 'INSERT' and exists (select 1 from public.challenge_blocks where session_id = new.session_id and block_index = new.block_index) then
    return new;
  end if;
  d := public.defcon_derivar(new.session_id, new.block_index);
  if v_novo then
    -- the ledger client registers approaches through defcon_lancar: what it writes here (closing a
    -- block, status) carries no count to read
    new.approaches_count := d.abordagens; new.sales_count := d.vendas;
    return new;
  end if;
  update public.challenge_sessions set cliente_antigo_em = now() where id = s.id;
  -- the client's own view: approaches = its sales + its standalone approaches. On a brand-new row a
  -- missing sales_count arrives as the default 0: then the server's count is used (never over-counts)
  avulsas_cliente := coalesce(new.approaches_count, 0)
    - case when tg_op = 'INSERT' and coalesce(new.sales_count, 0) = 0 then d.vendas else coalesce(new.sales_count, d.vendas) end;
  select count(*) into avulsas_servidor from public.defcon_abordagens where session_id = new.session_id and block_index = new.block_index;
  if avulsas_cliente > avulsas_servidor then
    perform set_config('vant.sem_recalculo', '1', true);
    for i in 1 .. (avulsas_cliente - avulsas_servidor) loop
      insert into public.defcon_abordagens (id, user_id, session_id, block_index, origem)
      values (gen_random_uuid(), s.user_id, new.session_id, new.block_index, 'legado');
    end loop;
    perform set_config('vant.sem_recalculo', '', true);
  elsif avulsas_cliente < avulsas_servidor then
    -- an outdated screen (another writer counted in the meantime): keep the server's count
    insert into public.defcon_conflitos (user_id, session_id, block_index, tabela, motivo, enviado, mantido, cliente_novo)
    values (s.user_id, s.id, new.block_index, 'challenge_blocks', 'abordagens_desatualizadas',
            jsonb_build_object('approaches', new.approaches_count, 'sales', new.sales_count),
            jsonb_build_object('avulsas_servidor', avulsas_servidor, 'vendas', d.vendas), v_novo);
  end if;
  d := public.defcon_derivar(new.session_id, new.block_index);
  new.approaches_count := d.abordagens; new.sales_count := d.vendas;
  return new;
end $$;
drop trigger if exists trg_defcon_guarda_contadores on public.challenge_blocks;
create trigger trg_defcon_guarda_contadores before insert or update on public.challenge_blocks
  for each row execute function public.defcon_guarda_contadores();

create or replace function public.defcon_guarda_sessao() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if public.defcon_recalculando() then return new; end if;
  new.totais_servidor := old.totais_servidor;                    -- never marked nor unmarked by a client
  if not old.totais_servidor then return new; end if;
  if new.total_sold is distinct from old.total_sold then
    if not public.defcon_cliente_novo() then new.cliente_antigo_em := now(); end if;
    new.total_sold := (select coalesce(round(sum(amount), 2), 0) from public.defcon_sales where session_id = new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_defcon_guarda_sessao on public.challenge_sessions;
create trigger trg_defcon_guarda_sessao before update on public.challenge_sessions
  for each row execute function public.defcon_guarda_sessao();

-- daily_sales is NOT guarded: every client already rebuilds it from the (now derived) hour blocks,
-- and the Nova Venda form writes its own amounts there, as today. defcon_recalcular rebuilds it the
-- same way after each ledger change, for the writes that come with no app open (VANT Quick).

-- ---------- the ledger write for new clients (and VANT Quick, Phase 1) ----------
-- p_id = the client's id of this operation (idempotency key). Returns the derived totals.
-- The account is an argument here: this one is only callable by the server (VANT Quick passes the
-- account of its device credential). Clients call defcon_lancar, which passes auth.uid().
create or replace function public.defcon_lancar_conta(uid uuid, p_id uuid, p_tipo text, p_sessao uuid, p_bloco integer,
  p_valor numeric default null, p_metodo text default null, p_produto uuid default null, p_qtd numeric default null,
  p_split jsonb default null, p_origem text default 'app', p_criado_em timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare s record; d record; atual record; feito boolean := true; v_quando timestamptz;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;
  if p_id is null then raise exception 'id_obrigatorio'; end if;
  if p_origem not in ('app','widget','atividade') then raise exception 'origem_invalida'; end if;
  select * into s from public.challenge_sessions where id = p_sessao for update;
  if not found or s.user_id <> uid then raise exception 'sessao_invalida'; end if;
  if not s.totais_servidor then raise exception 'sessao_nao_servidor'; end if;  -- the client keeps today's path
  if p_bloco is null or p_bloco < 0 then raise exception 'bloco_invalido'; end if;
  -- when it happened on the phone (an offline sale goes up later and keeps its hour): never in the
  -- future, never before the session's day
  v_quando := least(now(), greatest(coalesce(p_criado_em, now()), s.date::timestamptz - interval '1 day'));

  -- an id already closed (deleted, or answered "not registered") never becomes a sale/approach
  if p_tipo in ('venda','venda_tardia','gorjeta','abordagem') and exists (select 1 from public.defcon_ids_encerrados where id = p_id) then
    return jsonb_build_object('aplicado', false, 'encerrado', true, 'id', p_id);
  end if;

  if p_tipo in ('venda','venda_tardia','gorjeta') then
    if p_valor is null or p_valor <= 0 or p_valor > 5000 then raise exception 'valor_invalido'; end if;
    insert into public.defcon_sales (id, user_id, session_id, block_index, amount, method, late, product_id, qty, created_at)
    values (p_id, uid, p_sessao, p_bloco, round(p_valor, 2),
            case p_tipo when 'gorjeta' then 'gorjeta' when 'venda_tardia' then 'pix' else coalesce(nullif(p_metodo,''),'dinheiro') end,
            p_tipo = 'venda_tardia', p_produto, greatest(1, coalesce(p_qtd, 1)), v_quando)
    on conflict (id) do nothing;
    feito := found;
  elsif p_tipo = 'apagar_venda' then
    delete from public.defcon_sales where id = p_id and user_id = uid and session_id = p_sessao;
    feito := found;
    -- whether it was there or not (still on its way): this id is closed for good
    insert into public.defcon_ids_encerrados (id, user_id, motivo) values (p_id, uid, 'apagada') on conflict (id) do nothing;
  elsif p_tipo = 'abordagem' then
    insert into public.defcon_abordagens (id, user_id, session_id, block_index, origem, criado_em)
    values (p_id, uid, p_sessao, p_bloco, p_origem, v_quando) on conflict (id) do nothing;
    feito := found;
  elsif p_tipo = 'redistribuir' then
    -- p_split = the block's target split {dinheiro, cartao, pix, calote}; the difference to the derived
    -- one is stored once under p_id (a replay of the same id adds nothing)
    if exists (select 1 from public.defcon_ajustes where id = p_id) then feito := false;
    else
      atual := public.defcon_derivar(p_sessao, p_bloco);
      if abs((coalesce((p_split->>'dinheiro')::numeric,0) + coalesce((p_split->>'cartao')::numeric,0) + coalesce((p_split->>'pix')::numeric,0)
             + coalesce((p_split->>'calote')::numeric,0)) - (atual.dinheiro + atual.cartao + atual.pix + atual.calote)) >= 0.005 then
        raise exception 'redistribuicao_muda_total';
      end if;
      insert into public.defcon_ajustes (id, user_id, session_id, block_index, tipo, dinheiro, cartao, pix, calote, origem)
      values (p_id, uid, p_sessao, p_bloco, 'redistribuicao',
              round(coalesce((p_split->>'dinheiro')::numeric,0) - atual.dinheiro, 2), round(coalesce((p_split->>'cartao')::numeric,0) - atual.cartao, 2),
              round(coalesce((p_split->>'pix')::numeric,0) - atual.pix, 2), round(coalesce((p_split->>'calote')::numeric,0) - atual.calote, 2), 'app');
    end if;
  elsif p_tipo = 'valor_manual' then
    if p_valor is null or p_valor = 0 or abs(p_valor) > 5000 then raise exception 'valor_invalido'; end if;
    insert into public.defcon_ajustes (id, user_id, session_id, block_index, tipo, extra, origem)
    values (p_id, uid, p_sessao, p_bloco, 'valor_manual', round(p_valor, 2), 'app') on conflict (id) do nothing;
    feito := found;
  else
    raise exception 'tipo_invalido';
  end if;

  d := public.defcon_derivar(p_sessao, p_bloco);
  return jsonb_build_object(
    'aplicado', feito, 'id', p_id,
    'bloco', jsonb_build_object('indice', p_bloco, 'dinheiro', d.dinheiro, 'cartao', d.cartao, 'pix', d.pix, 'calote', d.calote,
                                'gorjeta', d.gorjeta, 'total', d.achieved, 'vendas', d.vendas, 'abordagens', d.abordagens),
    'sessao', (select jsonb_build_object('total', total_sold) from public.challenge_sessions where id = p_sessao),
    'dia', (select jsonb_build_object('vendas', count(*) filter (where not late and coalesce(method,'') <> 'gorjeta'))
              from public.defcon_sales where session_id = p_sessao)
            || jsonb_build_object('abordagens',
                 (select count(*) from public.defcon_sales where session_id = p_sessao and not late and coalesce(method,'') <> 'gorjeta')
               + (select count(*) from public.defcon_abordagens where session_id = p_sessao)));
end $$;
revoke all on function public.defcon_lancar_conta(uuid, uuid, text, uuid, integer, numeric, text, uuid, numeric, jsonb, text, timestamptz) from public, anon, authenticated;

create or replace function public.defcon_lancar(p_id uuid, p_tipo text, p_sessao uuid, p_bloco integer,
  p_valor numeric default null, p_metodo text default null, p_produto uuid default null, p_qtd numeric default null,
  p_split jsonb default null, p_origem text default 'app', p_criado_em timestamptz default null)
returns jsonb language sql security definer set search_path to 'public' as $$
  select public.defcon_lancar_conta(auth.uid(), p_id, p_tipo, p_sessao, p_bloco, p_valor, p_metodo, p_produto, p_qtd, p_split,
                                    case when p_origem in ('widget','atividade') then 'app' else p_origem end, p_criado_em)
$$;
revoke all on function public.defcon_lancar(uuid, text, uuid, integer, numeric, text, uuid, numeric, jsonb, text, timestamptz) from public, anon;
grant execute on function public.defcon_lancar(uuid, text, uuid, integer, numeric, text, uuid, numeric, jsonb, text, timestamptz) to authenticated;

-- ---------- shadow mode ----------
-- For every session of a day (marked or not) compares what the clients wrote with what the ledger
-- explains. Unmarked sessions have no ajuste/approach rows, so a re-split shows as "redistribuicao"
-- (explained) and approaches cannot be checked there (only sales counts).
create table if not exists public.defcon_sombra (
  id bigint generated always as identity primary key,
  data date not null, session_id uuid not null, user_id uuid not null, block_index integer,
  item text not null,              -- total_sessao | dinheiro_do_bloco | vendas_do_bloco | abordagens_do_bloco
  gravado numeric, derivado numeric, diferenca numeric,
  classe text not null,            -- igual | redistribuicao | manual | nao_explicada
  medido_em timestamptz not null default now()
);
create index if not exists defcon_sombra_data on public.defcon_sombra (data, classe);
alter table public.defcon_sombra enable row level security;
revoke all on public.defcon_sombra from anon, authenticated;

create or replace function public.defcon_sombra_medir(p_data date) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare s record; b record; d record; v_idx integer; n integer := 0; t_rows numeric; cb record;
        t_gravado numeric; t_split numeric;
begin
  delete from public.defcon_sombra where data = p_data;
  for s in select * from public.challenge_sessions where date = p_data and coalesce(origem,'') <> 'offline' loop
    select coalesce(round(sum(amount), 2), 0) into t_rows from public.defcon_sales where session_id = s.id;
    insert into public.defcon_sombra (data, session_id, user_id, item, gravado, derivado, diferenca, classe)
    values (p_data, s.id, s.user_id, 'total_sessao', s.total_sold, t_rows, round(s.total_sold - t_rows, 2),
            case when abs(s.total_sold - t_rows) < 0.01 then 'igual' else 'nao_explicada' end);
    n := n + 1; v_idx := 0;
    for b in select hb.* from public.daily_goal_plans p join public.hourly_goal_blocks hb on hb.plan_id = p.id
             where p.user_id = s.user_id and p.date = s.date and hb.hour_label <> 'OFFLINE' order by hb.hour_index loop
      d := public.defcon_derivar(s.id, v_idx);
      t_gravado := coalesce(b.achieved_amount, 0);
      t_split := coalesce(b.valor_dinheiro,0) + coalesce(b.valor_cartao,0) + coalesce(b.valor_pix,0) + coalesce(b.valor_calote,0);
      insert into public.defcon_sombra (data, session_id, user_id, block_index, item, gravado, derivado, diferenca, classe)
      values (p_data, s.id, s.user_id, v_idx, 'dinheiro_do_bloco', t_gravado, d.achieved, round(t_gravado - d.achieved, 2),
              case when abs(t_gravado - d.achieved) < 0.01 and abs(coalesce(b.valor_pix,0) - d.pix) < 0.01 and abs(coalesce(b.valor_cartao,0) - d.cartao) < 0.01 then 'igual'
                   when abs(t_split - (d.dinheiro + d.cartao + d.pix + d.calote)) < 0.01 and abs(t_gravado - t_split - d.extra) < 0.01 then 'redistribuicao'
                   when abs(t_split - (d.dinheiro + d.cartao + d.pix + d.calote)) < 0.01 then 'manual'
                   else 'nao_explicada' end);
      select * into cb from public.challenge_blocks where session_id = s.id and block_index = v_idx;
      if found then
        insert into public.defcon_sombra (data, session_id, user_id, block_index, item, gravado, derivado, diferenca, classe)
        values (p_data, s.id, s.user_id, v_idx, 'vendas_do_bloco', cb.sales_count, d.vendas, cb.sales_count - d.vendas,
                case when coalesce(cb.sales_count,0) = d.vendas then 'igual' else 'nao_explicada' end);
        if s.totais_servidor then
          insert into public.defcon_sombra (data, session_id, user_id, block_index, item, gravado, derivado, diferenca, classe)
          values (p_data, s.id, s.user_id, v_idx, 'abordagens_do_bloco', cb.approaches_count, d.abordagens, cb.approaches_count - d.abordagens,
                  case when coalesce(cb.approaches_count,0) = d.abordagens then 'igual' else 'nao_explicada' end);
        end if;
      end if;
      v_idx := v_idx + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.defcon_sombra_medir(date) from public, anon, authenticated;

-- Approval criteria of the shadow period (ADR 0001 §5). One row per criterion, ok true/false.
create or replace function public.defcon_sombra_aprovacao(p_desde date, p_ate date)
returns table (criterio text, valor numeric, exigido text, ok boolean)
language sql stable security definer set search_path to 'public' as $$
  with m as (select * from public.defcon_sombra where data between p_desde and p_ate),
       dias as (select count(distinct data) n from m),
       sess as (select count(distinct session_id) n from m),
       c as (select * from public.defcon_conflitos where criado_em::date between p_desde and p_ate)
  select 'dias medidos', (select n from dias), '>= 3', (select n from dias) >= 3
  union all select 'sessoes medidas', (select n from sess), '>= 30', (select n from sess) >= 30
  union all select 'divergencias financeiras nao explicadas (total do dia)',
                   (select count(*) from m where item = 'total_sessao' and classe = 'nao_explicada'), '= 0',
                   not exists (select 1 from m where item = 'total_sessao' and classe = 'nao_explicada')
  union all select 'divergencias financeiras nao explicadas (bloco)',
                   (select count(*) from m where item = 'dinheiro_do_bloco' and classe = 'nao_explicada'), '= 0',
                   not exists (select 1 from m where item = 'dinheiro_do_bloco' and classe = 'nao_explicada')
  union all select 'divergencias de vendas por bloco', (select count(*) from m where item = 'vendas_do_bloco' and classe = 'nao_explicada'), '= 0',
                   not exists (select 1 from m where item = 'vendas_do_bloco' and classe = 'nao_explicada')
  union all select 'abordagens divergentes em sessoes marcadas', (select count(*) from m where item = 'abordagens_do_bloco' and classe = 'nao_explicada'), '= 0',
                   not exists (select 1 from m where item = 'abordagens_do_bloco' and classe = 'nao_explicada')
  union all select 'abordagens desatualizadas de clientes antigos (sessoes marcadas)',
                   (select count(*) from c where motivo = 'abordagens_desatualizadas'), '= 0',
                   not exists (select 1 from c where motivo = 'abordagens_desatualizadas')
$$;
revoke all on function public.defcon_sombra_aprovacao(date, date) from public, anon, authenticated;

-- ---------- rollback that never lets an old write erase what the server registered ----------
-- Switching an account off only stops marking its NEXT sessions. A marked session stays marked for
-- good (defcon_guarda_sessao refuses to unmark it), so its guards keep protecting the widget's sales.
create or replace function public.defcon_desligar_conta(p_user uuid) returns void
language sql security definer set search_path to 'public' as $$
  update public.defcon_persistencia_contas set ativo = false where user_id = p_user;
$$;
revoke all on function public.defcon_desligar_conta(uuid) from public, anon, authenticated;
