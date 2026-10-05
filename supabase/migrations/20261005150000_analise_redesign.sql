-- ============================================================
-- FINANÇAS · ABA ANÁLISE (redesenho 05/10/2026, prompt do Mohamed + ajustes de UX)
-- Depende de 20261005110000_financas_tetos_mover_um.sql (rodar aquela antes).
--
-- 1) Ritmo pela CURVA real: "esperado até hoje" = quanto ele costuma ter gastado
--    até o MESMO DIA nos meses fechados (média dos 3). Antes era média ÷ dias,
--    o que fazia o vendedor parecer "abaixo" no dia 5 só porque o aluguel ainda
--    não tinha caído — e "acima" no dia 10, quando caía.
-- 2) Pessoal × negócio: mercadoria, gelo, DAS (esfera 'corre') saem do "gastos do
--    mês" e voltam num bloco próprio. Comprar estoque não é gastar demais.
-- 3) Navegar entre meses (p_mes); mês fechado compara o mês inteiro.
-- 4) Ações por transação: excluir da análise (fora_analise) e renomear (apelido).
-- 5) Fila "Para revisar": Pix pra pessoas e não identificados que ninguém confirmou.
-- ============================================================

alter table public.extrato_lancamentos add column if not exists fora_analise boolean not null default false;
alter table public.extrato_lancamentos add column if not exists apelido text;
alter table public.extrato_lancamentos drop constraint if exists extrato_lancamentos_apelido_tam;
alter table public.extrato_lancamentos add constraint extrato_lancamentos_apelido_tam check (apelido is null or char_length(apelido) <= 60);

drop function if exists public.financas_rastreador();
drop function if exists public.financas_rastreador(date);
drop function if exists public.rastreador_gastos_mes(date);

-- gastos do mês (banco + lançado à mão que não está no banco), agora com a esfera
create function public.rastreador_gastos_mes(p_ini date)
returns table (data date, valor numeric, categoria text, descricao text, fonte text, esfera text)
language sql stable security invoker set search_path to 'public' as $$
  with fim as (select (p_ini + interval '1 month')::date as d),
  banco as (
    select b.data, b.valor, b.categoria,
           coalesce(nullif(l.apelido, ''), nullif(b.comerciante, ''), b.descricao) as descricao,
           case when b.esfera = 'corre' then 'corre' else 'pessoal' end as esfera
      from public.extrato_base(p_ini, (select d from fim)) b
      join public.extrato_lancamentos l on l.id = b.id
     where b.tipo = 'saida' and b.conta and not l.fora_analise
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
  select data, valor, categoria, descricao, 'banco', esfera from banco
  union all
  select l.data, l.valor, l.categoria, l.descricao, 'lancado',
         coalesce((select c.esfera_padrao from public.extrato_categorias c where c.slug = l.categoria), 'pessoal')
    from lancado l
   where not exists (select 1 from banco b where abs(b.valor - l.valor) < 0.01 and b.data between l.data and l.data + 1);
$$;
grant execute on function public.rastreador_gastos_mes(date) to authenticated;

create function public.financas_rastreador(p_mes date default null)
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  with p as (select (now() at time zone 'America/Sao_Paulo')::date as hoje_real),
  q0 as (
    select hoje_real, least(coalesce(date_trunc('month', p_mes)::date, date_trunc('month', hoje_real)::date),
                            date_trunc('month', hoje_real)::date) as ini
      from p
  ),
  q as (
    select ini, ini = date_trunc('month', hoje_real)::date as corrente,
           extract(day from least(hoje_real, (ini + interval '1 month - 1 day')::date))::int as dia,
           extract(day from (ini + interval '1 month - 1 day'))::int as dias
      from q0
  ),
  rg as (
    select m.mes, x.*
      from q, generate_series(0, 3) g
      cross join lateral (select (q.ini - make_interval(months => g))::date as mes) m
      cross join lateral public.rastreador_gastos_mes(m.mes) x
  ),
  n as (select greatest(count(distinct mes), 1) n from rg where mes < (select ini from q)),
  pes as (select * from rg where esfera = 'pessoal'),
  atual as (select * from pes where mes = (select ini from q)),
  hist as (
    select categoria,
           sum(valor) / (select n from n) as historico,
           sum(valor) filter (where extract(day from data) <= (select dia from q)) / (select n from n) as hist_ate_hoje,
           sum(valor) filter (where mes = ((select ini from q) - interval '1 month')::date
                               and extract(day from data) <= (select dia from q)) as passado_mesmo_dia
      from pes where mes < (select ini from q) group by 1
  ),
  cat_atual as (select categoria, sum(valor) total, count(*) qtd from atual group by 1),
  tetos as (select categoria, valor from public.financas_tetos where user_id = auth.uid() and valor > 0),
  base_cat as (
    select coalesce(a.categoria, h.categoria) categoria, coalesce(a.total, 0) total, coalesce(a.qtd, 0) qtd,
           coalesce(h.historico, 0) historico, coalesce(h.hist_ate_hoje, 0) hist_ate_hoje,
           coalesce(h.passado_mesmo_dia, 0) passado_mesmo_dia
      from cat_atual a full outer join hist h on h.categoria = a.categoria
  ),
  -- o TETO que ele definiu manda; sem teto vale o histórico. O esperado segue a curva
  -- do histórico daquela categoria (conta fixa cai num dia só; delivery vai pingando).
  junto as (
    select coalesce(b.categoria, t.categoria) categoria, coalesce(b.total, 0) total, coalesce(b.qtd, 0) qtd,
           round(coalesce(t.valor, b.historico, 0), 2) normal,
           round(case when t.valor is null then coalesce(b.hist_ate_hoje, 0)
                      when coalesce(b.historico, 0) > 0 then t.valor * b.hist_ate_hoje / b.historico
                      else t.valor * (select dia from q) / (select dias from q) end, 2) esperado,
           t.valor is not null as tem_teto,
           round(coalesce(b.historico, 0), 2) historico,
           round(coalesce(b.passado_mesmo_dia, 0), 2) passado_mesmo_dia
      from base_cat b full outer join tetos t on t.categoria = b.categoria
  ),
  cats as (
    select j.*, coalesce(c.rotulo, initcap(replace(j.categoria, '_', ' '))) rotulo,
           j.categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos') as fixa
      from junto j left join public.extrato_categorias c on c.slug = j.categoria
     where j.total > 0 or (j.normal > 0 and coalesce(c.esfera_padrao, 'pessoal') <> 'corre')
  ),
  -- o que fugiu do normal. Pix pra pessoas / não identificado / outros não viram alerta:
  -- não dá pra dizer "você gastou demais" com o que a gente nem sabe o que é (vai pro Para revisar).
  alertas as (
    select *, case when fixa then normal else esperado end as limite
      from cats
     where categoria not in ('pix_pessoas', 'nao_identificado', 'outros')
       and ((fixa and normal > 0 and total - normal >= 30 and total >= normal * 1.1)
         or (not fixa and not tem_teto and esperado > 0 and total - esperado >= 30 and total >= esperado * 1.3)
         or (not fixa and tem_teto and (total > normal or (total - esperado >= 10 and total >= esperado * 1.15))))
     order by total - (case when fixa then normal else esperado end) desc limit 3
  ),
  neg as (select * from rg where esfera = 'corre'),
  neg_cat as (
    select x.categoria, coalesce(c.rotulo, initcap(replace(x.categoria, '_', ' '))) rotulo, sum(x.valor) total, count(*) qtd
      from neg x left join public.extrato_categorias c on c.slug = x.categoria
     where x.mes = (select ini from q) group by 1, 2
  )
  select case
    when auth.uid() is null then null
    when not exists (select 1 from rg) then
      jsonb_build_object('tem_dados', false, 'mes', (select ini from q), 'corrente', (select corrente from q),
                         'dia', (select dia from q), 'dias_mes', (select dias from q))
    else jsonb_build_object(
      'tem_dados', true,
      'fonte', case when exists (select 1 from rg where fonte = 'banco') and exists (select 1 from rg where fonte = 'lancado') then 'misto'
                    when exists (select 1 from rg where fonte = 'banco') then 'banco' else 'lancado' end,
      'mes', (select ini from q), 'corrente', (select corrente from q),
      'dia', (select dia from q), 'dias_mes', (select dias from q),
      'meses_historico', (select count(distinct mes) from rg where mes < (select ini from q)),
      'gasto', coalesce((select sum(valor) from atual), 0),
      'qtd', (select count(*) from atual),
      'mes_passado_mesmo_dia', coalesce((select sum(passado_mesmo_dia) from cats), 0),
      'normal_mes', round(coalesce((select sum(normal) from cats), 0), 2),
      'media_mensal', round(coalesce((select sum(historico) from cats), 0), 2),
      'normal_ate_hoje', round(coalesce((select sum(esperado) from cats), 0), 2),
      'projecao', case when (select corrente from q) and (select dia from q) >= 5
                       then round(coalesce((select sum(valor) from atual), 0)
                                  + greatest(coalesce((select sum(normal) from cats), 0) - coalesce((select sum(esperado) from cats), 0), 0), 2) end,
      'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'rotulo', rotulo,
                        'total', total, 'qtd', qtd, 'normal', normal, 'esperado', esperado, 'fixa', fixa,
                        'tem_teto', tem_teto, 'historico', historico, 'passado_mesmo_dia', passado_mesmo_dia)
                        order by total desc, normal desc) from cats), '[]'::jsonb),
      'tem_tetos', exists (select 1 from tetos),
      'alertas', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'rotulo', rotulo,
                        'total', total, 'esperado', limite, 'acima', total - limite, 'tem_teto', tem_teto, 'fixa', fixa))
                        from alertas), '[]'::jsonb),
      'negocio', jsonb_build_object(
          'total', coalesce((select sum(valor) from neg where mes = (select ini from q)), 0),
          'media_mensal', round(coalesce((select sum(valor) from neg where mes < (select ini from q)), 0) / (select n from n), 2),
          'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'rotulo', rotulo, 'total', total, 'qtd', qtd)
                        order by total desc) from neg_cat), '[]'::jsonb)))
  end;
$$;
grant execute on function public.financas_rastreador(date) to authenticated;

-- lançamentos de uma categoria (ou do negócio) no mês, pro detalhe da categoria
create or replace function public.analise_lancamentos(p_mes date, p_categoria text default null, p_esfera text default null)
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'data', l.data, 'hora', to_char(l.hora, 'HH24:MI'),
           'nome', coalesce(nullif(l.apelido, ''), nullif(l.comerciante, ''), l.descricao),
           'original', l.descricao, 'apelido', l.apelido, 'valor', l.valor, 'categoria', l.categoria,
           'banco', l.banco, 'recorrente', l.recorrente, 'fora_analise', l.fora_analise,
           'confirmado', l.confianca = 'usuario',
           'mesmo_nome', case when l.chave is null then 1
                              else (select count(*) from public.extrato_lancamentos o
                                     where o.user_id = l.user_id and o.chave = l.chave and o.tipo = l.tipo) end)
           order by l.data desc, l.hora desc nulls last, l.valor desc), '[]'::jsonb)
    from public.extrato_lancamentos l
   where l.user_id = auth.uid() and l.tipo = 'saida' and l.movimento <> 'entre_contas'
     and l.data >= date_trunc('month', p_mes)::date and l.data < (date_trunc('month', p_mes) + interval '1 month')::date
     and l.categoria not in ('transferencia_propria', 'estorno', 'fatura_cartao')
     and (p_categoria is null or l.categoria = p_categoria)
     and (p_esfera is null or (case when l.esfera = 'corre' then 'corre' else 'pessoal' end) = p_esfera);
$$;
grant execute on function public.analise_lancamentos(date, text, text) to authenticated;

-- fila do "Para revisar": o que a Vant não sabe o que é e ninguém confirmou
create or replace function public.analise_revisar(p_mes date default null)
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  with q as (
    select coalesce(date_trunc('month', p_mes)::date, date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date) ini
  ),
  mes as (
    select l.* from public.extrato_lancamentos l, q
     where l.user_id = auth.uid() and l.tipo = 'saida' and l.movimento = 'normal' and not l.fora_analise
       and l.data >= q.ini and l.data < (q.ini + interval '1 month')::date
       and l.categoria not in ('transferencia_propria', 'estorno', 'fatura_cartao')
  ),
  pend as (select * from mes where categoria in ('pix_pessoas', 'nao_identificado') and confianca not in ('usuario', 'regra'))
  select case when auth.uid() is null then null else jsonb_build_object(
    'pendentes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data, 'valor', valor,
                   'nome', coalesce(nullif(apelido, ''), nullif(comerciante, ''), descricao), 'banco', banco, 'categoria', categoria)
                   order by valor desc) from (select * from pend order by valor desc limit 40) x), '[]'::jsonb),
    'total_pendentes', (select count(*) from pend),
    'organizados', (select count(*) from mes) - (select count(*) from pend),
    'perguntas', (select count(*) from public.extrato_perguntas where user_id = auth.uid() and status = 'aberta'))
  end;
$$;
grant execute on function public.analise_revisar(date) to authenticated;

-- renomear (só o nome que aparece; a descrição original do banco fica guardada)
create or replace function public.extrato_renomear(p_id uuid, p_nome text)
returns void language plpgsql security invoker set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'login necessario'; end if;
  update public.extrato_lancamentos set apelido = nullif(left(trim(coalesce(p_nome, '')), 60), '')
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'lancamento nao encontrado'; end if;
end $$;
grant execute on function public.extrato_renomear(uuid, text) to authenticated;

-- tirar (ou devolver) um lançamento da análise: reembolso, dinheiro de terceiro etc.
create or replace function public.extrato_fora_analise(p_id uuid, p_fora boolean)
returns void language plpgsql security invoker set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'login necessario'; end if;
  update public.extrato_lancamentos set fora_analise = coalesce(p_fora, false)
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'lancamento nao encontrado'; end if;
end $$;
grant execute on function public.extrato_fora_analise(uuid, boolean) to authenticated;
