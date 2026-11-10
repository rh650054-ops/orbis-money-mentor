-- Official rule: cash counts in the vendor's own revenue and never in the competitive ranking.
begin;
-- has a bank, day checked by it
select t.vendedor('Vendedora E') as e \gset
select t.conexao(:'e', 'Nubank', t.hora(10, '09:00')) as ce \gset
select t.foco(:'e', 1, '08:00', '17:00', 24, 100);
select t.pix(:'ce', t.hora(1, '09:00'), 24, 'LUCAS FARIA MELO');
-- no bank at all
select t.vendedor('Vendedor F', 12, false) as f \gset
select t.foco(:'f', 1, '08:00', '17:00', 24, 100);
commit;

select public.banco_reconciliar(:'e');
select t.igual('faturamento pessoal inclui o dinheiro (24 + 100)',
               (select total_profit from public.daily_sales where user_id = :'e'), 124);
select t.igual('com banco: ranking do dia = R$ 24, dinheiro fora',
               (select valor from public.ranking_valor_dias(t.dia(1), t.dia(1), :'e')), 24);
select t.pendente('F-14', 'sem banco: ranking do dia também fica sem o dinheiro (R$ 24)',
               (select valor from public.ranking_valor_dias(t.dia(1), t.dia(1), :'f')), 24);
