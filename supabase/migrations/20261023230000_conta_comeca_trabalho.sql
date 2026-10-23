-- ============================================================
-- Contas do banco: começa como TRABALHO e virar Trabalho é sempre livre (Rick, 23/10/2026)
--
-- 1) Banco ligado de agora em diante já nasce com papel 'trabalho' (papel_auto = true:
--    foi a Vant que escolheu, não o vendedor). Contas antigas sem papel ficam como estão.
-- 2) Trava de 7 dias só vale pra virar PESSOAL (o lado que esconde venda do ranking).
--    Virar TRABALHO é livre a qualquer hora. Casos: Gustavo e João (marcaram Pessoal
--    sem querer e ficaram dias sem o Pix contar; desligar e religar o banco burlava a trava).
-- 3) Enquanto o papel é o automático, a sugestão da Vant pelo histórico continua aparecendo
--    se ela discordar ("A Vant acha que é pessoal").
-- 4) Virou Trabalho nos 3 primeiros dias da conta ligada: vale desde a ligação (igual à
--    1ª escolha de antes). Depois disso: só daqui pra frente (sem mudança).
-- Nada é apagado.
-- ============================================================

alter table public.bank_connections add column if not exists papel_auto boolean not null default false;

-- 1) papel inicial
create or replace function public.bank_connections_papel_inicial()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.papel is null then
    new.papel := 'trabalho';
    new.papel_desde := coalesce(new.created_at, now());
    new.papel_trocado_em := null;
    new.papel_auto := true;
  end if;
  return new;
end $$;
drop trigger if exists trg_bank_connections_papel_inicial on public.bank_connections;
create trigger trg_bank_connections_papel_inicial before insert on public.bank_connections
  for each row execute function public.bank_connections_papel_inicial();

-- 2) trocar papel: trava só pra Pessoal
create or replace function public.open_finance_definir_papel(p_conexao uuid, p_papel text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.bank_connections; primeira boolean; uso text;
begin
  if p_papel not in ('trabalho', 'pessoal') then raise exception 'papel inválido'; end if;
  select * into c from public.bank_connections
   where id = p_conexao and user_id = auth.uid() and coalesce(status, '') <> 'deleted' for update;
  if not found then raise exception 'conta não encontrada'; end if;
  if c.papel = p_papel then
    if c.papel_auto then  -- confirmou o automático: vira escolha dele
      perform set_config('vant.papel_ok', '1', true);
      update public.bank_connections set papel_auto = false where id = c.id;
    end if;
    return jsonb_build_object('ok', true, 'papel', p_papel);
  end if;

  -- 1ª escolha de verdade = sem papel ou com o papel automático
  primeira := c.papel is null or c.papel_auto;

  -- trava: só pra virar PESSOAL, 1 vez a cada 7 dias (depois da 1ª escolha)
  if p_papel = 'pessoal' and not primeira
     and c.papel_trocado_em is not null and c.papel_trocado_em > now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'erro', 'trava',
      'liberada_em', c.papel_trocado_em + interval '7 days');
  end if;

  perform set_config('vant.papel_ok', '1', true);
  update public.bank_connections set
    papel = p_papel,
    papel_auto = false,
    papel_desde = case
      when c.created_at > now() - interval '3 days' and (primeira or p_papel = 'trabalho') then c.created_at
      else now() end,
    -- marca a hora só quando VIRA PESSOAL (é o que a trava conta)
    papel_trocado_em = case when p_papel = 'pessoal' and not primeira then now() else c.papel_trocado_em end
   where id = c.id;

  uso := case when p_papel = 'trabalho' then 'vendas' else 'pessoal' end;
  if c.institution_name is not null then
    insert into public.extrato_contas (user_id, banco, uso, auto)
    values (c.user_id, c.institution_name, uso, false)
    on conflict (user_id, banco) do update set uso = excluded.uso, auto = false, atualizado_em = now();
    update public.extrato_lancamentos l
       set esfera = case when uso = 'vendas' or l.categoria = 'cartao_recebido' then 'corre' else 'pessoal' end
     where l.user_id = c.user_id and l.banco = c.institution_name and l.tipo = 'entrada'
       and coalesce(l.movimento, 'normal') = 'normal' and l.confianca <> 'usuario';
  end if;

  return jsonb_build_object('ok', true, 'papel', p_papel, 'primeira', primeira);
end $$;

-- 3) lista das contas: + papel_auto; "pode_trocar" = pode virar Pessoal agora
drop function if exists public.open_finance_contas();
create function public.open_finance_contas()
returns table(id uuid, banco text, logo text, papel text, saldo numeric, sugestao text, motivo text,
              entradas_30d integer, pode_trocar boolean, troca_liberada_em timestamptz, conta_venda boolean,
              papel_auto boolean)
language sql stable security definer set search_path to 'public' as $$
  with cs as (
    select bc.* from public.bank_connections bc
     where bc.user_id = auth.uid() and coalesce(bc.status, '') <> 'deleted'
  ), n as (select count(*) total from cs)
  select cs.id, cs.institution_name, cs.institution_logo, cs.papel,
         (select sum(s.saldo) from public.bank_saldos s where s.bank_connection_id = cs.id),
         sg->>'sugestao', sg->>'motivo', coalesce((sg->>'entradas_30d')::int, 0),
         cs.papel is null or cs.papel_auto or cs.papel = 'pessoal'
           or cs.papel_trocado_em is null or cs.papel_trocado_em <= now() - interval '7 days',
         case when cs.papel = 'trabalho' and not cs.papel_auto
                   and cs.papel_trocado_em > now() - interval '7 days'
              then cs.papel_trocado_em + interval '7 days' end,
         cs.papel = 'trabalho' or (cs.papel is null and (select total from n) = 1),
         cs.papel_auto
    from cs, lateral (select public.open_finance_sugestao(cs.id) sg) s
   order by cs.created_at;
$$;
revoke all on function public.open_finance_contas() from public, anon;
grant execute on function public.open_finance_contas() to authenticated, service_role;
