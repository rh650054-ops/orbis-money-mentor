-- A normal day, one bank, nothing wrong. Dia de Vendas, reconciliation and ranking must agree.
-- Also: legitimate entries with the same amount are all kept, and cash stays out of the ranking.
begin;
select t.vendedor('Vendedora Um') as u \gset
select t.conexao(:'u', 'Nubank', t.hora(10, '09:00')) as c \gset
select t.foco(:'u', 1, '08:00', '17:00', 72, 30);                    -- tapped R$ 72 in Pix + R$ 30 in cash
select t.pix(:'c', t.hora(1, '09:00'), 12, 'ANA LIMA COSTA');
select t.pix(:'c', t.hora(1, '09:05'), 12, 'BRUNO REIS ALVES');      -- same amount, another customer
select t.pix(:'c', t.hora(1, '10:00'), 12, 'CARLA DIAS MOTA');
select t.pix(:'c', t.hora(1, '10:00'), 12, 'DANIEL NUNES PIRES');    -- same amount, same minute
select t.pix(:'c', t.hora(1, '11:30'), 12, 'ANA LIMA COSTA');        -- the first customer came back
commit;

select t.igual('Dia de Vendas: 5 Pix de R$ 12 somam R$ 60 (iguais não se fundem)', t.caiu(:'u', 1), 60);
select t.igual('reconciliação refaz 1 dia', public.banco_reconciliar(:'u')::numeric, 1);
select t.igual('Pix do dia vira o que caiu no banco', (select pix_sales from public.daily_sales where user_id = :'u'), 60);
select t.igual('calote = lançado em Pix (72) − caiu (60)', (select total_debt from public.daily_sales where user_id = :'u'), 12);
select t.igual('total do dia = dinheiro (30) + Pix que caiu (60)', (select total_profit from public.daily_sales where user_id = :'u'), 90);
select t.igual('ranking do dia = só o banco, sem os R$ 30 em dinheiro',
               (select valor from public.ranking_valor_dias(t.dia(1), t.dia(1), :'u')), 60);
select t.verdade('ranking marca o dia como conferido pelo banco',
               (select pelo_banco from public.ranking_valor_dias(t.dia(1), t.dia(1), :'u')));
select t.igual('rodar a reconciliação de novo não muda nada (idempotente)', public.banco_reconciliar(:'u')::numeric, 0);
