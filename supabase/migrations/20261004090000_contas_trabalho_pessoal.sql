-- ============================================================
-- CONTA DE TRABALHO × PESSOAL + RESERVA NA CAIXINHA — 04/10/2026 (Mohamed)
-- "Coloquei 2 bancos que uso pra comprar mercadoria e vender; o resto são
-- bancos pessoais que não devem contar nas vendas."
--
-- 1) Papel da conta: só 'trabalho' ou 'pessoal'. A RESERVA deixa de ser uma
--    conta inteira: é uma CAIXINHA (investimento lido do banco) que o vendedor
--    marca. Quem tinha conta marcada como 'reserva' (Rick: Santander) vira 'pessoal'.
--    Obs.: o Open Finance não manda o nome que a pessoa deu pra caixinha
--    ("CDB - ITAU UNIBANCO S.A."), então ela escolhe pelo banco e pelo valor.
-- 2) VENDA SÓ DE CONTA DE TRABALHO: banco_pix_por_dia (régua única do DEFCON,
--    do relatório e do ranking) passa a contar só Pix que caiu em conta de
--    trabalho — e só a partir de quando ela virou trabalho (papel_desde).
--    Conta sem papel: conta como trabalho apenas se for a ÚNICA conta ligada;
--    com 2+ contas, a sem papel não conta até o vendedor escolher.
-- 3) TRAVA: o papel só muda pela função open_finance_definir_papel (o app não
--    consegue mais gravar direto) e, depois da 1ª escolha, só 1 troca a cada
--    7 dias. Virar "trabalho" depois da 1ª escolha não puxa Pix do passado.
-- 4) SUGESTÃO pelo histórico do banco (open_finance_contas): 10+ entradas em
--    30 dias, 3+ por dia e valor típico até R$ 80 = cara de conta de vendas;
--    o resto = pessoal. É só sugestão: quem decide é o vendedor.
-- 5) Raio-X segue o papel: trabalho → entradas "do corre"; pessoal → "pessoal".
-- 6) financas_home: saldo separado em trabalho e pessoal.
-- 7) Caixinhas: bank_investimentos.reserva + open_finance_caixinhas /
--    open_finance_marcar_reserva; financas_painel conta a reserva pelas caixinhas.
-- Idempotente. Nada é apagado.
-- ============================================================

-- ---------- 1) colunas e papel 'pessoal' ----------
alter table public.bank_connections add column if not exists papel_desde timestamptz;
alter table public.bank_connections add column if not exists papel_trocado_em timestamptz;
alter table public.bank_connections drop constraint if exists bank_connections_papel_chk;
update public.bank_connections set papel = 'pessoal' where papel = 'reserva';
alter table public.bank_connections add constraint bank_connections_papel_chk
  check (papel is null or papel in ('trabalho', 'pessoal'));

-- quem já tinha papel: vale desde que a conta foi ligada (não muda nada no passado)
update public.bank_connections set papel_desde = created_at
 where papel is not null and papel_desde is null;

-- ---------- 3) trava: papel só muda pela função ----------
create or replace function public.bank_connections_papel_guarda()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.papel is distinct from old.papel
     and coalesce(current_setting('vant.papel_ok', true), '') <> '1'
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'papel: use open_finance_definir_papel';
  end if;
  return new;
end $$;
drop trigger if exists trg_bank_connections_papel_guarda on public.bank_connections;
create trigger trg_bank_connections_papel_guarda before update on public.bank_connections
  for each row execute function public.bank_connections_papel_guarda();

-- ---------- 4) sugestão pelo histórico (últimos 30 dias de entradas) ----------
create or replace function public.open_finance_sugestao(p_conexao uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  -- Conta de vendas recebe MUITAS entradas pequenas no mesmo dia (cliente pagando
  -- batidinha). Conta pessoal recebe poucas, espalhadas e maiores.
  -- Regra: 10+ entradas em 30 dias, 3+ por dia em que entrou algo, valor típico até R$ 80.
  with c as (select id, user_id, institution_name from public.bank_connections where id = p_conexao),
  e as (  -- Pix lido pelo Open Finance
    select count(*)::int n,
           count(distinct (coalesce(a.transacted_at, a.created_at) at time zone 'America/Sao_Paulo')::date)::int dias,
           coalesce(percentile_cont(0.5) within group (order by a.amount), 0)::numeric med
      from public.auto_detected_sales a, c
     where a.bank_connection_id = c.id and not coalesce(a.own_transfer, false)
       and coalesce(a.transacted_at, a.created_at) > now() - interval '30 days'
  ),
  x as (  -- extrato do mesmo banco (Piloto Automático ou PDF antigo)
    select count(*)::int n, count(distinct l.data)::int dias,
           coalesce(percentile_cont(0.5) within group (order by l.valor), 0)::numeric med
      from public.extrato_lancamentos l, c
     where l.user_id = c.user_id and l.banco = c.institution_name and l.tipo = 'entrada'
       and coalesce(l.movimento, 'normal') = 'normal' and l.categoria not in ('estorno', 'transferencia_propria')
       and l.data > current_date - 30
  ),
  m as (select case when e.n >= x.n then e.n else x.n end n,
               case when e.n >= x.n then e.dias else x.dias end dias,
               case when e.n >= x.n then e.med else x.med end med from e, x),
  r as (select m.*, (m.n >= 10 and m.n >= 3 * greatest(m.dias, 1) and m.med <= 80) as vendas from m)
  select jsonb_build_object(
    'sugestao', case when r.n = 0 then null when r.vendas then 'trabalho' else 'pessoal' end,
    'entradas_30d', r.n,
    'ticket_mediano', round(r.med, 2),
    'motivo', case
      when r.n = 0 then 'Ainda sem entradas lidas nessa conta.'
      when r.vendas then r.n || ' entradas em 30 dias, umas ' || round(r.n::numeric / greatest(r.dias, 1)) || ' por dia, valor típico R$ ' || round(r.med)::int || ': cara de conta de vendas.'
      else r.n || ' ' || case when r.n = 1 then 'entrada' else 'entradas' end || ' em 30 dias, valor típico R$ ' || round(r.med)::int || ': cara de conta pessoal.'
    end)
  from r;
$$;
revoke all on function public.open_finance_sugestao(uuid) from public, anon, authenticated;

-- lista pro app: cada conta com papel, saldo, sugestão e se pode trocar agora
create or replace function public.open_finance_contas()
returns table(id uuid, banco text, logo text, papel text, saldo numeric, sugestao text, motivo text,
              entradas_30d int, pode_trocar boolean, troca_liberada_em timestamptz, conta_venda boolean)
language sql stable security definer set search_path to 'public' as $$
  with cs as (
    select bc.* from public.bank_connections bc
     where bc.user_id = auth.uid() and coalesce(bc.status, '') <> 'deleted'
  ),
  n as (select count(*) total from cs)
  select cs.id, cs.institution_name, cs.institution_logo, cs.papel,
         (select sum(s.saldo) from public.bank_saldos s where s.bank_connection_id = cs.id),
         sg->>'sugestao', sg->>'motivo', coalesce((sg->>'entradas_30d')::int, 0),
         cs.papel is null or cs.papel_trocado_em is null or cs.papel_trocado_em <= now() - interval '7 days',
         case when cs.papel is not null and cs.papel_trocado_em > now() - interval '7 days'
              then cs.papel_trocado_em + interval '7 days' end,
         cs.papel = 'trabalho' or (cs.papel is null and (select total from n) = 1)
    from cs, lateral (select public.open_finance_sugestao(cs.id) sg) s
   order by cs.created_at;
$$;
revoke all on function public.open_finance_contas() from public, anon;
grant execute on function public.open_finance_contas() to authenticated;

-- ---------- 3) definir o papel (única porta) ----------
create or replace function public.open_finance_definir_papel(p_conexao uuid, p_papel text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.bank_connections; primeira boolean; uso text;
begin
  if p_papel not in ('trabalho', 'pessoal') then raise exception 'papel inválido'; end if;
  select * into c from public.bank_connections
   where id = p_conexao and user_id = auth.uid() and coalesce(status, '') <> 'deleted' for update;
  if not found then raise exception 'conta não encontrada'; end if;
  if c.papel = p_papel then return jsonb_build_object('ok', true, 'papel', p_papel); end if;

  primeira := c.papel is null;
  if not primeira and c.papel_trocado_em is not null and c.papel_trocado_em > now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'erro', 'trava',
      'liberada_em', c.papel_trocado_em + interval '7 days');
  end if;

  perform set_config('vant.papel_ok', '1', true);
  update public.bank_connections set
    papel = p_papel,
    -- 1ª escolha logo depois de ligar: vale desde a ligação. Troca depois: só daqui pra frente.
    papel_desde = case when primeira and c.created_at > now() - interval '3 days' then c.created_at else now() end,
    papel_trocado_em = case when primeira then null else now() end
   where id = c.id;

  -- Raio-X: entradas da conta de trabalho são "do corre"; da pessoal, "pessoal"
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
revoke all on function public.open_finance_definir_papel(uuid, text) from public, anon;
grant execute on function public.open_finance_definir_papel(uuid, text) to authenticated;

-- ---------- 2) régua do Pix: só conta de trabalho ----------
create or replace function public.banco_conta_de_venda(p_conexao uuid, p_quando timestamptz)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.bank_connections bc
     where bc.id = p_conexao and coalesce(bc.status, '') <> 'deleted'
       and (
         (bc.papel = 'trabalho' and (bc.papel_desde is null or p_quando is null or p_quando >= bc.papel_desde))
         or (bc.papel is null and (select count(*) from public.bank_connections o
                                    where o.user_id = bc.user_id and coalesce(o.status, '') <> 'deleted') = 1)
       ));
$$;
revoke all on function public.banco_conta_de_venda(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  base as (
    select a.*,
           coalesce(a.transacted_at,
             case when (a.created_at at time zone 'America/Sao_Paulo')::date <= a.transaction_date + 1 then a.created_at end) as quando
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
      -- 04/10: só Pix que caiu em CONTA DE TRABALHO (conta pessoal nunca é venda)
      and public.banco_conta_de_venda(a.bank_connection_id, coalesce(a.transacted_at, a.created_at))
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
      and not exists (
        select 1 from public.auto_detected_sales b
         where b.user_id = a.user_id
           and b.bank_connection_id is distinct from a.bank_connection_id
           and b.amount = a.amount and b.transaction_date = a.transaction_date
           and lower(coalesce(b.description, '')) = lower(coalesce(a.description, ''))
           and coalesce(b.status, 'pending') <> 'ignored'
           and public.banco_conta_de_venda(b.bank_connection_id, coalesce(b.transacted_at, b.created_at))
           and ((b.transacted_at is not null and a.transacted_at is null)
                or ((b.transacted_at is null) = (a.transacted_at is null) and b.transaction_id < a.transaction_id)))
  ),
  tx as (
    select x.amount, x.quando,
           coalesce(
             (select s.d from sess s
               where x.quando is not null and s.ini <= x.quando
                 and x.quando < (((s.d + 1)::timestamp + interval '6 hours') at time zone 'America/Sao_Paulo')
               order by s.ini desc limit 1),
             (x.quando at time zone 'America/Sao_Paulo')::date,
             x.transaction_date) as dia
    from base x
  )
  select t.dia, sum(t.amount)::numeric, count(*)::int, max(t.quando)
  from tx t
  where t.dia between p_de and p_ate
  group by t.dia;
$$;

-- ---------- 6) financas_home: saldo por papel ----------
create or replace function public.financas_home()
returns jsonb language sql stable set search_path to 'public' as $$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  mes as (select date_trunc('month', (select d from hoje))::date as ini,
                 (date_trunc('month', (select d from hoje)) + interval '1 month')::date as fim),
  conexoes as (
    select id, institution_name, papel from public.bank_connections
     where user_id = (select uid from eu) and coalesce(status, '') <> 'deleted'
  ),
  saldos as (
    select s.banco, s.saldo, s.atualizado_em, s.bank_connection_id,
           coalesce(c.papel, case when (select count(*) from conexoes) = 1 then 'trabalho' end) as papel
      from public.bank_saldos s join conexoes c on c.id = s.bank_connection_id
     where s.user_id = (select uid from eu) and s.saldo is not null
  ),
  fixas as (
    select coalesce(sum(b.amount), 0)::numeric as total
      from public.planned_bills b
     where b.user_id = (select uid from eu)
       and coalesce(b.recurring, false)
       and (b.duration_months is null or coalesce(b.cycles_paid, 0) < b.duration_months)
  ),
  base as (select * from public.extrato_base((select ini from mes), (select fim from mes)) where conta),
  contas as (
    select b.name, (b.amount - coalesce(b.saved_amount, 0))::numeric as falta,
           case when coalesce(b.recurring, false) then
             make_date(extract(year from (select d from hoje))::int, extract(month from (select d from hoje))::int,
               least(extract(day from b.due_date)::int,
                     extract(day from ((select fim from mes) - 1))::int))
           else b.due_date end as vence
      from public.planned_bills b
     where b.user_id = (select uid from eu)
       and b.due_date is not null
       and not coalesce(b.paid, false)
       and coalesce(b.paid_cycle, '') <> to_char((select d from hoje), 'YYYY-MM')
  ),
  tot as (
    select (select sum(saldo) from saldos) as saldo,
           (select total from fixas) as fixas,
           coalesce((select sum(valor) from base where tipo = 'entrada'), 0) as entrou,
           coalesce((select sum(valor) from base where tipo = 'saida'), 0) as saiu
  )
  select jsonb_build_object(
    'tem_banco', exists (select 1 from conexoes),
    'tem_saldo', exists (select 1 from saldos),
    'saldo', (select saldo from tot),
    'saldo_trabalho', (select sum(saldo) from saldos where papel = 'trabalho'),
    'saldo_pessoal', (select sum(saldo) from saldos where papel = 'pessoal'),
    'precisa_papel', (select count(*) from conexoes) >= 2 and exists (select 1 from conexoes where papel is null),
    'contas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'banco', c.institution_name, 'papel', c.papel,
                          'saldo', (select sum(s.saldo) from saldos s where s.bank_connection_id = c.id)) order by c.institution_name)
                          from conexoes c), '[]'::jsonb),
    'bancos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'saldo', s, 'papel', papel) order by s desc)
                          from (select banco, papel, sum(saldo) s from saldos group by banco, papel) x), '[]'::jsonb),
    'atualizado', (select max(atualizado_em) from saldos),
    'fixas_mes', (select fixas from tot),
    'folego_dias', case when (select fixas from tot) > 0 and coalesce((select saldo from tot), 0) > 0
                        then floor((select saldo from tot) / ((select fixas from tot) / 30.0))::int end,
    'entrou', (select entrou from tot),
    'saiu', (select saiu from tot),
    'sobrou', (select entrou - saiu from tot),
    'alerta', coalesce(
      case when (select saldo from tot) < 0 then jsonb_build_object('tipo', 'negativo') end,
      (select jsonb_build_object('tipo', 'vencida', 'nome', name, 'valor', falta, 'dia', vence)
         from contas where vence < (select d from hoje) and falta > 0 order by vence limit 1),
      (select jsonb_build_object('tipo', 'vence', 'nome', name, 'valor', falta, 'dia', vence,
                                 'sobra', coalesce((select saldo from tot), 0) - falta)
         from contas where vence between (select d from hoje) and (select d from hoje) + 7 and falta > 0
         order by vence limit 1)
    ),
    'causas', case when (select saldo from tot) < 0 then
      coalesce((select jsonb_agg(jsonb_build_object('descricao', descricao, 'categoria', categoria, 'valor', valor, 'data', data))
                  from (select descricao, categoria, valor, data from public.extrato_base((select d from hoje) - 7, (select d from hoje) + 1)
                         where conta and tipo = 'saida' order by valor desc limit 4) c), '[]'::jsonb) end,
    'piloto', jsonb_build_object(
      'lancamentos', (select count(*) from base where origem = 'pluggy' and tipo = 'saida'),
      'conferir', (select count(*) from base where origem = 'pluggy' and tipo = 'saida' and categoria = 'nao_identificado')
    )
  );
$$;


-- ---------- 7) RESERVA NA CAIXINHA ----------
alter table public.bank_investimentos add column if not exists reserva boolean not null default false;

-- caixinhas com saldo, de cada banco ligado, pra pessoa marcar qual é a reserva
create or replace function public.open_finance_caixinhas()
returns table(id text, banco text, nome text, tipo text, saldo numeric, reserva boolean, atualizado_em timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select i.pluggy_id, i.banco, i.nome, i.tipo, i.saldo, i.reserva, i.atualizado_em
    from public.bank_investimentos i
    join public.bank_connections bc on bc.id = i.bank_connection_id and coalesce(bc.status, '') <> 'deleted'
   where i.user_id = auth.uid() and (coalesce(i.saldo, 0) > 0 or i.reserva)
   order by i.banco, i.saldo desc;
$$;
revoke all on function public.open_finance_caixinhas() from public, anon;
grant execute on function public.open_finance_caixinhas() to authenticated;

create or replace function public.open_finance_marcar_reserva(p_id text, p_reserva boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  update public.bank_investimentos set reserva = coalesce(p_reserva, false)
   where pluggy_id = p_id and user_id = auth.uid();
  return found;
end $$;
revoke all on function public.open_finance_marcar_reserva(text, boolean) from public, anon;
grant execute on function public.open_finance_marcar_reserva(text, boolean) to authenticated;

-- Guardado: a reserva vem das caixinhas marcadas (não mais de uma conta inteira)
create or replace function public.financas_painel()
returns jsonb language sql stable set search_path to 'public' as $function$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  con as (select id from public.bank_connections where user_id = (select uid from eu) and coalesce(status,'') <> 'deleted'),
  cart as (select * from public.bank_cartoes where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  parc as (select * from public.bank_parcelas where user_id = (select uid from eu) and parcela_atual < parcelas_total),
  emp as (select * from public.bank_emprestimos where user_id = (select uid from eu) and bank_connection_id in (select id from con)
               and coalesce(saldo_devedor, 0) > 0),
  inv as (select * from public.bank_investimentos where user_id = (select uid from eu) and bank_connection_id in (select id from con) and coalesce(saldo,0) > 0),
  sal as (select * from public.bank_saldos where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  res as (select * from inv where reserva),
  meses as (
    select (date_trunc('month', (select d from hoje)) + make_interval(months => g))::date as mes,
           sum(p.valor_parcela) as valor
      from parc p, generate_series(1, 12) g
     where g <= p.parcelas_total - p.parcela_atual
     group by 1
  ),
  especial as (
    select coalesce(sum(greatest(coalesce(cheque_usado,0), case when saldo < 0 then -saldo else 0 end)),0) as usado from sal
  ),
  rua as (
    select avg(ds.total_profit)::numeric as media
      from public.daily_sales ds
     where ds.user_id = (select uid from eu) and ds.date::date >= (select d from hoje) - 30 and coalesce(ds.total_profit, 0) > 0
  ),
  juros as (
    select
      coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0)) * coalesce(taxa_mes,0)) from emp), 0) as emprestimo,
      (select usado from especial) * 0.08 as especial
  )
  select jsonb_build_object(
    'tem_cartao', exists (select 1 from cart),
    'cartoes', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', nome, 'fatura', fatura, 'limite', limite,
                 'disponivel', disponivel, 'vence', vence, 'fecha', fecha, 'minimo', minimo, 'atualizado', atualizado_em)
                 order by vence nulls last) from cart), '[]'::jsonb),
    'parcelas', coalesce((select jsonb_agg(jsonb_build_object('descricao', descricao, 'banco', banco, 'valor', valor_parcela,
                 'atual', parcela_atual, 'total', parcelas_total,
                 'ate', (date_trunc('month', (select d from hoje)) + make_interval(months => parcelas_total - parcela_atual))::date)
                 order by valor_parcela desc) from parc), '[]'::jsonb),
    'parcelas_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor) order by mes) from meses), '[]'::jsonb),
    'parcelas_mes', coalesce((select valor from meses order by mes limit 1), 0),
    'parcelas_total', coalesce((select sum(valor_parcela * (parcelas_total - parcela_atual)) from parc), 0),
    'tem_emprestimo', exists (select 1 from emp),
    'emprestimos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', nome, 'tipo', tipo,
                 'saldo_devedor', coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0)),
                 'parcela', parcela_valor, 'total', parcelas_total, 'pagas', parcelas_pagas, 'atrasadas', parcelas_atrasadas,
                 'taxa_mes', taxa_mes, 'vence', proximo_vencimento)
                 order by taxa_mes desc nulls last) from emp), '[]'::jsonb),
    'especial_usado', (select usado from especial),
    'especial_limite', coalesce((select sum(cheque_limite) from sal), 0),
    'juros_mes', jsonb_build_object('emprestimo', round((select emprestimo from juros), 2), 'especial', round((select especial from juros), 2)),
    'tem_investimento', exists (select 1 from inv),
    'investimentos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', case when reserva then 'Reserva' else nome end,
                 'tipo', tipo, 'saldo', saldo, 'reserva', reserva) order by reserva desc, saldo desc) from inv), '[]'::jsonb),
    'reserva', coalesce((select sum(saldo) from res), 0),
    'guardado', coalesce((select sum(saldo) from inv), 0),
    'saldo_contas', coalesce((select sum(saldo) from sal), 0),
    'dividas', coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0))) from emp), 0)
               + coalesce((select sum(fatura) from cart where fatura > 0), 0)
               + coalesce((select sum(valor_parcela * (parcelas_total - parcela_atual)) from parc), 0)
               + (select usado from especial),
    'dia_de_rua', round(coalesce((select media from rua), 0), 2),
    'leitura', (select max(atualizado_em) from (select atualizado_em from cart union all select atualizado_em from emp union all select atualizado_em from inv) x)
  );
$function$;
