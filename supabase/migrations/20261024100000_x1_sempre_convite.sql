-- ============================================================
-- X1: toda luta nova é CONVITE (Rick, 24/10/2026)
-- Antes: amistoso contra quem estava "na arena" (pista ligada ou DEFCON aberto) entrava
-- direto como 'active', sem a pessoa aceitar. Rick abriu 3 lutas sem querer e não tinha
-- como desfazer. Agora sempre nasce 'pending'; o outro vê "VOCÊ FOI DESAFIADO" e aceita
-- ou recusa (x1_negotiate), e quem desafiou pode cancelar enquanto espera (x1_cancel).
-- Só muda a linha do status; o resto da função é igual.
-- ============================================================
create or replace function public.x1_lutar(p_opponent uuid, p_stakes numeric default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  lim numeric; bal numeric; fee numeric; prize numeric; existente record; nid uuid; st text;
  eu_ver boolean; ele_ver boolean; ativas int;
begin
  if me is null then raise exception 'sem login'; end if;
  if p_opponent is null or p_opponent = me then raise exception 'oponente inválido'; end if;
  if p_stakes < 0 then raise exception 'aposta inválida'; end if;
  if p_stakes > 0 then
    select coalesce(verificado,false) into eu_ver from public.profiles where user_id = me;
    if not coalesce(eu_ver,false) then raise exception 'verificado: pra apostar dinheiro você precisa conectar onde recebe. É o que prova que a venda é real.'; end if;
    select coalesce(verificado,false) into ele_ver from public.profiles where user_id = p_opponent;
    if not coalesce(ele_ver,false) then raise exception 'verificado: esse vendedor ainda não conectou a conta dele. Chame ele na honra.'; end if;
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
  if existente.id is not null then
    return jsonb_build_object('id', existente.id, 'status', existente.status, 'ja_existia', true);
  end if;
  -- vários X1 ao mesmo tempo (Mohamed, 02/10): até 3 lutas ativas por dia
  select count(*) into ativas from public.x1_challenges
   where scheduled_date = hoje and status = 'active' and (challenger_id = me or opponent_id = me);
  if ativas >= 3 then raise exception 'limite: você já tem 3 lutas rolando hoje. Fecha essas primeiro.'; end if;
  fee := case when p_stakes > 0 then round(p_stakes * 2 * 0.10, 2) else 0 end;
  prize := case when p_stakes > 0 then p_stakes * 2 - fee else 0 end;
  st := 'pending';   -- 24/10: sempre convite (antes: amistoso + "na arena" = 'active' direto)
  insert into public.x1_challenges (challenger_id, opponent_id, status, scheduled_date, stakes_amount, fee_amount,
    prize_amount, modo, last_proposed_by, tipo, expires_at, money_status, created_by)
  values (me, p_opponent, st, hoje, p_stakes, fee, prize, 'Quem fatura mais no dia', me, 'direto',
    least(now() + interval '24 hours', (hoje::timestamp at time zone 'America/Sao_Paulo') + interval '23 hours'),
    case when p_stakes > 0 then 'awaiting_payment' else 'none' end, me)
  returning id into nid;
  return jsonb_build_object('id', nid, 'status', st, 'ja_existia', false);
end $function$;
