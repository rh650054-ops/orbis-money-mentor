-- ============================================================
-- GUARDADO conta a CONTA DE RESERVA (Rick, 03/10/2026): quem marcou um banco
-- como Reserva (ex.: Santander) vê o saldo dele em "Guardado", junto das
-- caixinhas/CDB/poupança lidas do banco. Pra "seu número" não contar duas
-- vezes, o saldo dessa conta sai de saldo_contas.
-- Mesma função de 20261002230000_cartao_dividas_guardado.sql + o CTE `res`.
-- ============================================================
create or replace function public.financas_painel()
returns jsonb language sql stable set search_path to 'public' as $function$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  con as (select id from public.bank_connections where user_id = (select uid from eu) and coalesce(status,'') <> 'deleted'),
  reserva_con as (select id from public.bank_connections where user_id = (select uid from eu) and coalesce(status,'') <> 'deleted' and papel = 'reserva'),
  cart as (select * from public.bank_cartoes where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  parc as (select * from public.bank_parcelas where user_id = (select uid from eu) and parcela_atual < parcelas_total),
  emp as (select * from public.bank_emprestimos where user_id = (select uid from eu) and bank_connection_id in (select id from con)
               and coalesce(saldo_devedor, 0) > 0),
  inv as (select * from public.bank_investimentos where user_id = (select uid from eu) and bank_connection_id in (select id from con) and coalesce(saldo,0) > 0),
  sal as (select * from public.bank_saldos where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  res as (select * from sal where bank_connection_id in (select id from reserva_con) and coalesce(saldo, 0) > 0),
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
    'tem_investimento', exists (select 1 from inv) or exists (select 1 from res),
    'investimentos', coalesce((select jsonb_agg(x order by (x->>'saldo')::numeric desc) from (
                 select jsonb_build_object('banco', banco, 'nome', nome, 'tipo', tipo, 'saldo', saldo) x from inv
                 union all
                 select jsonb_build_object('banco', banco, 'nome', 'Conta de reserva', 'tipo', 'CONTA_RESERVA', 'saldo', saldo) from res
               ) t), '[]'::jsonb),
    'reserva', coalesce((select sum(saldo) from res), 0),
    'guardado', coalesce((select sum(saldo) from inv), 0) + coalesce((select sum(saldo) from res), 0),
    'saldo_contas', coalesce((select sum(saldo) from sal where bank_connection_id not in (select bank_connection_id from res)), 0),
    'dividas', coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0))) from emp), 0)
               + coalesce((select sum(fatura) from cart where fatura > 0), 0)
               + coalesce((select sum(valor_parcela * (parcelas_total - parcela_atual)) from parc), 0)
               + (select usado from especial),
    'dia_de_rua', round(coalesce((select media from rua), 0), 2),
    'leitura', (select max(atualizado_em) from (select atualizado_em from cart union all select atualizado_em from emp union all select atualizado_em from inv union all select atualizado_em from res) x)
  );
$function$;
