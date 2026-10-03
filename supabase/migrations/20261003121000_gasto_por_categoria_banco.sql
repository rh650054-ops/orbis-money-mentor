-- ============================================================
-- CADA GASTO DO BANCO NUMA CATEGORIA — 03/10/2026
-- Rick (10h16): "o saldo tá certo mas os gastos não, preciso que cada gasto entre em uma categoria".
-- O que estava errado (corrigido no _shared/pluggy-piloto.ts):
--   • toda SAÍDA virava "Entre minhas contas": o Piloto comparava o CPF de quem PAGOU
--     (o próprio vendedor) em vez do CPF de quem RECEBEU.
--   • "Débito de Cartão" vem da Pluggy sem nome da loja: agora vai pra "Compras no débito".
--   • compras no CARTÃO DE CRÉDITO não entravam (só a conta corrente era lida).
-- Aqui:
--   • categoria nova compras_debito;
--   • extrato_lancamentos.do_cartao (compra lida da conta de cartão de crédito);
--   • extrato_base: se o mês já tem as compras do cartão, o pagamento da fatura não conta
--     de novo (mesma regra de quem manda o PDF do cartão).
-- ============================================================
insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem)
values ('compras_debito', 'Compras no débito', '🛍️', 'pessoal', 'saida', 60)
on conflict (slug) do nothing;

alter table public.extrato_lancamentos add column if not exists do_cartao boolean not null default false;

create or replace function public.extrato_base(p_ini date, p_fim date)
returns table(id uuid, data date, hora time without time zone, descricao text, comerciante text, chave text, valor numeric, tipo text, categoria text, esfera text, confianca text, banco text, movimento text, par_id uuid, recorrente boolean, origem text, conta boolean)
language sql stable set search_path to 'public' as $$
  select l.id, l.data, l.hora, l.descricao, l.comerciante, l.chave, l.valor, l.tipo, l.categoria, l.esfera,
         l.confianca, l.banco, l.movimento, l.par_id, l.recorrente, l.origem,
         (l.movimento = 'normal' or (l.movimento = 'fatura'
            and not exists (
              select 1 from public.extrato_arquivos a
               where a.user_id = l.user_id and a.documento = 'cartao' and a.mes = date_trunc('month', l.data)::date
                 and (a.banco is not distinct from l.banco
                      or (a.banco is not null and l.descricao_norm like '%' || public.extrato_norm(a.banco) || '%')))
            and not exists (
              select 1 from public.extrato_lancamentos c
               where c.user_id = l.user_id and c.do_cartao
                 and c.data >= date_trunc('month', l.data)::date - 31 and c.data < date_trunc('month', l.data)::date + 31))) as conta
    from public.extrato_lancamentos l
   where l.user_id = auth.uid() and l.data >= p_ini and l.data < p_fim
$$;
