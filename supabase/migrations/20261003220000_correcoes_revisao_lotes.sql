-- ============================================================
-- Correções da revisão dos lotes 5 e 6 (03/10/2026)
--   • x1_cinturao_apos_duelo: só roda pelo gatilho/servidor (antes qualquer
--     logado podia chamar por RPC e somar defesas ou pegar cinturão vago) e
--     não processa o mesmo duelo duas vezes.
--   • x1_provocar: trava por luta+pessoa (2 cliques ao mesmo tempo não furam
--     o limite de 3).
--   • caixinha_sugestao: sequência sem pular dia vazio.
--   • caixinha_guardar: não mexe mais no alvo do card "Guardar hoje" das
--     Finanças (só caixinha + sequência).
-- Idempotente, sem comandos de apagar.
-- ============================================================

create or replace function public.x1_cinturao_apos_duelo(p_ch uuid, p_quando timestamptz default now())
returns void language plpgsql security definer set search_path to 'public' as $$
declare x record; perdedor uuid; ck_v text; ck_p text; dono uuid; cid text; uf_ text;
begin
  -- chamada direta por um usuário logado (RPC) não vale: só o gatilho ou o servidor
  if auth.uid() is not null and pg_trigger_depth() = 0 then raise exception 'não permitido'; end if;
  if exists (select 1 from public.x1_cinturao_historico where challenge_id = p_ch) then return; end if;
  select * into x from public.x1_challenges where id = p_ch;
  if x is null or x.status <> 'finished' or x.winner_user_id is null or x.opponent_id is null then return; end if;
  perdedor := case when x.winner_user_id = x.challenger_id then x.opponent_id else x.challenger_id end;
  ck_v := public.x1_cidade_chave(x.winner_user_id);
  ck_p := public.x1_cidade_chave(perdedor);
  if ck_v is null then return; end if;
  select user_id into dono from public.x1_cinturao where cidade_chave = ck_v;
  select city, state into cid, uf_ from public.profiles where user_id = x.winner_user_id;

  if dono is null then
    insert into public.x1_cinturao (cidade_chave, cidade, uf, user_id, desde, defesas)
    values (ck_v, trim(cid), upper(trim(coalesce(uf_, ''))), x.winner_user_id, p_quando, 0)
    on conflict (cidade_chave) do nothing;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, null, x.id, 'conquistou', p_quando);
  elsif dono = perdedor and ck_v = ck_p then
    update public.x1_cinturao set user_id = x.winner_user_id, desde = p_quando, defesas = 0 where cidade_chave = ck_v;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, perdedor, x.id, 'tomou', p_quando);
  elsif dono = x.winner_user_id and ck_v = ck_p then
    update public.x1_cinturao set defesas = defesas + 1 where cidade_chave = ck_v;
    insert into public.x1_cinturao_historico (cidade_chave, user_id, de_user_id, challenge_id, tipo, em)
    values (ck_v, x.winner_user_id, perdedor, x.id, 'defendeu', p_quando);
  end if;
end $$;

create or replace function public.x1_cinturao_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if pg_trigger_depth() = 0 then raise exception 'não permitido'; end if;
  if new.status = 'finished' and coalesce(old.status, '') <> 'finished' and new.winner_user_id is not null then
    perform public.x1_cinturao_apos_duelo(new.id, now());
  end if;
  return new;
end $$;

create or replace function public.x1_provocar(p_id uuid, p_frase text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); x record; n int; ult timestamptz;
begin
  if me is null then raise exception 'sem login'; end if;
  perform pg_advisory_xact_lock(hashtext(p_id::text || ':' || me::text));
  select * into x from public.x1_challenges where id = p_id;
  if x is null or (x.challenger_id <> me and x.opponent_id is distinct from me) then raise exception 'só quem luta provoca'; end if;
  if x.status <> 'active' then raise exception 'a luta não está rolando'; end if;
  select count(*), max(criado_em) into n, ult from public.x1_provocacoes where challenge_id = p_id and user_id = me;
  if n >= 3 then raise exception 'máximo de 3 provocações por luta'; end if;
  if ult is not null and ult > now() - interval '2 minutes' then raise exception 'espera 2 minutos pra provocar de novo'; end if;
  insert into public.x1_provocacoes (challenge_id, user_id, frase) values (p_id, me, p_frase);
end $$;

create or replace function public.caixinha_sugestao()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  g as (
    select f.*,
      coalesce(f.deadline,
        (f.created_at at time zone 'America/Sao_Paulo')::date
          + case f.prazo when 'curto' then 30 when 'longo' then 365 else 90 end) as alvo_data
    from public.financial_goals f
    where f.user_id = auth.uid() and coalesce(f.status, 'active') = 'active'
      and coalesce(f.current_amount, 0) < coalesce(f.target_amount, 0)
  ),
  escolhida as (select * from g order by (deadline is null), alvo_data, created_at limit 1),
  dias as (
    select d.data from public.financas_dias d
    where d.user_id = auth.uid() and coalesce(d.guardado, 0) > 0 and d.data <= (select d from hoje)
  ),
  -- a sequência termina hoje (se guardou hoje) ou ontem; conta só dias colados
  ancora as (select case when exists (select 1 from dias where data = (select d from hoje))
                         then (select d from hoje) else (select d from hoje) - 1 end a),
  seq as (
    select count(*)::int n from (
      select data, row_number() over (order by data desc) rn from dias where data <= (select a from ancora)
    ) t where t.data = (select a from ancora) - (t.rn - 1)::int
  )
  select case when auth.uid() is null or not exists (select 1 from escolhida) then null else (
    select jsonb_build_object(
      'goal_id', e.id, 'nome', e.name, 'icon', e.icon,
      'alvo', e.target_amount, 'tem', coalesce(e.current_amount, 0),
      'falta', greatest(0, e.target_amount - coalesce(e.current_amount, 0)),
      'data', e.alvo_data,
      'dias', greatest(1, e.alvo_data - (select d from hoje)),
      'por_dia', ceil(greatest(0, e.target_amount - coalesce(e.current_amount, 0))
                      / greatest(1, e.alvo_data - (select d from hoje))),
      'sequencia', (select n from seq),
      'guardado_hoje', coalesce((select guardado from public.financas_dias
                                  where user_id = auth.uid() and data = (select d from hoje)), 0)
    ) from escolhida e) end;
$$;

create or replace function public.caixinha_guardar(p_goal uuid, p_valor numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date; g record; novo numeric;
begin
  if me is null then raise exception 'sem login'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then raise exception 'valor inválido'; end if;
  select * into g from public.financial_goals where id = p_goal and user_id = me for update;
  if g is null then raise exception 'caixinha não encontrada'; end if;
  novo := coalesce(g.current_amount, 0) + p_valor;
  update public.financial_goals
     set current_amount = novo,
         status = case when novo >= g.target_amount then 'completed' else coalesce(status, 'active') end,
         updated_at = now()
   where id = p_goal;
  -- conta na sequência das Finanças (o alvo do dia continua sendo das Finanças)
  insert into public.financas_dias (user_id, data, guardado, updated_at)
  values (me, hoje, p_valor, now())
  on conflict (user_id, data) do update set guardado = coalesce(public.financas_dias.guardado, 0) + p_valor, updated_at = now();
  return jsonb_build_object('tem', novo, 'alvo', g.target_amount, 'concluida', novo >= g.target_amount, 'nome', g.name);
end $$;
