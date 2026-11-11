-- Weekly closing. Two verified vendors, banks healthy, no pending item.
-- F-07: with no pending item the result turns final by itself (hourly cron), nobody approves it.
-- F-17: any logged-in vendor can read the closing table, including other vendors' pending items.
begin;
select t.vendedor('Vendedora G') as g \gset
select t.conexao(:'g', 'Nubank', t.hora(20, '09:00')) as cg \gset
select t.foco(:'g', 2, '08:00', '17:00', 48);
select t.pix(:'cg', t.hora(2, '09:00'), 24, 'MARIO PAIVA LEAL');
select t.pix(:'cg', t.hora(2, '10:00'), 24, 'NINA CORREA DUTRA');
select t.vendedor('Vendedor H') as h \gset
select t.conexao(:'h', 'Inter', t.hora(20, '09:00')) as ch \gset
select t.foco(:'h', 2, '08:00', '17:00', 24);
select t.pix(:'ch', t.hora(2, '09:00'), 24, 'OLGA BASTOS REIS');
commit;

select public.premio_congelar('semana', t.dia(7), t.dia(1));
select t.igual('a apuração continua funcionando: 2 vendedores no resultado',
               (select count(*) from public.premio_fechamento where tipo = 'semana')::numeric, 2);
select t.igual('1º lugar = quem recebeu mais no banco (R$ 48)',
               (select valor from public.premio_fechamento where tipo = 'semana' and posicao = 1), 48);
select t.pendente('F-07', 'sem aprovação humana nada é homologado',
               (select count(*) from public.premio_fechamento where status = 'homologado')::numeric, 0);
select t.pendente('F-07', 'ninguém é marcado como ganhador sem aprovação humana',
               (select count(*) from public.premio_fechamento where leva_premio)::numeric, 0);
select t.pendente('F-17', 'vendedor comum não lê a tabela de fechamento direto (-1 = acesso negado)',
               t.linhas_como('authenticated', :'h', 'select pendencias from public.premio_fechamento')::numeric, -1);
select t.verdade('o app continua recebendo o resultado pela função premio_resultado',
               t.linhas_como('authenticated', :'h', format('select public.premio_resultado(''semana'', %L) r', t.dia(7))) = 1
               and (select public.premio_resultado('semana', t.dia(7)) ->> 'status') is not null);
