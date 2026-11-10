-- F-02 (audit 10/11/2026): the bank stopped updating (OUTDATED) in the morning, the vendor kept
-- selling, and the app still stamped "bank read". Today the missing Pix becomes calote.
begin;
select t.vendedor('Vendedor C') as c \gset
-- stale, yet stamped as read
select t.conexao(:'c', 'Cora', t.hora(5, '09:00'), 'OUTDATED', now()) as cc \gset
select t.foco(:'c', 1, '06:46', '17:10', 48);
select t.pix(:'cc', t.hora(1, '08:50'), 12, 'CLIENTE QUATRO ROCHA');                -- last entry before the bank froze

-- control: a healthy bank and a real calote. A fix must NOT hide this one.
select t.vendedor('Vendedora D') as d \gset
select t.conexao(:'d', 'Nubank', t.hora(5, '09:00'), 'UPDATED', now()) as cd \gset
select t.foco(:'d', 1, '06:46', '17:10', 48);
select t.pix(:'cd', t.hora(1, '08:50'), 12, 'CLIENTE CINCO PRADO');
commit;

select public.banco_reconciliar(:'c');
select public.banco_reconciliar(:'d');
select t.pendente('F-02', 'banco parado não cria calote', (select total_debt from public.daily_sales where user_id = :'c'), 0);
select t.pendente('F-02', 'dia com banco parado não é marcado como conferido pelo banco',
               (select pelo_banco::int from public.ranking_valor_dias(t.dia(1), t.dia(1), :'c'))::numeric, 0);
select t.pendente('F-02', 'ranking do dia com banco parado fica com o lançado (R$ 48)',
               (select valor from public.ranking_valor_dias(t.dia(1), t.dia(1), :'c')), 48);
select t.igual('controle: banco em dia e calote de verdade continuam aparecendo (R$ 36)',
               (select total_debt from public.daily_sales where user_id = :'d'), 36);
