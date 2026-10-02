-- ============================================================
-- SALA DE COMPETIÇÃO (X1 em grupo) — Rick + Mohamed, 02/10/2026
--   • Uma sala = um dia, uma aposta igual pra todos, 2 a 8 lutadores.
--   • Quem fatura mais no dia (DEFCON) vence. Pote = apostas − 10%.
--     2 lutadores: vencedor leva tudo. 3+: 1º leva 70%, 2º leva 30%.
--     Empate numa colocação divide a parte igualmente.
--   • Aposta travada na carteira na hora de entrar. Sair devolve, mas só
--     até 12h (BRT) do dia. Entrar até 18h. Sala com < 2 confirmados no
--     fechamento é cancelada e devolve tudo.
--   • Vários X1 ao mesmo tempo: x1_lutar deixa de travar em "1 luta por dia"
--     (limite: 3 lutas ativas por dia).
--   • CORREÇÃO: o check de status não aceitava 'open'/'expired' e o de
--     money_status não aceitava 'refunded' — a liquidação noturna
--     (x1_settle_due) estava falhando desde 29/09. Aqui destrava.
--   • Paridade com o banco (02/10): x1_sala_criar/x1_sala_entrar usam
--     coalesce(ver,false) e coalesce(bal,0) — quem não tem linha em
--     profiles/x1_wallets é barrado, não liberado por NULL. Já aplicado
--     no banco; NÃO reaplicar este arquivo.
-- ============================================================

-- ---------- 0) checks que travavam a liquidação ----------
alter table public.x1_challenges drop constraint if exists x1_challenges_status_check;
alter table public.x1_challenges add constraint x1_challenges_status_check
  check (status in ('pending','accepted','active','declined','cancelled','awaiting_result','finished','open','expired'));
alter table public.x1_challenges drop constraint if exists x1_challenges_money_status_check;
alter table public.x1_challenges add constraint x1_challenges_money_status_check
  check (money_status in ('none','awaiting_payment','secured','prize_released','refunded'));

-- ---------- 1) tabelas ----------
create table if not exists public.x1_salas (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Sala de competição',
  scheduled_date date not null,
  stakes_amount numeric not null default 0 check (stakes_amount >= 0),
  vagas int not null default 4 check (vagas between 2 and 8),
  status text not null default 'open' check (status in ('open','finished','cancelled','awaiting_result')),
  fee_amount numeric not null default 0,
  pote numeric not null default 0,
  result_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table if not exists public.x1_sala_participantes (
  sala_id uuid not null references public.x1_salas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'convidado' check (status in ('convidado','dentro','saiu','recusou')),
  convidado_por uuid,
  entrou_em timestamptz,
  total numeric,
  posicao int,
  premio numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (sala_id, user_id)
);
create index if not exists x1_salas_data_idx on public.x1_salas (scheduled_date, status);
create index if not exists x1_sala_part_user_idx on public.x1_sala_participantes (user_id, status);

alter table public.x1_salas enable row level security;
alter table public.x1_sala_participantes enable row level security;
-- leitura: qualquer logado (a sala é pública dentro da Vant, como a luta ao vivo); escrita só por RPC
drop policy if exists x1_salas_read on public.x1_salas;
create policy x1_salas_read on public.x1_salas for select to authenticated using (true);
drop policy if exists x1_sala_part_read on public.x1_sala_participantes;
create policy x1_sala_part_read on public.x1_sala_participantes for select to authenticated using (true);

-- ---------- 2) helpers ----------
create or replace function public.x1_sala_agora_brt() returns timestamp language sql stable set search_path to 'public' as
$$ select (now() at time zone 'America/Sao_Paulo') $$;

-- ---------- 3) criar sala ----------
create or replace function public.x1_sala_criar(p_nome text, p_stakes numeric, p_vagas int, p_convidados uuid[] default '{}')
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date; lim numeric; bal numeric; ver boolean; nid uuid; u uuid;
begin
  if me is null then raise exception 'sem login'; end if;
  if p_stakes < 0 then raise exception 'aposta inválida'; end if;
  if p_vagas < 2 or p_vagas > 8 then raise exception 'sala: de 2 a 8 lutadores'; end if;
  if extract(hour from public.x1_sala_agora_brt()) >= 18 then raise exception 'horario: sala só abre até 18h. Amanhã cedo você abre outra.'; end if;
  if (select count(*) from public.x1_sala_participantes p join public.x1_salas s on s.id = p.sala_id
      where p.user_id = me and p.status = 'dentro' and s.scheduled_date = hoje and s.status = 'open') >= 3 then
    raise exception 'limite: você já está em 3 salas hoje.'; end if;
  if p_stakes > 0 then
    select coalesce(verificado,false) into ver from public.profiles where user_id = me;
    if not coalesce(ver,false) then raise exception 'verificado: pra apostar dinheiro você precisa conectar onde recebe.'; end if;
    select aposta_max into lim from public.x1_recorde(me);
    if p_stakes > lim then raise exception 'patente: sua patente libera aposta até R$ %.', lim; end if;
    select coalesce(balance,0) into bal from public.x1_wallets where user_id = me;
    if coalesce(bal,0) < p_stakes then raise exception 'saldo_insuficiente: você tem R$ % e a aposta é R$ %.', coalesce(bal,0), p_stakes; end if;
  end if;
  insert into public.x1_salas (dono, nome, scheduled_date, stakes_amount, vagas)
  values (me, coalesce(nullif(left(trim(p_nome),40),''),'Sala de competição'), hoje, p_stakes, p_vagas) returning id into nid;
  -- dono entra na hora, aposta travada
  if p_stakes > 0 then perform public.x1_wallet_apply(me, -p_stakes, 'aposta', null, 'Aposta na sala ' || nid::text, me); end if;
  insert into public.x1_sala_participantes (sala_id, user_id, status, entrou_em) values (nid, me, 'dentro', now());
  foreach u in array coalesce(p_convidados, '{}') loop
    if u <> me then
      insert into public.x1_sala_participantes (sala_id, user_id, status, convidado_por) values (nid, u, 'convidado', me) on conflict do nothing;
    end if;
  end loop;
  return nid;
end $$;

-- ---------- 4) convidar mais gente (qualquer um que já está dentro pode chamar) ----------
create or replace function public.x1_sala_convidar(p_id uuid, p_convidados uuid[])
returns int language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.x1_salas; u uuid; n int := 0;
begin
  select * into s from public.x1_salas where id = p_id;
  if not found or s.status <> 'open' then raise exception 'sala fechada'; end if;
  if not exists (select 1 from public.x1_sala_participantes where sala_id = p_id and user_id = me and status = 'dentro') then raise exception 'só quem está na sala convida'; end if;
  foreach u in array coalesce(p_convidados, '{}') loop
    if u <> me then
      insert into public.x1_sala_participantes (sala_id, user_id, status, convidado_por) values (p_id, u, 'convidado', me)
      on conflict (sala_id, user_id) do update set status = 'convidado', convidado_por = me where x1_sala_participantes.status in ('recusou','saiu');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------- 5) entrar (convidado ou pelo link) ----------
create or replace function public.x1_sala_entrar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.x1_salas; hoje date := (now() at time zone 'America/Sao_Paulo')::date; dentro int; bal numeric; ver boolean; lim numeric;
begin
  if me is null then raise exception 'sem login'; end if;
  select * into s from public.x1_salas where id = p_id for update;
  if not found or s.status <> 'open' then raise exception 'sala fechada'; end if;
  if s.scheduled_date <> hoje then raise exception 'essa sala era de outro dia'; end if;
  if extract(hour from public.x1_sala_agora_brt()) >= 18 then raise exception 'horario: entrada só até 18h.'; end if;
  if exists (select 1 from public.x1_sala_participantes where sala_id = p_id and user_id = me and status = 'dentro') then return; end if;
  select count(*) into dentro from public.x1_sala_participantes where sala_id = p_id and status = 'dentro';
  if dentro >= s.vagas then raise exception 'sala cheia'; end if;
  if (select count(*) from public.x1_sala_participantes p join public.x1_salas x on x.id = p.sala_id
      where p.user_id = me and p.status = 'dentro' and x.scheduled_date = hoje and x.status = 'open') >= 3 then
    raise exception 'limite: você já está em 3 salas hoje.'; end if;
  if s.stakes_amount > 0 then
    select coalesce(verificado,false) into ver from public.profiles where user_id = me;
    if not coalesce(ver,false) then raise exception 'verificado: pra apostar dinheiro você precisa conectar onde recebe.'; end if;
    select aposta_max into lim from public.x1_recorde(me);
    if s.stakes_amount > lim then raise exception 'patente: sua patente libera aposta até R$ %.', lim; end if;
    select coalesce(balance,0) into bal from public.x1_wallets where user_id = me;
    if coalesce(bal,0) < s.stakes_amount then raise exception 'saldo_insuficiente: você tem R$ % e a aposta é R$ %.', coalesce(bal,0), s.stakes_amount; end if;
    perform public.x1_wallet_apply(me, -s.stakes_amount, 'aposta', null, 'Aposta na sala ' || p_id::text, me);
  end if;
  insert into public.x1_sala_participantes (sala_id, user_id, status, entrou_em) values (p_id, me, 'dentro', now())
  on conflict (sala_id, user_id) do update set status = 'dentro', entrou_em = now();
end $$;

-- ---------- 6) sair / recusar ----------
create or replace function public.x1_sala_sair(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.x1_salas; p public.x1_sala_participantes;
begin
  select * into s from public.x1_salas where id = p_id for update;
  if not found then raise exception 'sala não existe'; end if;
  select * into p from public.x1_sala_participantes where sala_id = p_id and user_id = me;
  if not found then return; end if;
  if p.status = 'convidado' then update public.x1_sala_participantes set status = 'recusou' where sala_id = p_id and user_id = me; return; end if;
  if p.status <> 'dentro' then return; end if;
  if s.status <> 'open' then raise exception 'sala já fechou'; end if;
  if extract(hour from public.x1_sala_agora_brt()) >= 12 then raise exception 'travado: depois do meio-dia ninguém sai da sala. Agora é vender.'; end if;
  if s.stakes_amount > 0 then perform public.x1_wallet_apply(me, s.stakes_amount, 'devolucao', null, 'Saiu da sala ' || p_id::text, me); end if;
  update public.x1_sala_participantes set status = 'saiu' where sala_id = p_id and user_id = me;
  -- dono saiu e ficou vazia → cancela
  if not exists (select 1 from public.x1_sala_participantes where sala_id = p_id and status = 'dentro') then
    update public.x1_salas set status = 'cancelled', result_notes = 'Todo mundo saiu' where id = p_id;
  end if;
end $$;

-- ---------- 7) leitura: sala + placar ----------
create or replace function public.x1_sala(p_id uuid)
returns table (id uuid, dono uuid, nome text, scheduled_date date, stakes_amount numeric, vagas int, status text, pote numeric, fee_amount numeric, result_notes text, created_at timestamptz,
               user_id uuid, p_status text, p_nome text, p_avatar text, p_patente text, p_total numeric, p_posicao int, p_premio numeric, convidado_por uuid)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.dono, s.nome, s.scheduled_date, s.stakes_amount, s.vagas, s.status, s.pote, s.fee_amount, s.result_notes, s.created_at,
         p.user_id, p.status, coalesce(pp.nickname,'Vendedor'), pp.avatar_url, r.patente,
         case when s.status = 'open' then coalesce((select sum(cs.total_sold) from public.challenge_sessions cs where cs.user_id = p.user_id and cs.date = s.scheduled_date),0)::numeric else coalesce(p.total,0) end,
         p.posicao, p.premio, p.convidado_por
  from public.x1_salas s
  join public.x1_sala_participantes p on p.sala_id = s.id
  left join public.public_profiles pp on pp.user_id = p.user_id
  cross join lateral public.x1_recorde(p.user_id) r
  where s.id = p_id and auth.uid() is not null;
$$;

-- golpes (vendas do DEFCON) de todos na sala, pro feed do placar
create or replace function public.x1_sala_golpes(p_id uuid)
returns table (user_id uuid, amount numeric, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select d.user_id, d.amount, d.created_at
  from public.x1_salas s
  join public.x1_sala_participantes p on p.sala_id = s.id and p.status = 'dentro'
  join public.defcon_sales d on d.user_id = p.user_id and (d.created_at at time zone 'America/Sao_Paulo')::date = s.scheduled_date
  where s.id = p_id and auth.uid() is not null
  order by d.created_at desc limit 12;
$$;

-- salas de hoje: convites primeiro, depois as que estou dentro, depois abertas pra entrar
create or replace function public.x1_salas_hoje()
returns table (id uuid, dono uuid, nome text, stakes_amount numeric, vagas int, status text, created_at timestamptz, dentro int, meu_status text, convidado_por_nome text, dono_nome text, dono_avatar text, lider_id uuid, lider_nome text, lider_total numeric, minha_posicao int, meu_total numeric, rostos jsonb)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select s.*, (select p.status from public.x1_sala_participantes p where p.sala_id = s.id and p.user_id = auth.uid()) meu
    from public.x1_salas s cross join hoje
    where auth.uid() is not null and s.scheduled_date = hoje.d and s.status = 'open'
  ),
  placar as (
    select b.id sala_id, p.user_id, coalesce(pp.nickname,'Vendedor') nome, pp.avatar_url,
           coalesce((select sum(cs.total_sold) from public.challenge_sessions cs where cs.user_id = p.user_id and cs.date = b.scheduled_date),0)::numeric total
    from base b join public.x1_sala_participantes p on p.sala_id = b.id and p.status = 'dentro'
    left join public.public_profiles pp on pp.user_id = p.user_id
  ),
  rk as (select *, rank() over (partition by sala_id order by total desc) pos from placar)
  select b.id, b.dono, b.nome, b.stakes_amount, b.vagas, b.status, b.created_at,
         (select count(*)::int from rk where rk.sala_id = b.id),
         b.meu,
         (select coalesce(pc.nickname,'alguém') from public.x1_sala_participantes p left join public.public_profiles pc on pc.user_id = p.convidado_por where p.sala_id = b.id and p.user_id = auth.uid()),
         coalesce(pd.nickname,'Vendedor'), pd.avatar_url,
         l.user_id, l.nome, l.total,
         (select rk.pos::int from rk where rk.sala_id = b.id and rk.user_id = auth.uid()),
         (select rk.total from rk where rk.sala_id = b.id and rk.user_id = auth.uid()),
         coalesce((select jsonb_agg(jsonb_build_object('nome', x.nome, 'avatar', x.avatar_url) order by x.pos) from (select * from rk where rk.sala_id = b.id order by pos limit 4) x), '[]'::jsonb)
  from base b
  left join public.public_profiles pd on pd.user_id = b.dono
  left join lateral (select rk.user_id, rk.nome, rk.total from rk where rk.sala_id = b.id order by rk.pos limit 1) l on true
  order by case when b.meu = 'convidado' then 0 when b.meu = 'dentro' then 1 else 2 end, b.created_at desc
  limit 20;
$$;

-- ---------- 8) liquidação (roda dentro do x1_settle_due) ----------
create or replace function public.x1_sala_settle_due()
returns int language plpgsql security definer set search_path to 'public' as $$
declare s record; hoje date := (now() at time zone 'America/Sao_Paulo')::date; n int := 0; dentro int; v_pote numeric; v_taxa numeric; liquido numeric;
        parte1 numeric; parte2 numeric; emp1 int; emp2 int; r record;
begin
  for s in select * from public.x1_salas where status = 'open' and scheduled_date < hoje for update skip locked loop
    select count(*) into dentro from public.x1_sala_participantes where sala_id = s.id and status = 'dentro';
    if dentro < 2 then
      if s.stakes_amount > 0 then
        for r in select user_id from public.x1_sala_participantes where sala_id = s.id and status = 'dentro' loop
          perform public.x1_wallet_apply(r.user_id, s.stakes_amount, 'devolucao', null, 'Sala não fechou (menos de 2) ' || s.id::text, null);
        end loop;
      end if;
      update public.x1_salas set status = 'cancelled', result_notes = 'Menos de 2 lutadores', reviewed_at = now() where id = s.id;
      n := n + 1; continue;
    end if;
    -- totais e colocação (empate = mesma posição)
    update public.x1_sala_participantes p set total = coalesce((select sum(cs.total_sold) from public.challenge_sessions cs where cs.user_id = p.user_id and cs.date = s.scheduled_date),0)
    where p.sala_id = s.id and p.status = 'dentro';
    update public.x1_sala_participantes p set posicao = q.pos from (
      select x.user_id, rank() over (order by x.total desc) pos from public.x1_sala_participantes x where x.sala_id = s.id and x.status = 'dentro') q
    where p.sala_id = s.id and p.user_id = q.user_id;
    v_pote := s.stakes_amount * dentro; v_taxa := round(v_pote * 0.10, 2); liquido := v_pote - v_taxa;
    if liquido > 0 then
      select count(*) into emp1 from public.x1_sala_participantes where sala_id = s.id and status = 'dentro' and posicao = 1;
      select count(*) into emp2 from public.x1_sala_participantes where sala_id = s.id and status = 'dentro' and posicao = 2;
      -- 2 lutadores (ou empate geral no topo): quem está em 1º divide tudo. 3+: 70/30.
      if dentro = 2 or emp2 = 0 then parte1 := liquido; parte2 := 0; else parte1 := round(liquido * 0.70, 2); parte2 := liquido - parte1; end if;
      for r in select user_id, posicao from public.x1_sala_participantes where sala_id = s.id and status = 'dentro' and posicao <= 2 loop
        if r.posicao = 1 then
          update public.x1_sala_participantes set premio = round(parte1 / emp1, 2) where sala_id = s.id and user_id = r.user_id;
          perform public.x1_wallet_apply(r.user_id, round(parte1 / emp1, 2), 'premio', null, 'Prêmio da sala (1º) ' || s.id::text, null);
        elsif parte2 > 0 then
          update public.x1_sala_participantes set premio = round(parte2 / emp2, 2) where sala_id = s.id and user_id = r.user_id;
          perform public.x1_wallet_apply(r.user_id, round(parte2 / emp2, 2), 'premio', null, 'Prêmio da sala (2º) ' || s.id::text, null);
        end if;
      end loop;
    end if;
    update public.x1_salas set status = 'finished', pote = v_pote, fee_amount = v_taxa, result_notes = 'Liquidada pelo DEFCON', reviewed_at = now() where id = s.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- x1_settle_due passa a liquidar as salas também (mesmo cron das 0h05 BRT)
create or replace function public.x1_settle_due()
returns table(x1_id uuid, resultado text)
language plpgsql security definer set search_path to 'public' as $$
declare
  c record; tot_ch numeric; tot_op numeric; med_ch numeric; med_op numeric;
  suspeito boolean; vencedor uuid; pote numeric; taxa numeric; premio numeric; hoje date; nsalas int;
begin
  if auth.uid() is not null and not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  hoje := (now() at time zone 'America/Sao_Paulo')::date;
  update public.x1_challenges set status = 'expired' where status in ('pending','open') and expires_at is not null and expires_at < now();
  for c in
    select * from public.x1_challenges
    where status = 'active' and scheduled_date is not null and scheduled_date < hoje
    for update skip locked
  loop
    select coalesce(sum(total_sold),0) into tot_ch from public.challenge_sessions where user_id = c.challenger_id and date = c.scheduled_date;
    select coalesce(sum(total_sold),0) into tot_op from public.challenge_sessions where user_id = c.opponent_id  and date = c.scheduled_date;
    if c.stakes_amount > 0 then
      select coalesce(avg(total_sold),0) into med_ch from public.challenge_sessions where user_id = c.challenger_id and date between c.scheduled_date - 30 and c.scheduled_date - 1 and total_sold > 0;
      select coalesce(avg(total_sold),0) into med_op from public.challenge_sessions where user_id = c.opponent_id  and date between c.scheduled_date - 30 and c.scheduled_date - 1 and total_sold > 0;
      suspeito := (tot_ch = 0 or tot_op = 0) or (med_ch > 0 and tot_ch > med_ch * 3) or (med_op > 0 and tot_op > med_op * 3);
      if suspeito then
        update public.x1_challenges set status = 'awaiting_result', challenger_score = tot_ch, opponent_score = tot_op,
          result_notes = 'REVISÃO: DEFCON fora do padrão (ch ' || tot_ch || ' média ' || round(med_ch) || ' | op ' || tot_op || ' média ' || round(med_op) || ')'
        where id = c.id;
        x1_id := c.id; resultado := 'em_revisao'; return next; continue;
      end if;
    end if;
    if tot_ch = tot_op then
      if c.stakes_amount > 0 then
        perform public.x1_wallet_apply(c.challenger_id, c.stakes_amount, 'devolucao', c.id, 'Empate no X1', null);
        perform public.x1_wallet_apply(c.opponent_id,  c.stakes_amount, 'devolucao', c.id, 'Empate no X1', null);
      end if;
      update public.x1_challenges set status = 'finished', winner_user_id = null, challenger_score = tot_ch, opponent_score = tot_op,
        money_status = case when stakes_amount > 0 then 'refunded' else money_status end,
        result_notes = 'Empate pelo DEFCON', reviewed_at = now() where id = c.id;
      x1_id := c.id; resultado := 'empate'; return next; continue;
    end if;
    vencedor := case when tot_ch > tot_op then c.challenger_id else c.opponent_id end;
    if c.stakes_amount > 0 then
      pote := c.stakes_amount * 2; taxa := round(pote * 0.10, 2); premio := pote - taxa;
      perform public.x1_wallet_apply(vencedor, premio, 'premio', c.id, 'Prêmio do X1 (pote − 10%)', null);
    end if;
    update public.x1_challenges set status = 'finished', winner_user_id = vencedor, challenger_score = tot_ch, opponent_score = tot_op,
      prize_amount = case when stakes_amount > 0 then premio else prize_amount end,
      fee_amount = case when stakes_amount > 0 then taxa else fee_amount end,
      money_status = case when stakes_amount > 0 then 'prize_released' else money_status end,
      result_notes = 'Liquidado pelo DEFCON', reviewed_at = now() where id = c.id;
    x1_id := c.id; resultado := 'vencedor:' || vencedor::text; return next;
  end loop;
  nsalas := public.x1_sala_settle_due();
  if nsalas > 0 then x1_id := null; resultado := 'salas:' || nsalas::text; return next; end if;
end $$;

-- ---------- 9) vários X1 ao mesmo tempo: x1_lutar sem a trava de "1 luta por dia" ----------
create or replace function public.x1_lutar(p_opponent uuid, p_stakes numeric default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date; lim numeric; bal numeric; fee numeric; prize numeric;
  existente record; na_arena boolean; nid uuid; st text; eu_ver boolean; ele_ver boolean; ativas int;
begin
  if me is null then raise exception 'sem login'; end if;
  if p_opponent is null or p_opponent = me then raise exception 'oponente inválido'; end if;
  if p_stakes < 0 then raise exception 'aposta inválida'; end if;
  if p_stakes > 0 then
    select coalesce(verificado,false) into eu_ver from public.profiles where user_id = me;
    if not eu_ver then raise exception 'verificado: pra apostar dinheiro você precisa conectar onde recebe. É o que prova que a venda é real.'; end if;
    select coalesce(verificado,false) into ele_ver from public.profiles where user_id = p_opponent;
    if not ele_ver then raise exception 'verificado: esse vendedor ainda não conectou a conta dele. Chame ele na honra.'; end if;
  end if;
  select aposta_max into lim from public.x1_recorde(me);
  if p_stakes > lim then raise exception 'patente: sua patente libera aposta até R$ %. Vença mais duelos pra subir.', lim; end if;
  if p_stakes > 0 then
    select coalesce(balance,0) into bal from public.x1_wallets where user_id = me;
    if coalesce(bal,0) < p_stakes then raise exception 'saldo_insuficiente: você tem R$ % na carteira e a aposta é R$ %.', coalesce(bal,0), p_stakes; end if;
  end if;
  select id, status into existente from public.x1_challenges
   where scheduled_date = hoje and status in ('pending','active')
     and ((challenger_id = me and opponent_id = p_opponent) or (challenger_id = p_opponent and opponent_id = me)) limit 1;
  if existente.id is not null then return jsonb_build_object('id', existente.id, 'status', existente.status, 'ja_existia', true); end if;
  -- vários X1 ao mesmo tempo (Mohamed, 02/10): até 3 lutas ativas por dia
  select count(*) into ativas from public.x1_challenges where scheduled_date = hoje and status = 'active' and (challenger_id = me or opponent_id = me);
  if ativas >= 3 then raise exception 'limite: você já tem 3 lutas rolando hoje. Fecha essas primeiro.'; end if;
  na_arena := public.x1_na_arena(p_opponent);
  fee := case when p_stakes > 0 then round(p_stakes * 2 * 0.10, 2) else 0 end;
  prize := case when p_stakes > 0 then p_stakes * 2 - fee else 0 end;
  st := case when p_stakes = 0 and na_arena then 'active' else 'pending' end;
  insert into public.x1_challenges (challenger_id, opponent_id, status, scheduled_date, stakes_amount, fee_amount, prize_amount, modo, last_proposed_by, tipo, expires_at, money_status, created_by)
  values (me, p_opponent, st, hoje, p_stakes, fee, prize, 'Quem fatura mais no dia', me, 'direto',
          least(now() + interval '24 hours', (hoje::timestamp at time zone 'America/Sao_Paulo') + interval '23 hours'),
          case when p_stakes > 0 then 'awaiting_payment' else 'none' end, me)
  returning id into nid;
  return jsonb_build_object('id', nid, 'status', st, 'ja_existia', false);
end $$;

-- ---------- 10) permissões ----------
revoke all on function public.x1_sala_settle_due() from public, anon, authenticated;
revoke all on function public.x1_sala_agora_brt() from public, anon;
revoke all on function public.x1_sala_criar(text, numeric, int, uuid[]) from public, anon;
revoke all on function public.x1_sala_convidar(uuid, uuid[]) from public, anon;
revoke all on function public.x1_sala_entrar(uuid) from public, anon;
revoke all on function public.x1_sala_sair(uuid) from public, anon;
revoke all on function public.x1_sala(uuid) from public, anon;
revoke all on function public.x1_sala_golpes(uuid) from public, anon;
revoke all on function public.x1_salas_hoje() from public, anon;
grant execute on function public.x1_sala_agora_brt() to authenticated;
grant execute on function public.x1_sala_criar(text, numeric, int, uuid[]) to authenticated;
grant execute on function public.x1_sala_convidar(uuid, uuid[]) to authenticated;
grant execute on function public.x1_sala_entrar(uuid) to authenticated;
grant execute on function public.x1_sala_sair(uuid) to authenticated;
grant execute on function public.x1_sala(uuid) to authenticated;
grant execute on function public.x1_sala_golpes(uuid) to authenticated;
grant execute on function public.x1_salas_hoje() to authenticated;
