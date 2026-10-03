-- ============================================================
-- RASTREADOR DE GASTOS (Finanças) — 03/10/2026
-- Pedido do Rick: "rastreador dos gastos ali no financeiro, com base nos gastos do usuário".
--
-- Duas fontes somadas:
--   • 'banco'   → o que saiu da conta (Open Finance ou PDF), com a régua do Raio-X
--                 (extrato_base.conta), sem "entre minhas contas", estorno nem fatura.
--   • 'lancado' → o que o vendedor lançou nos "Custos do dia" (personal_expenses) e
--                 nas compras de mercadoria, MENOS o que o banco já mostra (mesmo valor,
--                 mesmo dia ou dia seguinte): fica o que foi pago em dinheiro ou em outra conta.
-- "Seu normal" de cada categoria = média dos últimos 3 meses fechados que tiveram gasto.
-- Ritmo: o normal até hoje = normal × (dia de hoje ÷ dias do mês).
-- Só lê dados do próprio vendedor (security invoker + auth.uid()).
-- ============================================================

create or replace function public.rastreador_gastos_mes(p_ini date)
returns table (data date, valor numeric, categoria text, descricao text, fonte text)
language sql stable security invoker set search_path to 'public' as $$
  with fim as (select (p_ini + interval '1 month')::date as d),
  banco as (
    select b.data, b.valor, b.categoria, coalesce(nullif(b.comerciante, ''), b.descricao) as descricao
      from public.extrato_base(p_ini, (select d from fim)) b
     where b.tipo = 'saida' and b.conta
       and b.categoria not in ('transferencia_propria', 'estorno', 'fatura_cartao')
  ),
  lancado as (
    select pe.date as data, pe.amount as valor,
           case lower(coalesce(pe.category, ''))
             when 'alimentação' then 'restaurante' when 'alimentacao' then 'restaurante' when 'food' then 'restaurante'
             when 'transporte' then 'onibus' when 'transport' then 'onibus'
             when 'mercadoria' then 'mercadoria' when 'merchandise' then 'mercadoria'
             else 'outros' end as categoria,
           coalesce(nullif(pe.name, ''), pe.category, 'Custo') as descricao
      from public.personal_expenses pe
     where pe.user_id = auth.uid() and pe.date >= p_ini and pe.date < (select d from fim) and coalesce(pe.amount, 0) > 0
    union all
    select cm.data, cm.total_pago, 'mercadoria', coalesce(nullif(cm.fornecedor, ''), 'Compra de mercadoria')
      from public.compras_mercadoria cm
     where cm.user_id = auth.uid() and cm.data >= p_ini and cm.data < (select d from fim) and coalesce(cm.total_pago, 0) > 0
  )
  select data, valor, categoria, descricao, 'banco' from banco
  union all
  -- o que foi lançado à mão e NÃO aparece no banco (dinheiro vivo, outra conta).
  -- Se o banco tem uma saída do mesmo valor no mesmo dia (ou no dia seguinte), é a mesma.
  select l.data, l.valor, l.categoria, l.descricao, 'lancado' from lancado l
   where not exists (select 1 from banco b
                      where abs(b.valor - l.valor) < 0.01 and b.data between l.data and l.data + 1);
$$;

create or replace function public.financas_rastreador()
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  with p as (
    select (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  q as (
    select hoje, date_trunc('month', hoje)::date as ini,
           extract(day from hoje)::int as dia,
           extract(day from (date_trunc('month', hoje) + interval '1 month - 1 day'))::int as dias
      from p
  ),
  rg as (
    select m.mes, x.*
      from q, generate_series(0, 3) g
      cross join lateral (select (q.ini - make_interval(months => g))::date as mes) m
      cross join lateral public.rastreador_gastos_mes(m.mes) x
  ),
  atual as (select * from rg where mes = (select ini from q)),
  meses_fechados as (select count(distinct mes) n from rg where mes < (select ini from q)),
  normal as (
    select categoria, sum(valor) / greatest((select n from meses_fechados), 1) as normal
      from rg where mes < (select ini from q) group by 1
  ),
  cat_atual as (select categoria, sum(valor) total, count(*) qtd from atual group by 1),
  junto as (
    select coalesce(a.categoria, n.categoria) categoria, coalesce(a.total, 0) total, coalesce(a.qtd, 0) qtd,
           round(coalesce(n.normal, 0), 2) normal,
           round(coalesce(n.normal, 0) * (select dia from q) / (select dias from q), 2) esperado
      from cat_atual a full outer join normal n on n.categoria = a.categoria
  ),
  cats as (
    select j.*, coalesce(c.rotulo, initcap(replace(j.categoria, '_', ' '))) rotulo, coalesce(c.icone, '📎') icone
      from junto j left join public.extrato_categorias c on c.slug = j.categoria
     where j.total > 0 or j.normal > 0
  ),
  -- conta fixa (assinatura, aluguel, parcela) cai de uma vez: só alerta se passou do MÊS inteiro.
  -- o resto (delivery, uber, lanche) alerta pelo ritmo: 30% e R$ 30 acima do normal pra essa altura.
  alerta as (
    select *, case when categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
                   then normal else esperado end as limite
      from cats
     where (categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
            and normal > 0 and total - normal >= 30 and total >= normal * 1.1)
        or (categoria not in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
            and esperado > 0 and total - esperado >= 30 and total >= esperado * 1.3)
     order by total - (case when categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
                            then normal else esperado end) desc limit 1
  ),
  ultimos as (
    select u.data, u.valor, u.descricao, coalesce(c.icone, '📎') icone
      from atual u left join public.extrato_categorias c on c.slug = u.categoria
     order by u.data desc, u.valor desc limit 4
  )
  select case
    when auth.uid() is null then null
    when not exists (select 1 from rg) then
      jsonb_build_object('tem_dados', false, 'mes', (select ini from q), 'dia', (select dia from q), 'dias_mes', (select dias from q))
    else jsonb_build_object(
      'tem_dados', true,
      'fonte', case when exists (select 1 from rg where fonte = 'banco') and exists (select 1 from rg where fonte = 'lancado') then 'misto'
                    when exists (select 1 from rg where fonte = 'banco') then 'banco' else 'lancado' end,
      'mes', (select ini from q), 'dia', (select dia from q), 'dias_mes', (select dias from q),
      'gasto', coalesce((select sum(valor) from atual), 0),
      'mes_passado_mesmo_dia', coalesce((select sum(valor) from rg
          where mes = ((select ini from q) - interval '1 month')::date and extract(day from data) <= (select dia from q)), 0),
      'normal_mes', round(coalesce((select sum(normal) from cats), 0), 2),
      'normal_ate_hoje', round(coalesce((select sum(normal) from cats), 0) * (select dia from q) / (select dias from q), 2),
      'projecao', case when (select dia from q) >= 5
                       then round(coalesce((select sum(valor) from atual), 0) / (select dia from q) * (select dias from q), 2) end,
      'semana', jsonb_build_object(
          'atual', coalesce((select sum(valor) from rg where data > (select hoje from q) - 7), 0),
          'anterior', coalesce((select sum(valor) from rg where data <= (select hoje from q) - 7 and data > (select hoje from q) - 14), 0)),
      'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'rotulo', rotulo, 'icone', icone,
                        'total', total, 'qtd', qtd, 'normal', normal, 'esperado', esperado) order by total desc, normal desc) from cats), '[]'::jsonb),
      'alerta', (select jsonb_build_object('categoria', categoria, 'rotulo', rotulo, 'icone', icone,
                        'total', total, 'esperado', limite, 'acima', total - limite,
                        'fixa', categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')) from alerta),
      'ultimos', coalesce((select jsonb_agg(jsonb_build_object('data', data, 'valor', valor, 'descricao', descricao, 'icone', icone)
                        order by data desc, valor desc) from ultimos), '[]'::jsonb))
  end;
$$;

grant execute on function public.rastreador_gastos_mes(date) to authenticated;
grant execute on function public.financas_rastreador() to authenticated;
