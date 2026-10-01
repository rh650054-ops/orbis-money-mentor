-- Raio-X v2b (01/10/2026) — ajustes depois de rodar a v2 nos extratos reais:
--  * PRIVACIDADE: "Pix enviado 59.604" — pedaco de CPF/CNPJ com ponto escapava do filtro
--    \d{5,}. Agora sai qualquer numero com 4+ digitos e separadores (. - /).
--  * IMPOSTOS: categoria nova (DAS do MEI, Receita Federal, Simples) — gasto do corre.
--  * 99 APP: "99 TECNOLOGIA" virava "TECNOLOG" (o numero some na normalizacao).
--  * PERGUNTAS: separadas numa funcao propria; no maximo 6 perguntas de lancamento solto;
--    "recorrente" nao duplica com "inconsistente".

insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem) values
  ('impostos', 'Impostos / DAS MEI', '🧾', 'corre', 'saida', 5)
on conflict (slug) do update set rotulo = excluded.rotulo, icone = excluded.icone, esfera_padrao = excluded.esfera_padrao, tipo = excluded.tipo, ordem = excluded.ordem;

-- Limpa numero de documento/conta de uma descricao (mesma regra no backend).
create or replace function public.extrato_limpa_desc(p text) returns text
language sql immutable set search_path = public as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\d[\d.\-/]{3,}\d', '', 'g'), '\d{5,}', '', 'g'), '\s+', ' ', 'g'))
$$;

-- Dicionario fixo que roda no banco (casos que a normalizacao esconde da IA/do backend).
create or replace function public.extrato_dicionario_fixo(p_uid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int;
begin
  update public.extrato_lancamentos set categoria = 'impostos', esfera = 'corre', confianca = 'regra'
   where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and confianca in ('ia', 'baixa', 'padrao')
     and categoria <> 'impostos'
     and (descricao_norm ~ '\m(RECEITA FED|RECEITA FEDERAL|SIMPLES NACIONAL|DARF|PGMEI|DAS MEI|DAS SIMPLES)\M'
          or descricao_norm ~ '^DAS\M' or coalesce(comerciante, '') ~ '\m(RECEITA FED|SIMPLES NACIONAL)\M');
  get diagnostics n1 = row_count;
  update public.extrato_lancamentos set categoria = 'transporte_app', esfera = 'pessoal', confianca = 'regra'
   where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and confianca in ('ia', 'baixa', 'padrao')
     and categoria <> 'transporte_app'
     and descricao ~* '(^|[^0-9])99\s*(TECNOLOGIA|POP|APP|TAXI|MOTO|RIDE)';
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;

create or replace function public.extrato_gerar_perguntas(p_uid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_inv text := '\m(APLICACAO|APLIC|RESGATE|COFRINHO|COFRINHOS|CAIXINHA|CAIXINHAS|CDB|RDB|POUPANCA|INVESTIMENTO|TESOURO)\M';
  v_n int;
begin
  with l as (
    select * from public.extrato_lancamentos where user_id = p_uid and tipo = 'saida'),
  semregra as (
    select l.* from l where l.chave is null or not exists (
      select 1 from public.extrato_regras_usuario r where r.user_id = p_uid and r.comerciante = l.chave and r.tipo = 'saida')),
  -- a) "isso e uma conta sua?" — a IA achou que era, mas o nome nao bate com o titular
  q_conta as (
    select 'conta_sua'::text motivo, chave alvo, chave, null::uuid lanc,
           (array_agg(comerciante order by valor desc))[1] nome, count(*)::int qtd, sum(valor) total,
           count(distinct date_trunc('month', data))::int meses, '{}'::jsonb dados,
           jsonb_build_array(
             jsonb_build_object('v', '__minha_conta', 'r', 'Sim, é conta minha'),
             jsonb_build_object('v', 'pix_pessoas', 'r', 'Não, é outra pessoa'),
             jsonb_build_object('v', 'mercadoria', 'r', 'Fornecedor / mercadoria')) opcoes
      from semregra
     where chave is not null and categoria = 'transferencia_propria' and confianca <> 'usuario'
       and not (descricao_norm ~ v_inv or coalesce(comerciante, '') ~ v_inv)
       and not public.extrato_eh_titular(p_uid, comerciante)
     group by chave having sum(valor) >= 100),
  -- b) Pix frequente pra mesma pessoa: rancho? fornecedor? (com "so os acima de R$ X")
  pes as (
    select chave, (array_agg(comerciante order by valor desc))[1] nome, count(*)::int qtd, sum(valor) total,
           count(distinct date_trunc('month', data))::int meses, min(valor) mn, max(valor) mx, round(avg(valor), 2) media,
           greatest(100, round(percentile_cont(0.75) within group (order by valor)::numeric / 50) * 50) lim
      from semregra
     where chave is not null and movimento = 'normal' and categoria = 'pix_pessoas' and confianca <> 'usuario'
     group by chave having count(*) >= 4 and sum(valor) >= 300),
  q_pes as (
    select 'pessoa'::text, p.chave, p.chave, null::uuid, p.nome, p.qtd, p.total, p.meses,
           jsonb_build_object('min', p.mn, 'max', p.mx, 'media', p.media),
           jsonb_build_array(jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho da casa'))
           || case when p.mx >= p.lim and p.mn < p.lim
                   then jsonb_build_array(jsonb_build_object('v', 'mercado', 'r', 'Rancho só os acima de {min}', 'min', p.lim))
                   else '[]'::jsonb end
           || jsonb_build_array(
                jsonb_build_object('v', 'mercadoria', 'r', 'Fornecedor / mercadoria'),
                jsonb_build_object('v', 'contas_casa', 'r', 'Aluguel / conta da casa'),
                jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra pessoa mesmo'),
                jsonb_build_object('v', '__minha_conta', 'r', 'É conta minha'))
      from pes p),
  -- c) mesmo lugar com categorias diferentes e sem maioria clara
  inc as (
    select chave, categoria, count(*) n, sum(valor) total from semregra
     where chave is not null and movimento = 'normal' and categoria not in ('nao_identificado', 'outros') and confianca <> 'usuario'
     group by 1, 2),
  inc_ch as (select chave from inc group by chave having count(*) >= 2 and sum(n) >= 3),
  q_inc as (
    select 'inconsistente'::text, i.chave, i.chave, null::uuid,
           (select (array_agg(x.comerciante order by x.valor desc))[1] from semregra x where x.chave = i.chave),
           sum(i.n)::int, sum(i.total),
           (select count(distinct date_trunc('month', x.data))::int from semregra x where x.chave = i.chave),
           jsonb_build_object('categorias', jsonb_agg(c.rotulo order by i.n desc)),
           jsonb_agg(jsonb_build_object('v', i.categoria, 'r', c.icone || ' ' || c.rotulo) order by i.n desc)
             || jsonb_build_array(jsonb_build_object('v', 'outros', 'r', 'Outra coisa'))
      from inc i join public.extrato_categorias c on c.slug = i.categoria
     where i.chave in (select chave from inc_ch)
     group by i.chave),
  -- d) todo mes pra mesma pessoa, valor parecido: aluguel? mensalidade?
  q_rec as (
    select 'recorrente'::text, chave, chave, null::uuid, (array_agg(comerciante order by data desc))[1], count(*)::int, sum(valor),
           count(distinct date_trunc('month', data))::int, jsonb_build_object('media', round(avg(valor), 2)),
           jsonb_build_array(
             jsonb_build_object('v', 'contas_casa', 'r', 'Aluguel / conta da casa'),
             jsonb_build_object('v', 'assinaturas', 'r', 'Assinatura / mensalidade'),
             jsonb_build_object('v', 'parcelas', 'r', 'Parcela / empréstimo'),
             jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra pessoa mesmo'))
      from semregra
     where chave is not null and recorrente and categoria = 'pix_pessoas' and confianca <> 'usuario'
       and chave not in (select chave from pes) and chave not in (select chave from inc_ch)
     group by chave),
  -- e) lugar que a IA nao reconheceu, com valor relevante
  q_nsei as (
    select 'nao_sei'::text, chave, chave, null::uuid, (array_agg(comerciante order by valor desc))[1], count(*)::int, sum(valor),
           count(distinct date_trunc('month', data))::int, '{}'::jsonb,
           jsonb_build_array(
             jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho'),
             jsonb_build_object('v', 'mercadoria', 'r', 'Mercadoria / fornecedor'),
             jsonb_build_object('v', 'restaurante', 'r', 'Bares e lanches'),
             jsonb_build_object('v', 'contas_casa', 'r', 'Conta da casa'),
             jsonb_build_object('v', 'outros', 'r', 'Outra coisa'))
      from semregra
     where chave is not null and movimento = 'normal' and categoria = 'nao_identificado' and confianca <> 'usuario'
       and chave not in (select chave from inc_ch)
     group by chave having sum(valor) >= 150),
  -- f) lancamento generico ("PIX ENVIADO") com valor alto: no maximo 6, os maiores
  q_lanc as (
    select * from (
      select 'lancamento'::text motivo, id::text alvo, null::text chave, id lanc, descricao nome, 1 qtd, valor total, 1 meses,
             jsonb_build_object('data', data, 'banco', banco) dados,
             jsonb_build_array(
               jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho'),
               jsonb_build_object('v', 'mercadoria', 'r', 'Mercadoria / fornecedor'),
               jsonb_build_object('v', 'contas_casa', 'r', 'Conta da casa'),
               jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra uma pessoa'),
               jsonb_build_object('v', '__minha_conta', 'r', 'Mandei pra outra conta minha')) opcoes
        from l
       where chave is null and movimento = 'normal' and categoria in ('nao_identificado', 'pix_pessoas')
         and confianca <> 'usuario' and valor >= 150
       order by valor desc limit 6) x),
  todas as (
    select * from q_conta union all select * from q_pes union all select * from q_inc
    union all select * from q_rec union all select * from q_nsei union all select * from q_lanc),
  top as (select * from todas order by total desc limit 25),
  ins as (
    insert into public.extrato_perguntas (user_id, motivo, alvo, chave, lancamento_id, tipo, nome, qtd, total, meses, dados, opcoes)
    select p_uid, t.motivo, t.alvo, t.chave, t.lanc, 'saida', t.nome, t.qtd, t.total, t.meses, t.dados, t.opcoes from top t
    on conflict (user_id, motivo, alvo) do update
      set nome = excluded.nome, qtd = excluded.qtd, total = excluded.total, meses = excluded.meses,
          dados = excluded.dados, opcoes = excluded.opcoes
      where public.extrato_perguntas.status = 'aberta'
    returning 1)
  delete from public.extrato_perguntas p
   where p.user_id = p_uid and p.status = 'aberta'
     and not exists (select 1 from top t where t.motivo = p.motivo and t.alvo = p.alvo);

  select count(*) into v_n from public.extrato_perguntas where user_id = p_uid and status = 'aberta';
  return v_n;
end $$;

create or replace function public.extrato_analisar_padroes(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv text := '\m(APLICACAO|APLIC|RESGATE|COFRINHO|COFRINHOS|CAIXINHA|CAIXINHAS|CDB|RDB|POUPANCA|INVESTIMENTO|TESOURO)\M';
  v_fat text := '\m(FATURA|PICPAY CARD)\M|PAGAMENTO CARTAO|PAGTO CARTAO|PGTO CARTAO|CARTAO DE CREDITO';
  v_pares int := 0; v_padrao int := 0; v_rec int := 0; v_ec int := 0; v_perg int := 0; v_dic int := 0;
begin
  if p_uid is null then return '{}'::jsonb; end if;

  -- 0) chave da contraparte (do comerciante; se for generico, tenta a descricao)
  update public.extrato_lancamentos l
     set chave = coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm))
   where l.user_id = p_uid
     and l.chave is distinct from coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm));

  -- 1) fatura de cartao
  update public.extrato_lancamentos set categoria = 'fatura_cartao', esfera = 'pessoal', movimento = 'fatura'
   where user_id = p_uid and tipo = 'saida' and confianca <> 'usuario' and movimento <> 'fatura'
     and (descricao_norm ~ v_fat or coalesce(comerciante, '') ~ v_fat);
  update public.extrato_lancamentos set movimento = 'fatura'
   where user_id = p_uid and categoria = 'fatura_cartao' and movimento <> 'fatura';
  update public.extrato_lancamentos set movimento = 'normal'
   where user_id = p_uid and movimento = 'fatura' and categoria <> 'fatura_cartao';

  -- 2) regras que o usuario ensinou (por chave e tipo; valor minimo opcional)
  update public.extrato_lancamentos l set categoria = r.categoria, esfera = r.esfera, confianca = 'usuario'
    from public.extrato_regras_usuario r
   where l.user_id = p_uid and r.user_id = p_uid and r.comerciante = l.chave and r.tipo = l.tipo
     and (r.valor_min is null or l.valor >= r.valor_min) and l.movimento <> 'fatura'
     and (l.categoria <> r.categoria or l.confianca <> 'usuario' or l.esfera <> r.esfera);

  -- 3) entre contas — zera e recalcula
  update public.extrato_lancamentos set movimento = 'normal', par_id = null
   where user_id = p_uid and (movimento = 'entre_contas' or par_id is not null);

  update public.extrato_lancamentos l set movimento = 'entre_contas', esfera = 'pessoal',
         categoria = case when l.confianca = 'usuario' then l.categoria
                          when l.tipo = 'saida' then 'transferencia_propria' else 'transferencia_recebida' end
   where l.user_id = p_uid and l.movimento = 'normal'
     and ( l.categoria = 'transferencia_propria'
        or (l.confianca <> 'usuario' and (l.descricao_norm ~ v_inv or coalesce(l.comerciante, '') ~ v_inv))
        or (l.confianca <> 'usuario' and public.extrato_eh_titular(p_uid, coalesce(nullif(l.comerciante, ''), l.descricao_norm))) );

  with s as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and banco is not null and valor >= 20
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  e as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'entrada' and banco is not null
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  c as (
    select s.id sid, e.id eid, e.data - s.data dd from s join e
      on e.valor = s.valor and e.banco <> s.banco and e.data between s.data and s.data + 2
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

  -- 3c) dicionario fixo (impostos, 99 app)
  v_dic := public.extrato_dicionario_fixo(p_uid);

  -- 4) consolidacao: o mesmo lugar na mesma categoria
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

  -- 5) recorrencia
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

  -- 6) contas de vendas x pessoais
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

  -- 7) perguntas
  v_perg := public.extrato_gerar_perguntas(p_uid);

  return jsonb_build_object('pares', v_pares, 'entre_contas', v_ec, 'consolidados', v_padrao,
                            'recorrentes', v_rec, 'dicionario', v_dic, 'perguntas', v_perg);
end $$;

revoke all on function public.extrato_dicionario_fixo(uuid) from public, anon, authenticated;
revoke all on function public.extrato_gerar_perguntas(uuid) from public, anon, authenticated;
revoke all on function public.extrato_analisar_padroes(uuid) from public, anon, authenticated;
grant execute on function public.extrato_dicionario_fixo(uuid) to service_role;
grant execute on function public.extrato_gerar_perguntas(uuid) to service_role;
grant execute on function public.extrato_analisar_padroes(uuid) to service_role;
grant execute on function public.extrato_limpa_desc(text) to authenticated, service_role;

-- Lancamento manual usa a mesma limpeza de numero.
create or replace function public.extrato_lancar_manual(p_data date, p_valor numeric, p_tipo text, p_descricao text,
                                                        p_categoria text, p_banco text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ctipo text; v_esf text; v_desc text; v_banco text; v_id uuid;
begin
  if v_uid is null then raise exception 'nao autenticado'; end if;
  if p_tipo not in ('saida', 'entrada') then raise exception 'tipo invalido'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 1000000 then raise exception 'valor invalido'; end if;
  if p_data is null or p_data > v_hoje + 1 or p_data < v_hoje - 800 then raise exception 'data invalida'; end if;
  select tipo, esfera_padrao into v_ctipo, v_esf from public.extrato_categorias where slug = p_categoria;
  if v_ctipo is distinct from p_tipo then raise exception 'categoria invalida'; end if;
  v_desc := left(public.extrato_limpa_desc(p_descricao), 60);
  if v_desc = '' then raise exception 'descricao vazia'; end if;
  v_banco := nullif(trim(left(regexp_replace(coalesce(p_banco, ''), '[^[:alnum:] ]', '', 'g'), 40)), '');
  if (select count(*) from public.extrato_lancamentos
       where user_id = v_uid and origem = 'manual' and criado_em > now() - interval '1 day') >= 200 then
    raise exception 'limite diario de lancamentos manuais';
  end if;

  insert into public.extrato_lancamentos (user_id, arquivo_id, data, descricao, descricao_norm, comerciante, chave,
                                          valor, tipo, categoria, esfera, confianca, banco, origem)
  values (v_uid, null, p_data, v_desc,
          trim(public.extrato_norm(v_desc)) || ' MANUAL ' || upper(translate(substr(md5(gen_random_uuid()::text), 1, 10), '0123456789', 'GHIJKLMNOP')),
          left(trim(public.extrato_norm(v_desc)), 40), public.extrato_chave(v_desc),
          round(p_valor, 2), p_tipo, p_categoria, v_esf, 'usuario', v_banco, 'manual')
  returning id into v_id;
  perform public.extrato_analisar_padroes(v_uid);
  return v_id;
end $$;

-- Conserto: tira pedaco de CPF/CNPJ/conta das descricoes ja gravadas.
update public.extrato_lancamentos set descricao = coalesce(nullif(public.extrato_limpa_desc(descricao), ''), 'Lançamento')
 where descricao ~ '\d[\d.\-/]{3,}\d' or descricao ~ '\d{5,}';

select public.extrato_analisar_padroes(u.user_id) from (select distinct user_id from public.extrato_lancamentos) u;
