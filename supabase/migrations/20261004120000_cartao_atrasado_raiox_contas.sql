-- ============================================================
-- 04/10/2026 (Mohamed): "a tela de cartões tava bugada" + "dados que chegam
-- atrasados do Open Finance" + "dinheiro pra mesma conta do titular não duplica".
--
-- 1) CARTÃO (financas_painel)
--    - O banco manda a data da fatura PASSADA enquanto a nova não fecha (dado
--      atrasado): a tela gritava "VENCEU 14/09 · vira rotativo". Agora a data
--      velha é empurrada pro próximo mês e vem marcada vence_estimado; o mínimo
--      de uma fatura velha (ou maior que o usado) não aparece.
--    - Parcelas: a Pluggy às vezes só devolve a 1ª parcela de uma compra antiga
--      (TikTok 1/2 de nov/2025, Gol 1/3 de mar/2026 continuavam "rolando").
--      A parcela de hoje = a maior entre a lida e os meses desde a compra; as que
--      já acabaram saem.
--    - Dívidas: o "usado no cartão" que o banco manda já inclui as parcelas que
--      vêm; somar as parcelas de novo contava duas vezes.
-- 2) RAIO-X (extrato_analisar_padroes)
--    - Pagamento de dívida não é "entre minhas contas": "Pgto Parcela do Pix
--      Parcelado" sumia do Raio-X como transferência própria. Vira Parcelas.
--      Pix pra CloudWalk saindo da própria InfinitePay (a dona da InfinitePay)
--      vira "não identificado" pra Vant perguntar, em vez de sumir.
--    - Par entre contas com folga pro dado atrasado: o lado que entra pode vir
--      com a data de 1 dia antes até 3 dias depois (antes: 0 a 2).
--    - A conta de trabalho/pessoal escolhida no Vender (bank_connections.papel)
--      manda no Raio-X: Nubank Empresas do Mohamed estava como "pessoal" no
--      Raio-X e as vendas dela não apareciam como vendas.
-- Roda a análise de novo pra quem tem Open Finance.
-- ============================================================

create or replace function public.financas_painel()
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  con as (select id from public.bank_connections where user_id = (select uid from eu) and coalesce(status,'') <> 'deleted'),
  cart0 as (select * from public.bank_cartoes where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  cart as (
    select c.*,
           (c.vence is not null and c.vence < (select d from hoje)) as vence_estimado,
           case when c.vence is null or c.vence >= (select d from hoje) then c.vence
                else (select min(v)::date from generate_series(c.vence::timestamp, c.vence + interval '14 months', interval '1 month') v
                       where v::date >= (select d from hoje)) end as vence_prox,
           case when c.vence is null or c.vence < (select d from hoje) or c.minimo > greatest(coalesce(c.fatura, 0), 0) then null
                else c.minimo end as minimo_ok
      from cart0 c),
  parc0 as (
    select p.*,
           greatest(p.parcela_atual,
                    case when p.data_compra is null then p.parcela_atual
                         else ((extract(year from (select d from hoje)) - extract(year from p.data_compra)) * 12
                              + extract(month from (select d from hoje)) - extract(month from p.data_compra))::int end) as atual_est
      from public.bank_parcelas p where p.user_id = (select uid from eu)),
  parc as (select * from parc0 where atual_est < parcelas_total),
  emp as (select * from public.bank_emprestimos where user_id = (select uid from eu) and bank_connection_id in (select id from con)
               and coalesce(saldo_devedor, 0) > 0),
  inv as (select * from public.bank_investimentos where user_id = (select uid from eu) and bank_connection_id in (select id from con) and coalesce(saldo,0) > 0),
  sal as (select * from public.bank_saldos where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  res as (select * from inv where reserva),
  meses as (
    select (date_trunc('month', (select d from hoje)) + make_interval(months => g))::date as mes,
           sum(p.valor_parcela) as valor
      from parc p, generate_series(1, 12) g
     where g <= p.parcelas_total - p.atual_est
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
                 'disponivel', disponivel, 'vence', vence_prox, 'vence_estimado', vence_estimado, 'fecha', fecha,
                 'minimo', minimo_ok, 'atualizado', atualizado_em)
                 order by vence_prox nulls last) from cart), '[]'::jsonb),
    'parcelas', coalesce((select jsonb_agg(jsonb_build_object('descricao', descricao, 'banco', banco, 'valor', valor_parcela,
                 'atual', atual_est, 'total', parcelas_total,
                 'ate', (date_trunc('month', (select d from hoje)) + make_interval(months => parcelas_total - atual_est))::date)
                 order by valor_parcela desc) from parc), '[]'::jsonb),
    'parcelas_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor) order by mes) from meses), '[]'::jsonb),
    'parcelas_mes', coalesce((select valor from meses order by mes limit 1), 0),
    'parcelas_total', coalesce((select sum(valor_parcela * (parcelas_total - atual_est)) from parc), 0),
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
    -- o usado no cartão já inclui as parcelas que vêm: não soma as parcelas de novo
    'dividas', coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0))) from emp), 0)
               + coalesce((select sum(fatura) from cart where fatura > 0), 0)
               + (select usado from especial),
    'dia_de_rua', round(coalesce((select media from rua), 0), 2),
    'leitura', (select max(atualizado_em) from (select atualizado_em from cart union all select atualizado_em from emp union all select atualizado_em from inv) x)
  );
$function$;

create or replace function public.extrato_analisar_padroes(p_uid uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inv text := '\m(APLICACAO|APLIC|RESGATE|COFRINHO|COFRINHOS|CAIXINHA|CAIXINHAS|CDB|RDB|POUPANCA|INVESTIMENTO|TESOURO)\M';
  v_fat text := '\m(FATURA|PICPAY CARD)\M|PAGAMENTO CARTAO|PAGTO CARTAO|PGTO CARTAO|CARTAO DE CREDITO';
  -- pagamento de dívida (04/10): nunca é "entre minhas contas"
  v_div text := 'PIX PARCELADO|\m(PGTO|PAGTO|PAGAMENTO) (DE )?PARCELA|\m(EMPRESTIMO|FINANCIAMENTO|CONSIGNADO)\M';
  v_pares int := 0; v_padrao int := 0; v_rec int := 0; v_ec int := 0; v_perg int := 0; v_dic int := 0;
begin
  if p_uid is null then return '{}'::jsonb; end if;

  update public.extrato_lancamentos l
     set chave = coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm))
   where l.user_id = p_uid
     and l.chave is distinct from coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm));

  update public.extrato_lancamentos set categoria = 'fatura_cartao', esfera = 'pessoal', movimento = 'fatura'
   where user_id = p_uid and tipo = 'saida' and confianca <> 'usuario' and movimento <> 'fatura'
     and (descricao_norm ~ v_fat or coalesce(comerciante, '') ~ v_fat);
  update public.extrato_lancamentos set movimento = 'fatura'
   where user_id = p_uid and categoria = 'fatura_cartao' and movimento <> 'fatura';
  update public.extrato_lancamentos set movimento = 'normal'
   where user_id = p_uid and movimento = 'fatura' and categoria <> 'fatura_cartao';

  update public.extrato_lancamentos l set categoria = r.categoria, esfera = r.esfera, confianca = 'usuario'
    from public.extrato_regras_usuario r
   where l.user_id = p_uid and r.user_id = p_uid and r.comerciante = l.chave and r.tipo = l.tipo
     and (r.valor_min is null or l.valor >= r.valor_min) and l.movimento <> 'fatura'
     and (l.categoria <> r.categoria or l.confianca <> 'usuario' or l.esfera <> r.esfera);

  -- 04/10: dívida paga não some como transferência própria
  update public.extrato_lancamentos set categoria = 'parcelas', esfera = 'pessoal', confianca = 'regra'
   where user_id = p_uid and tipo = 'saida' and confianca <> 'usuario' and movimento <> 'fatura'
     and categoria <> 'parcelas'
     and (descricao_norm ~ v_div or coalesce(comerciante, '') ~ v_div);
  -- Pix pra CloudWalk saindo da própria InfinitePay: é cobrança da InfinitePay, não conta dele.
  -- Vira pergunta; se ele disser "é minha conta", a resposta dele manda (confianca usuario).
  update public.extrato_lancamentos set categoria = 'nao_identificado', esfera = 'pessoal', confianca = 'baixa'
   where user_id = p_uid and tipo = 'saida' and confianca <> 'usuario' and movimento <> 'fatura'
     and categoria = 'transferencia_propria' and banco ilike 'infinitepay%'
     and (descricao_norm ~ 'CLOUDWALK' or coalesce(comerciante, '') ~ 'CLOUDWALK');

  update public.extrato_lancamentos set movimento = 'normal', par_id = null
   where user_id = p_uid and (movimento = 'entre_contas' or par_id is not null);

  update public.extrato_lancamentos l set movimento = 'entre_contas', esfera = 'pessoal',
         categoria = case when l.confianca = 'usuario' then l.categoria
                          when l.tipo = 'saida' then 'transferencia_propria' else 'transferencia_recebida' end
   where l.user_id = p_uid and l.movimento = 'normal'
     and ( l.categoria = 'transferencia_propria'
        or (l.confianca <> 'usuario' and (l.descricao_norm ~ v_inv or coalesce(l.comerciante, '') ~ v_inv))
        or (l.confianca <> 'usuario' and l.categoria <> 'parcelas'
            and public.extrato_eh_titular(p_uid, coalesce(nullif(l.comerciante, ''), l.descricao_norm))) );

  -- par saída × entrada do mesmo valor em bancos diferentes. Folga pro Open Finance atrasado:
  -- a entrada pode vir datada de 1 dia antes até 3 dias depois da saída.
  with s as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and banco is not null and valor >= 20
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  e as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'entrada' and banco is not null
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  c as (
    select s.id sid, e.id eid, abs(e.data - s.data) dd from s join e
      on e.valor = s.valor and e.banco <> s.banco and e.data between s.data - 1 and s.data + 3
     where s.meu or e.meu or s.valor >= 100),
  c1 as (select distinct on (sid) sid, eid, dd from c order by sid, dd, eid),
  c2 as (select distinct on (eid) sid, eid from c1 order by eid, dd, sid),
  us as (
    update public.extrato_lancamentos l set movimento = 'entre_contas', par_id = c2.eid, esfera = 'pessoal',
           categoria = case when l.confianca = 'usuario' then l.categoria else 'transferencia_propria' end
      from c2 where l.id = c2.sid returning 1),
  ue as (
    update public.extrato_lancamentos l set movimento = 'entre_contas', par_id = c2.sid, esfera = 'pessoal',
           categoria = case when l.confianca = 'usuario' then l.categoria else 'transferencia_recebida' end
      from c2 where l.id = c2.eid returning 1)
  select (select count(*) from us) + 0 * (select count(*) from ue) into v_pares;

  select count(*) into v_ec from public.extrato_lancamentos where user_id = p_uid and movimento = 'entre_contas';

  v_dic := public.extrato_dicionario_fixo(p_uid);

  with base as (
    select chave, categoria, count(*) n from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and chave is not null
       and categoria not in ('nao_identificado', 'outros')
     group by 1, 2),
  tot as (select chave, sum(n) total from base group by 1),
  dom as (select distinct on (b.chave) b.chave, b.categoria, b.n, t.total
            from base b join tot t using (chave) order by b.chave, b.n desc, b.categoria),
  alvo as (
    select d.chave, d.categoria from dom d
     where d.total >= 2 and d.n::numeric / d.total >= 0.6
       and not exists (select 1 from public.extrato_regras_usuario r
                        where r.user_id = p_uid and r.comerciante = d.chave and r.tipo = 'saida'))
  update public.extrato_lancamentos l set categoria = a.categoria, esfera = c.esfera_padrao, confianca = 'padrao'
    from alvo a join public.extrato_categorias c on c.slug = a.categoria
   where l.user_id = p_uid and l.chave = a.chave and l.tipo = 'saida' and l.movimento = 'normal'
     and l.confianca in ('ia', 'baixa', 'padrao') and l.categoria <> a.categoria;
  get diagnostics v_padrao = row_count;

  update public.extrato_lancamentos set recorrente = false where user_id = p_uid and recorrente;
  with r as (
    select chave from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and chave is not null
     group by chave
    having count(distinct date_trunc('month', data)) >= 3
       and count(*) <= count(distinct date_trunc('month', data)) * 1.5
       and coalesce(stddev_pop(valor) / nullif(avg(valor), 0), 0) <= 0.25
       and avg(valor) >= 5)
  update public.extrato_lancamentos l set recorrente = true,
         categoria = case when l.confianca in ('ia','baixa','padrao')
                           and (l.categoria in ('nao_identificado','outros') or (l.pessoa = 'pj' and l.categoria = 'pix_pessoas'))
                          then 'assinaturas' else l.categoria end,
         confianca = case when l.confianca in ('ia','baixa','padrao')
                           and (l.categoria in ('nao_identificado','outros') or (l.pessoa = 'pj' and l.categoria = 'pix_pessoas'))
                          then 'padrao' else l.confianca end
    from r where l.user_id = p_uid and l.chave = r.chave and l.tipo = 'saida' and l.movimento = 'normal';
  get diagnostics v_rec = row_count;

  -- 04/10: o papel escolhido no Vender (trabalho/pessoal) manda no Raio-X
  insert into public.extrato_contas (user_id, banco, uso, auto)
  select p_uid, bc.institution_name,
         case when bool_or(bc.papel = 'trabalho') then 'vendas' else 'pessoal' end, false
    from public.bank_connections bc
   where bc.user_id = p_uid and coalesce(bc.status, '') <> 'deleted'
     and bc.papel in ('trabalho', 'pessoal') and bc.institution_name is not null
   group by bc.institution_name
  on conflict (user_id, banco) do update set uso = excluded.uso, auto = false, atualizado_em = now()
   where public.extrato_contas.uso <> excluded.uso or public.extrato_contas.auto;

  insert into public.extrato_contas (user_id, banco, uso, auto)
  select p_uid, b.banco,
         case when coalesce(e.n, 0) >= 20 * greatest(e.meses, 1) and coalesce(e.med, 999) <= 80 then 'vendas' else 'pessoal' end,
         true
    from (select distinct banco from public.extrato_lancamentos where user_id = p_uid and banco is not null) b
    left join (
      select banco, count(*) n, count(distinct date_trunc('month', data)) meses,
             percentile_cont(0.5) within group (order by valor) med
        from public.extrato_lancamentos
       where user_id = p_uid and tipo = 'entrada' and movimento = 'normal' and banco is not null
       group by banco) e on e.banco = b.banco
  on conflict (user_id, banco) do update set uso = excluded.uso, atualizado_em = now()
   where public.extrato_contas.auto and public.extrato_contas.uso <> excluded.uso;

  update public.extrato_lancamentos l
     set esfera = case when c.uso = 'vendas' or l.categoria = 'cartao_recebido' then 'corre' else 'pessoal' end
    from public.extrato_contas c
   where l.user_id = p_uid and c.user_id = p_uid and c.banco = l.banco and l.tipo = 'entrada'
     and l.movimento = 'normal' and l.confianca <> 'usuario'
     and l.esfera <> (case when c.uso = 'vendas' or l.categoria = 'cartao_recebido' then 'corre' else 'pessoal' end);

  v_perg := public.extrato_gerar_perguntas(p_uid);

  return jsonb_build_object('pares', v_pares, 'entre_contas', v_ec, 'consolidados', v_padrao,
                            'recorrentes', v_rec, 'dicionario', v_dic, 'perguntas', v_perg);
end $function$;

-- refaz a análise de quem tem Open Finance
do $$
declare u uuid;
begin
  for u in select distinct user_id from public.extrato_lancamentos where origem = 'pluggy' loop
    perform public.extrato_analisar_padroes(u);
  end loop;
end $$;
