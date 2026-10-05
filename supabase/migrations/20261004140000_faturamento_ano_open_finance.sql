-- ============================================================
-- 04/10/2026 (Mohamed): "com os dados do Open Finance você consegue ver meu
-- verdadeiro faturamento anual pra atualizar a aba Tributário? mantendo o
-- dinheiro que eu mandei na planilha antiga".
--
-- faturamento_ano(p_ano): mês a mês do ano,
--   • dinheiro  = o que ele lançou em dinheiro vivo (daily_sales.cash_sales,
--                 inclui a planilha antiga). Banco nenhum vê dinheiro vivo.
--   • digital   = o MAIOR entre o Pix/cartão que ele lançou e o que entrou nas
--                 contas de TRABALHO (extrato_contas.uso = 'vendas', que segue o
--                 papel escolhido no Vender), sem transferência entre contas
--                 dele e sem estorno. O maior porque, pro teto do MEI, errar
--                 pra baixo é o erro perigoso (e um banco ainda sem histórico
--                 não pode puxar o mês pra baixo).
--   • fonte     = 'banco' quando o banco viu mais, 'lancado' quando o lançado
--                 é maior ou o banco não tem o mês.
--
-- bank_connections.historico_lido_em: o Piloto Automático lê 12 meses de
-- histórico UMA vez por banco (o Open Finance entrega até 12 meses). Os bancos
-- já ligados ainda não leram: na próxima rodada leem.
-- ============================================================

alter table public.bank_connections add column if not exists historico_lido_em timestamptz;

create or replace function public.faturamento_ano(p_ano int default null)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with eu as (select auth.uid() as uid),
  par as (
    select coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::int) as ano,
           (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  meses as (
    select gs::date as mes
      from par, generate_series(make_date(par.ano, 1, 1),
                                least(make_date(par.ano, 12, 1), date_trunc('month', par.hoje)::date),
                                interval '1 month') gs
  ),
  lanc as (
    select date_trunc('month', s.date::date)::date as mes,
           sum(coalesce(s.cash_sales, 0)) as dinheiro,
           sum(coalesce(s.pix_sales, 0) + coalesce(s.card_sales, 0)) as digital
      from public.daily_sales s, par
     where s.user_id = (select uid from eu)
       and s.date::date >= make_date(par.ano, 1, 1) and s.date::date < make_date(par.ano + 1, 1, 1)
     group by 1
  ),
  vendas as (select banco from public.extrato_contas where user_id = (select uid from eu) and uso = 'vendas'),
  banco as (
    select date_trunc('month', l.data)::date as mes, sum(l.valor) as valor
      from public.extrato_lancamentos l, par
     where l.user_id = (select uid from eu) and l.tipo = 'entrada' and l.movimento = 'normal'
       and l.categoria <> 'estorno' and l.banco in (select banco from vendas)
       and l.data >= make_date(par.ano, 1, 1) and l.data < make_date(par.ano + 1, 1, 1)
     group by 1
  ),
  linhas as (
    select m.mes,
           coalesce(la.dinheiro, 0) as dinheiro,
           coalesce(la.digital, 0) as lancado,
           coalesce(b.valor, 0) as banco,
           greatest(coalesce(la.digital, 0), coalesce(b.valor, 0)) as digital,
           case when coalesce(b.valor, 0) > coalesce(la.digital, 0) then 'banco' else 'lancado' end as fonte
      from meses m left join lanc la on la.mes = m.mes left join banco b on b.mes = m.mes
  )
  select jsonb_build_object(
    'ano', (select ano from par),
    'total', coalesce((select sum(dinheiro + digital) from linhas), 0),
    'dinheiro', coalesce((select sum(dinheiro) from linhas), 0),
    'digital', coalesce((select sum(digital) from linhas), 0),
    'lancado_total', coalesce((select sum(dinheiro + lancado) from linhas), 0),
    'meses_banco', (select count(*) from linhas where fonte = 'banco'),
    'contas_venda', coalesce((select jsonb_agg(banco order by banco) from vendas), '[]'::jsonb),
    'meses', coalesce((select jsonb_agg(jsonb_build_object(
                 'mes', mes, 'dinheiro', dinheiro, 'lancado', lancado, 'banco', banco,
                 'digital', digital, 'total', dinheiro + digital, 'fonte', fonte) order by mes) from linhas), '[]'::jsonb)
  );
$function$;

revoke all on function public.faturamento_ano(int) from public, anon;
grant execute on function public.faturamento_ano(int) to authenticated;
