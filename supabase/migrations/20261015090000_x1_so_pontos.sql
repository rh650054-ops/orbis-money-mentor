-- X1 points-only (Rick, 14/10/2026): no money enters or moves through new X1 duels.
--
-- NOT APPLIED AUTOMATICALLY. Apply by hand, in this order (see PR description):
--   1. deploy edge functions mp-criar-deposito and verificar-deposito (blocked versions)
--   2. apply this file
--   3. merge the frontend
--
-- What it does
--   * x1_challenges / x1_salas: new rows cannot carry a stake, fee or prize; a stake
--     can never go up; a legacy paid duel can no longer be accepted/activated;
--     nobody duels themselves; the winner must be a participant; once a duel is
--     finished, only an admin can change result, scores or status.
--   * Drops the client INSERT policy on x1_challenges (all creation goes through
--     the SECURITY DEFINER RPCs, which the triggers above also cover).
--   * Wallet: no new bets ('aposta'); users can no longer deposit or withdraw by
--     themselves. Legacy settlements ('premio'/'devolucao' from the cron or an
--     admin), admin moves and mp-webhook reconciliation of payments created
--     before this migration keep working.
--   * x1_deposit_requests / x1_withdraw_requests / x1_mp_payments: no new rows
--     except by an admin (admin path for old obligations).
--   * Revokes the user-only legacy money RPCs (mark paid, set proof, withdraw).
--
-- What it does NOT do
--   * Delete or change any table, balance, receipt, request or history row.
--   * Convert money into points. Points stay the existing x1_recorde rule
--     (win 10, mission 2, correct cheer 1; loss/draw/cancel/expire 0), computed on
--     the server from finished duels, never stored, bought or transferred, and
--     independent of the general ranking (leaderboard_stats).

-- ---------------------------------------------------------------- helpers
create or replace function public.x1_usuario_comum()
returns boolean language sql stable security definer set search_path = public as $$
  -- a logged-in user who is not an admin (cron/service role have no auth.uid())
  select auth.uid() is not null and not coalesce(public.is_orbis_admin(), false);
$$;
revoke all on function public.x1_usuario_comum() from public, anon;

-- ---------------------------------------------------------------- duels
create or replace function public.x1_so_pontos_duelo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opponent_id is not null and new.opponent_id = new.challenger_id then
    raise exception 'x1_proprio: ninguém duela consigo mesmo';
  end if;
  if new.winner_user_id is not null
     and new.winner_user_id is distinct from new.challenger_id
     and new.winner_user_id is distinct from new.opponent_id then
    raise exception 'x1_vencedor_invalido: vencedor tem que ser um dos lutadores';
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.stakes_amount, 0) > 0 or coalesce(new.fee_amount, 0) > 0 or coalesce(new.prize_amount, 0) > 0 then
      raise exception 'x1_so_pontos: o X1 agora vale só pontos';
    end if;
    return new;
  end if;

  -- UPDATE
  if coalesce(new.stakes_amount, 0) > coalesce(old.stakes_amount, 0) then
    raise exception 'x1_so_pontos: o X1 agora vale só pontos';
  end if;
  if coalesce(old.stakes_amount, 0) = 0
     and (coalesce(new.fee_amount, 0) > 0 or coalesce(new.prize_amount, 0) > 0) then
    raise exception 'x1_so_pontos: o X1 agora vale só pontos';
  end if;
  if coalesce(old.stakes_amount, 0) > 0
     and new.status in ('accepted', 'active')
     and old.status is distinct from new.status
     and old.status not in ('accepted', 'active') then
    raise exception 'x1_so_pontos: duelo valendo dinheiro não pode mais começar';
  end if;
  if old.status = 'finished'
     and (new.status is distinct from old.status
          or new.winner_user_id is distinct from old.winner_user_id
          or new.challenger_score is distinct from old.challenger_score
          or new.opponent_score is distinct from old.opponent_score)
     and not coalesce(public.is_orbis_admin(), false) then
    raise exception 'x1_resultado_fechado: resultado já foi dado';
  end if;
  return new;
end; $$;

drop trigger if exists trg_x1_so_pontos on public.x1_challenges;
create trigger trg_x1_so_pontos before insert or update on public.x1_challenges
  for each row execute function public.x1_so_pontos_duelo();

-- ---------------------------------------------------------------- rooms
create or replace function public.x1_so_pontos_sala()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.stakes_amount, 0) > 0 or coalesce(new.fee_amount, 0) > 0 or coalesce(new.pote, 0) > 0 then
      raise exception 'x1_so_pontos: o X1 agora vale só pontos';
    end if;
  elsif coalesce(new.stakes_amount, 0) > coalesce(old.stakes_amount, 0) then
    raise exception 'x1_so_pontos: o X1 agora vale só pontos';
  end if;
  return new;
end; $$;

drop trigger if exists trg_x1_so_pontos_sala on public.x1_salas;
create trigger trg_x1_so_pontos_sala before insert or update on public.x1_salas
  for each row execute function public.x1_so_pontos_sala();

-- ---------------------------------------------------------------- wallet
create or replace function public.x1_so_pontos_carteira()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'aposta' then
    raise exception 'x1_so_pontos: o X1 não aceita mais aposta';
  end if;
  if new.tipo in ('deposito', 'saque') and public.x1_usuario_comum() then
    raise exception 'x1_so_pontos: carteira do X1 encerrada; saldo antigo é resolvido pelo suporte';
  end if;
  return new;
end; $$;

drop trigger if exists trg_x1_so_pontos_carteira on public.x1_wallet_transactions;
create trigger trg_x1_so_pontos_carteira before insert on public.x1_wallet_transactions
  for each row execute function public.x1_so_pontos_carteira();

create or replace function public.x1_so_pontos_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- deposit requests, withdraw requests and Mercado Pago charges: only an admin
  -- can still create one (to settle an old obligation by hand)
  if not coalesce(public.is_orbis_admin(), false) then
    raise exception 'x1_so_pontos: carteira do X1 encerrada; saldo antigo é resolvido pelo suporte';
  end if;
  return new;
end; $$;

drop trigger if exists trg_x1_so_pontos_deposito on public.x1_deposit_requests;
create trigger trg_x1_so_pontos_deposito before insert on public.x1_deposit_requests
  for each row execute function public.x1_so_pontos_pedido();
drop trigger if exists trg_x1_so_pontos_saque on public.x1_withdraw_requests;
create trigger trg_x1_so_pontos_saque before insert on public.x1_withdraw_requests
  for each row execute function public.x1_so_pontos_pedido();
drop trigger if exists trg_x1_so_pontos_mp on public.x1_mp_payments;
create trigger trg_x1_so_pontos_mp before insert on public.x1_mp_payments
  for each row execute function public.x1_so_pontos_pedido();

revoke all on function public.x1_so_pontos_duelo(), public.x1_so_pontos_sala(),
  public.x1_so_pontos_carteira(), public.x1_so_pontos_pedido() from public, anon, authenticated;

-- ---------------------------------------------------------------- access
-- Creation only through the RPCs (x1_lutar, x1_criar, x1_sala_criar): no direct insert.
drop policy if exists "x1 insert as challenger" on public.x1_challenges;

-- Legacy user-side money RPCs. Admin RPCs (x1_admin_*, x1_tesouraria) stay for
-- old obligations; they check is_orbis_admin() themselves.
revoke execute on function public.x1_mark_paid(uuid) from public, anon, authenticated;
revoke execute on function public.x1_set_proof(uuid, text) from public, anon, authenticated;
revoke execute on function public.x1_request_withdraw(numeric, text, text) from public, anon, authenticated;
