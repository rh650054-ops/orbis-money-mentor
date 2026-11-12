-- SNAPSHOT, NOT A MIGRATION. Functions that exist only in production, copied on 11/11/2026 with
-- pg_get_functiondef. Do not apply: production already has them. Each one was checked against
-- production by md5 (see manifesto.json). Kept here so the removal of the direct Mercado Pago /
-- PagBank connections, and anything touching account deletion, can be reviewed against real code.

CREATE OR REPLACE FUNCTION public.apagar_dados_do_usuario(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_tabelas int := 0;
  v_linhas bigint := 0;
  v_del bigint;
begin
  if p_user is null then
    raise exception 'usuário nulo';
  end if;

  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
      and c.table_name <> 'profiles'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', r.table_name) using p_user;
      get diagnostics v_del = row_count;
      v_tabelas := v_tabelas + 1;
      v_linhas := v_linhas + v_del;
    exception when others then
      raise warning 'falha ao limpar %: %', r.table_name, sqlerrm;
    end;
  end loop;

  delete from public.profiles where user_id = p_user;
  get diagnostics v_del = row_count;
  v_linhas := v_linhas + v_del;

  return jsonb_build_object('tabelas_varridas', v_tabelas, 'linhas_apagadas', v_linhas);
end $function$
;

CREATE OR REPLACE FUNCTION public.cobranca_registrar_paga(p_id uuid, p_valor numeric DEFAULT NULL::numeric, p_pago_em timestamp with time zone DEFAULT now(), p_payment_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cob public.cobrancas%rowtype;
  v_valor numeric;
  v_ds record;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'so o servidor pode confirmar pagamento';
  end if;

  select * into v_cob from public.cobrancas where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;
  if v_cob.lancada then
    return jsonb_build_object('ok', true, 'motivo', 'ja_lancada');
  end if;

  v_valor := round(coalesce(p_valor, v_cob.valor)::numeric, 2);

  update public.cobrancas
     set status = 'paga',
         paga_em = coalesce(p_pago_em, now()),
         valor_pago = v_valor,
         provider_payment_id = coalesce(p_payment_id, provider_payment_id),
         lancada = true
   where id = p_id;

  -- nasceu junto com a venda: o valor JA esta no dia, so confirma e sai
  if not v_cob.abate_calote then
    return jsonb_build_object('ok', true, 'valor', v_valor, 'abateu', false, 'user_id', v_cob.user_id);
  end if;

  select * into v_ds from public.daily_sales
   where user_id = v_cob.user_id and date = v_cob.data
   limit 1;

  if found then
    update public.daily_sales
       set total_profit = coalesce(total_profit, 0) + v_valor,
           pix_sales    = coalesce(pix_sales, 0) + v_valor,
           total_debt   = greatest(0, coalesce(total_debt, 0) - v_valor),
           updated_at   = now()
     where id = v_ds.id;
  else
    insert into public.daily_sales (user_id, date, total_profit, pix_sales, total_debt)
    values (v_cob.user_id, v_cob.data, v_valor, v_valor, 0);
  end if;

  return jsonb_build_object('ok', true, 'valor', v_valor, 'abateu', true, 'user_id', v_cob.user_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.conexao_conceder_selo(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select true;  -- carteira nao verifica mais: quem verifica e o banco (Open Finance)
$function$
;

CREATE OR REPLACE FUNCTION public.conexao_revisar_selo(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if not exists (select 1 from public.mp_conexoes where user_id = p_user and ativo) then
    update public.profiles set verificado = false, verificado_por = null
     where user_id = p_user and verificado_por = 'conexao';
  end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.mp_comprovado(p_user uuid, p_data date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(valor), 0)::numeric from public.mp_vendas
  where user_id = p_user and data = p_data and status = 'approved' and not ignorado;
$function$
;

CREATE OR REPLACE FUNCTION public.mp_conciliacao_dia(p_data date DEFAULT NULL::date)
 RETURNS TABLE(conectado boolean, data date, pix_declarado numeric, pix_caiu numeric, cartao_declarado numeric, cartao_caiu numeric, dinheiro numeric, gorjeta numeric, total_declarado numeric, total_caiu numeric, nao_caiu numeric, a_mais numeric, vendas_nao_lancadas integer, ultima_sync_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with d as (select coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date) dia),
  con as (select * from public.mp_conexoes where user_id = auth.uid() and ativo),
  dec as (
    select
      coalesce(sum(amount) filter (where method = 'pix'), 0)::numeric pix,
      coalesce(sum(amount) filter (where method = 'cartao'), 0)::numeric cartao,
      coalesce(sum(amount) filter (where method = 'dinheiro'), 0)::numeric dinheiro,
      coalesce(sum(amount) filter (where method = 'gorjeta'), 0)::numeric gorjeta
    from public.defcon_sales
    where user_id = auth.uid()
      and (created_at at time zone 'America/Sao_Paulo')::date = (select dia from d)
  ),
  caiu as (
    select
      coalesce(sum(valor) filter (where metodo = 'pix' and origem <> 'point'), 0)::numeric pix,
      coalesce(sum(valor) filter (where origem = 'point' or metodo ilike '%credit%' or metodo ilike '%debit%'), 0)::numeric cartao
    from public.mp_vendas
    where user_id = auth.uid() and data = (select dia from d) and status = 'approved' and not ignorado
  )
  select
    (select count(*) from con) > 0, (select dia from d),
    dec.pix, caiu.pix, dec.cartao, caiu.cartao, dec.dinheiro, dec.gorjeta,
    (dec.pix + dec.cartao + dec.dinheiro)::numeric,
    (caiu.pix + caiu.cartao)::numeric,
    greatest(0, (dec.pix + dec.cartao) - (caiu.pix + caiu.cartao))::numeric,
    greatest(0, (caiu.pix + caiu.cartao) - (dec.pix + dec.cartao))::numeric,
    (select count(*)::int from public.mp_vendas where user_id = auth.uid() and data = (select dia from d) and status = 'approved' and not lancado and not ignorado),
    (select ultima_sync_em from con)
  from dec, caiu;
$function$
;

CREATE OR REPLACE FUNCTION public.mp_conciliacao_mes(p_mes text DEFAULT NULL::text)
 RETURNS TABLE(conectado boolean, mes text, pix_declarado numeric, pix_caiu numeric, cartao_declarado numeric, cartao_caiu numeric, dinheiro numeric, total_declarado numeric, total_caiu numeric, nao_caiu numeric, dias_com_furo integer, pior_dia date, pior_valor numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with m as (select coalesce(p_mes, to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM')) mm),
  con as (select * from public.mp_conexoes where user_id = auth.uid() and ativo),
  dec as (
    select (created_at at time zone 'America/Sao_Paulo')::date dia,
      coalesce(sum(amount) filter (where method = 'pix'), 0)::numeric pix,
      coalesce(sum(amount) filter (where method = 'cartao'), 0)::numeric cartao,
      coalesce(sum(amount) filter (where method = 'dinheiro'), 0)::numeric dinheiro
    from public.defcon_sales
    where user_id = auth.uid()
      and to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM') = (select mm from m)
    group by 1
  ),
  caiu as (
    select data dia,
      coalesce(sum(valor) filter (where metodo = 'pix' and origem <> 'point'), 0)::numeric pix,
      coalesce(sum(valor) filter (where origem = 'point' or metodo ilike '%credit%' or metodo ilike '%debit%'), 0)::numeric cartao
    from public.mp_vendas
    where user_id = auth.uid() and status = 'approved' and not ignorado
      and to_char(data, 'YYYY-MM') = (select mm from m)
    group by 1
  ),
  j as (
    select coalesce(dec.dia, caiu.dia) dia,
      coalesce(dec.pix,0) dpix, coalesce(dec.cartao,0) dcar, coalesce(dec.dinheiro,0) ddin,
      coalesce(caiu.pix,0) cpix, coalesce(caiu.cartao,0) ccar,
      greatest(0, (coalesce(dec.pix,0)+coalesce(dec.cartao,0)) - (coalesce(caiu.pix,0)+coalesce(caiu.cartao,0))) furo
    from dec full outer join caiu on caiu.dia = dec.dia
  )
  select (select count(*) from con) > 0, (select mm from m),
    coalesce(sum(dpix),0), coalesce(sum(cpix),0),
    coalesce(sum(dcar),0), coalesce(sum(ccar),0),
    coalesce(sum(ddin),0),
    coalesce(sum(dpix+dcar+ddin),0), coalesce(sum(cpix+ccar),0), coalesce(sum(furo),0),
    coalesce(count(*) filter (where furo > 0), 0)::int,
    (select dia from j order by furo desc nulls last limit 1),
    (select furo from j order by furo desc nulls last limit 1)
  from j;
$function$
;

CREATE OR REPLACE FUNCTION public.mp_conexoes_lista()
 RETURNS TABLE(provedor text, apelido text, conectado_em timestamp with time zone, ultima_sync_em timestamp with time zone, erro text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select provedor, apelido, conectado_em, ultima_sync_em, ultimo_erro
  from public.mp_conexoes where user_id = auth.uid() and ativo order by conectado_em;
$function$
;

CREATE OR REPLACE FUNCTION public.mp_desconectar(p_provedor text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'sem login'; end if;
  delete from public.mp_conexoes where user_id = me and (p_provedor is null or provedor = p_provedor);
  perform public.conexao_revisar_selo(me);
end; $function$
;

CREATE OR REPLACE FUNCTION public.mp_ignorar_venda(p_id text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.mp_vendas set ignorado = true where payment_id = p_id and user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.mp_lancar_vendas(p_ids text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  sess uuid; blk int; r record; n int := 0; novo uuid; metodo text;
begin
  if me is null then raise exception 'sem login'; end if;
  select id, coalesce(current_block_index, 0) into sess, blk from public.challenge_sessions
   where user_id = me and date = hoje and status = 'active' order by started_at desc limit 1;
  for r in select * from public.mp_vendas where user_id = me and payment_id = any(p_ids) and not lancado and not ignorado and status = 'approved' loop
    metodo := case when r.metodo = 'pix' then 'pix'
                   when r.origem = 'point' or r.metodo ilike '%credit%' or r.metodo ilike '%debit%' or r.metodo ilike '%card%' then 'cartao'
                   else 'pix' end;
    insert into public.defcon_sales (user_id, session_id, block_index, amount, method, late, created_at)
    values (me, sess, blk, r.valor, metodo, sess is null, r.pago_em)
    returning id into novo;
    update public.mp_vendas set lancado = true, defcon_sale_id = novo
     where provedor = r.provedor and payment_id = r.payment_id;
    n := n + 1;
  end loop;
  return n;
end; $function$
;

CREATE OR REPLACE FUNCTION public.mp_status()
 RETURNS TABLE(conectado boolean, apelido text, conectado_em timestamp with time zone, ultima_sync_em timestamp with time zone, recebido_hoje numeric, vendas_hoje integer, pendentes integer, pendentes_valor numeric, erro text, provedores text[], verificado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  c as (select * from public.mp_conexoes where user_id = auth.uid() and ativo),
  v as (select * from public.mp_vendas where user_id = auth.uid() and data = (select d from hoje) and status = 'approved' and not ignorado)
  select (select count(*) from c) > 0,
         (select string_agg(coalesce(apelido, provedor), ' · ' order by conectado_em) from c),
         (select min(conectado_em) from c), (select max(ultima_sync_em) from c),
         coalesce((select sum(valor) from v), 0)::numeric,
         (select count(*)::int from v),
         (select count(*)::int from v where not lancado),
         coalesce((select sum(valor) from v where not lancado), 0)::numeric,
         (select string_agg(ultimo_erro, ' · ') from c where ultimo_erro is not null),
         (select array_agg(provedor order by conectado_em) from c),
         coalesce((select verificado from public.profiles where user_id = auth.uid()), false);
$function$
;

CREATE OR REPLACE FUNCTION public.mp_vendas_pendentes(p_dias integer DEFAULT 1)
 RETURNS TABLE(payment_id text, provedor text, valor numeric, metodo text, origem text, descricao text, pago_em timestamp with time zone, data date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select payment_id, provedor, valor, metodo, origem, descricao, pago_em, data
  from public.mp_vendas
  where user_id = auth.uid() and status = 'approved' and not lancado and not ignorado
    and data >= (now() at time zone 'America/Sao_Paulo')::date - greatest(p_dias, 0)
  order by pago_em desc limit 50;
$function$
;
