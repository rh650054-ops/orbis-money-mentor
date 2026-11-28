-- ============================================================================================
-- VANT Quick V2 (28/11/2026): the quick sale buttons come from what the seller already uses.
-- Requires 20261128140000 and 20261128160000. Changes nothing while no account is switched on.
--
-- Before: the widget only knew vant_quick_config (a value typed in Minha Conta). The DEFCON's own
-- quick sale values live only on the phone (localStorage), so after a R$ 20 sale in the DEFCON the
-- widget still said "Definir valor".
-- Now the server builds the options, in this order (Rick, 28/11):
--   1. today's products (Carga do dia, or sold today): 1 unit at its price, and its quantity
--      price tiers ("2 un por R$ 35") - only what is registered, never an invented promotion;
--   2. the values of today's DEFCON sales with no product (most used first);
--   3. the account's VANT Quick configuration.
-- A tap names the option (its id) and the price the button showed. The server rebuilds the list
-- and charges ITS option: price, product, quantity and payment method all come from the server.
-- If the option is gone or its price changed since the button was drawn, nothing is written and
-- the fresh options go back to the phone. The DEFCON's configuration is only read, never changed.
-- Review of 28/11 (Rick):
--  - two products at the same price are two options (each its product id and its own label, e.g.
--    "Brigadeiro · 1 un" / "Trufa · 1 un"): never merged by price, so the stock moves on the right one;
--  - build 31 sends neither option nor price, so it can only be charged a value that cannot change
--    under it: its button ("rapida") and its tap both use the VANT Quick config, as in build 31.
-- ============================================================================================

-- Payment method of an option: the last one used today for that value (as the DEFCON's own quick
-- sale repeats it), else the VANT Quick configuration's, else cash (the DEFCON's default).
create or replace function public.vant_quick_metodo(p_uid uuid, p_sessao uuid, p_valor numeric, p_produto uuid) returns text
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select ds.method from public.defcon_sales ds
      where ds.session_id = p_sessao and ds.user_id = p_uid and not ds.late and ds.method in ('dinheiro','pix','cartao')
        and abs(ds.amount - p_valor) < 0.005 and (p_produto is null or ds.product_id = p_produto)
      order by ds.created_at desc limit 1),
    (select c.metodo from public.vant_quick_config c where c.user_id = p_uid),
    'dinheiro')
$$;
revoke all on function public.vant_quick_metodo(uuid, uuid, numeric, uuid) from public, anon, authenticated;

-- The account's quick sale options for today, best first (at most 3).
-- id: 'p:<product>:<qty>' (product / tier), 'v:<cents>' (a value of today's sales), 'c' (config).
create or replace function public.vant_quick_opcoes(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_dia date := (now() at time zone 'America/Sao_Paulo')::date; v_sessao uuid; r record;
        lista jsonb := '[]'::jsonb; valores numeric[] := '{}'; c record;
begin
  select id into v_sessao from public.challenge_sessions where user_id = p_uid and date = v_dia;

  -- 1. today's products and their quantity tiers
  for r in
    with prods as (
      select p.id, p.name, p.sale_price from public.products p
       where p.user_id = p_uid and p.is_active and not p.open_price and p.sale_price > 0 and p.sale_price <= 5000
         and (exists (select 1 from public.defcon_daily_loadout l where l.user_id = p_uid and l.date = v_dia and l.product_id = p.id)
              or exists (select 1 from public.defcon_sales ds where ds.session_id = v_sessao and ds.product_id = p.id))),
    opc as (
      select id as produto, name as nome, 1 as qtd, round(sale_price, 2) as valor from prods
      union all
      select t.product_id, pr.name, t.qty, round(t.price, 2) from public.product_price_tiers t join prods pr on pr.id = t.product_id
       where t.user_id = p_uid and t.qty > 1 and t.qty <= 100 and t.price > 0 and t.price <= 5000)
    select o.*, (select count(*) from public.defcon_sales ds where ds.session_id = v_sessao and ds.product_id = o.produto
                   and ds.qty = o.qtd and abs(ds.amount - o.valor) < 0.005) as usos
      from opc o order by usos desc, qtd asc, valor asc, nome asc
  loop
    -- one option per product and quantity: two products at the same price stay two options
    exit when jsonb_array_length(lista) >= 3;
    lista := lista || jsonb_build_object('id', 'p:' || r.produto || ':' || r.qtd, 'valor', r.valor, 'qtd', r.qtd,
      'produto', r.produto, 'nome', r.nome, 'metodo', public.vant_quick_metodo(p_uid, v_sessao, r.valor, r.produto), 'fonte', 'produto');
    valores := valores || r.valor;
  end loop;

  -- 2. the values of today's DEFCON sales with no product, most used first
  if v_sessao is not null then
    for r in
      select round(ds.amount, 2) as valor, count(*) as usos, max(ds.created_at) as ultima
        from public.defcon_sales ds
       where ds.session_id = v_sessao and ds.user_id = p_uid and not ds.late and ds.product_id is null
         and ds.method in ('dinheiro','pix','cartao') and ds.amount > 0 and ds.amount <= 5000
       group by round(ds.amount, 2) order by usos desc, ultima desc
    loop
      exit when jsonb_array_length(lista) >= 3;
      continue when r.valor = any(valores);
      lista := lista || jsonb_build_object('id', 'v:' || (r.valor * 100)::bigint, 'valor', r.valor, 'qtd', 1,
        'produto', null, 'nome', null, 'metodo', public.vant_quick_metodo(p_uid, v_sessao, r.valor, null), 'fonte', 'historico');
      valores := valores || r.valor;
    end loop;
  end if;

  -- 3. the VANT Quick configuration
  select * into c from public.vant_quick_config where user_id = p_uid;
  if found and jsonb_array_length(lista) < 3 and not (round(c.valor, 2) = any(valores)) then
    lista := lista || jsonb_build_object('id', 'c', 'valor', round(c.valor, 2), 'qtd', 1, 'produto', null, 'nome', null,
      'metodo', c.metodo, 'fonte', 'config');
  end if;

  -- the label on each button: with more than one product among the options, the product's name
  -- tells them apart ("Trufa · 1 un"); with one, "1 unidade" / "2 unidades" (Rick's mockup)
  return (select coalesce(jsonb_agg(e || jsonb_build_object('rotulo',
            case when e ->> 'fonte' <> 'produto' then 'Venda rápida'
                 when (select count(distinct x ->> 'produto') from jsonb_array_elements(lista) x where x ->> 'fonte' = 'produto') > 1
                   then (e ->> 'nome') || ' · ' || (e ->> 'qtd') || ' un'
                 when (e ->> 'qtd')::int = 1 then '1 unidade'
                 else (e ->> 'qtd') || ' unidades' end) order by n), '[]'::jsonb)
            from jsonb_array_elements(lista) with ordinality as y(e, n));
end $$;
revoke all on function public.vant_quick_opcoes(uuid) from public, anon, authenticated;

-- The panel now carries the options. "rapida" stays for build 31 exactly as before: the VANT Quick
-- config, which is also the only thing a build-31 tap (no option, no price) can be charged.
create or replace function public.vant_quick_painel(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare s record; b record; c record; v_vendas integer; v_ab integer; v_bloco_inicio timestamptz; v_fat numeric; v_opcoes jsonb;
begin
  v_opcoes := public.vant_quick_opcoes(p_uid);
  select * into c from public.vant_quick_config where user_id = p_uid;
  select * into s from public.challenge_sessions
   where user_id = p_uid and date = (now() at time zone 'America/Sao_Paulo')::date;
  if not found then return jsonb_build_object('sessao', null, 'opcoes', v_opcoes); end if;
  select count(*) filter (where not late and coalesce(method,'') <> 'gorjeta') into v_vendas from public.defcon_sales where session_id = s.id;
  select v_vendas + count(*) into v_ab from public.defcon_abordagens where session_id = s.id;
  select hb.* into b from public.hourly_goal_blocks hb where hb.id = public.defcon_bloco_do_plano(s.id, s.current_block_index);
  v_bloco_inicio := b.timer_started_at;
  -- the same total the DEFCON screen shows: the plan's hour blocks (cash, card, Pix, calote)
  select coalesce(round(sum(coalesce(hb.valor_dinheiro,0) + coalesce(hb.valor_cartao,0) + coalesce(hb.valor_pix,0) + coalesce(hb.valor_calote,0)), 2), 0)
    into v_fat from public.daily_goal_plans p join public.hourly_goal_blocks hb on hb.plan_id = p.id
   where p.user_id = p_uid and p.date = s.date;
  return jsonb_build_object(
    'sessao', s.id, 'data', s.date, 'estado', s.status, 'servidor', s.totais_servidor,
    'faturamento', v_fat, 'meta', s.daily_goal,
    'restante', greatest(0, round(s.daily_goal - v_fat, 2)),
    'progresso', case when s.daily_goal > 0 then least(1, round(v_fat / s.daily_goal, 4)) else 0 end,
    'vendas', v_vendas, 'abordagens', v_ab,
    'conversao', case when v_ab > 0 then round(v_vendas::numeric / v_ab, 4) end,
    'bloco', s.current_block_index + 1, 'totalBlocos', s.total_blocks,
    'blocoEstado', b.timer_status,
    'blocoInicio', v_bloco_inicio, 'blocoFim', v_bloco_inicio + interval '1 hour',
    'opcoes', v_opcoes,
    'rapida', case when c.user_id is null then null else jsonb_build_object('valor', c.valor, 'metodo', c.metodo) end);
end $$;
revoke all on function public.vant_quick_painel(uuid) from public, anon, authenticated;

-- The executor, now with the option of the tap. Same rules and order as before (20261128140000 +
-- the block of 20261128160000); only the sale's price/product/quantity/method source changed.
drop function if exists public.vant_quick_executar(text, text, uuid, text);
create or replace function public.vant_quick_executar(p_token text, p_acao text, p_id uuid default null, p_origem text default 'widget',
  p_opcao text default null, p_valor numeric default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare cr record; s record; b record; o jsonb; v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
        lim record; r jsonb;
begin
  if p_acao not in ('venda','abordagem','painel','status') then return jsonb_build_object('ok', false, 'motivo', 'acao_invalida'); end if;
  if p_origem not in ('widget','atividade') then return jsonb_build_object('ok', false, 'motivo', 'origem_invalida'); end if;
  if p_token is null or p_token !~ '^vq1_[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'motivo', 'credencial_invalida'); end if;

  select * into cr from public.vant_quick_credenciais where hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or cr.revogado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'credencial_invalida'); end if;
  if cr.expira_em <= now() then return jsonb_build_object('ok', false, 'motivo', 'credencial_expirada'); end if;
  if public.vant_quick_bloqueada(cr.user_id) then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;

  if p_acao = 'painel' then    -- reading never counts against the usage limits
    return jsonb_build_object('ok', true, 'painel', public.vant_quick_painel(cr.user_id));
  end if;
  if p_id is null then return jsonb_build_object('ok', false, 'motivo', 'id_obrigatorio'); end if;
  -- the same tap id is handled one request at a time (a late original vs. the status question)
  perform pg_advisory_xact_lock(hashtextextended('vant_quick:' || p_id::text, 0));

  if p_acao = 'status' then    -- never counts against the limits, never writes a sale
    if exists (select 1 from public.defcon_sales where id = p_id and user_id = cr.user_id)
       or exists (select 1 from public.defcon_abordagens where id = p_id and user_id = cr.user_id) then
      return jsonb_build_object('ok', true, 'existe', true, 'painel', public.vant_quick_painel(cr.user_id));
    end if;
    insert into public.defcon_ids_encerrados (id, user_id, motivo) values (p_id, cr.user_id, 'consultada_sem_registro')
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'existe', false, 'painel', public.vant_quick_painel(cr.user_id));
  end if;

  if not coalesce((select vant_quick from public.defcon_persistencia_config), false) then
    return jsonb_build_object('ok', false, 'motivo', 'desativado');
  end if;
  -- a resend of a tap already applied answers what happened, without counting the use again
  if exists (select 1 from public.defcon_sales where id = p_id and user_id = cr.user_id)
     or exists (select 1 from public.defcon_abordagens where id = p_id and user_id = cr.user_id) then
    return jsonb_build_object('ok', true, 'aplicado', false, 'repetido', true, 'painel', public.vant_quick_painel(cr.user_id));
  end if;
  -- the iPhone was already told "not registered" for this id (status): it stays that way
  if exists (select 1 from public.defcon_ids_encerrados where id = p_id) then
    return jsonb_build_object('ok', false, 'motivo', 'encerrada');
  end if;

  lim := public.vant_quick_limites();
  if cr.ultimo_uso_em is not null and now() - cr.ultimo_uso_em < make_interval(secs => lim.intervalo_ms / 1000.0) then
    return jsonb_build_object('ok', false, 'motivo', 'rapido_demais');
  end if;
  if cr.uso_dia = v_dia and cr.usos_no_dia >= lim.por_dia then
    return jsonb_build_object('ok', false, 'motivo', 'limite_do_dia');
  end if;

  select * into s from public.challenge_sessions where user_id = cr.user_id and date = v_dia for update;
  if not found or s.status <> 'active' then return jsonb_build_object('ok', false, 'motivo', 'sem_defcon'); end if;
  if not s.totais_servidor then return jsonb_build_object('ok', false, 'motivo', 'defcon_nao_habilitado'); end if;
  -- an old build wrote to this session: two writers counting at once could diverge (ADR 0001 §7.1)
  if s.cliente_antigo_em is not null then return jsonb_build_object('ok', false, 'motivo', 'atualize_outro_aparelho'); end if;
  select hb.* into b from public.hourly_goal_blocks hb where hb.id = public.defcon_bloco_do_plano(s.id, s.current_block_index);
  if not found or coalesce(b.timer_status, '') <> 'running' then return jsonb_build_object('ok', false, 'motivo', 'bloco_parado'); end if;

  if p_acao = 'venda' then
    -- the option the button showed, rebuilt here: never a price, product or method from the phone.
    --  - an option id: that option (V2 widget / lock screen);
    --  - no id but a price (a V2 lock screen drawn before the list arrived): the first option, if its
    --    price is the one drawn (checked below);
    --  - neither (build 31): the VANT Quick config only, the value its button shows ("rapida")
    select e into o from jsonb_array_elements(public.vant_quick_opcoes(cr.user_id)) with ordinality as x(e, n)
     where case when p_opcao is not null then e ->> 'id' = p_opcao
                when p_valor is not null then true
                else e ->> 'fonte' = 'config' end
     order by n limit 1;
    -- build 31 with a config whose value is also a product's or today's price (so it is not listed
    -- as its own option): the config itself, never the product or another value
    if o is null and p_opcao is null and p_valor is null then
      select jsonb_build_object('id', 'c', 'valor', round(q.valor, 2), 'qtd', 1, 'produto', null, 'metodo', q.metodo, 'fonte', 'config')
        into o from public.vant_quick_config q where q.user_id = cr.user_id;
    end if;
    if o is null then
      return jsonb_build_object('ok', false, 'motivo', case when p_opcao is null then 'sem_valor' else 'opcao_indisponivel' end,
                                'painel', public.vant_quick_painel(cr.user_id));
    end if;
    if p_valor is not null and abs((o ->> 'valor')::numeric - p_valor) >= 0.005 then
      return jsonb_build_object('ok', false, 'motivo', 'opcao_mudou', 'painel', public.vant_quick_painel(cr.user_id));
    end if;
    r := public.defcon_lancar_conta(cr.user_id, p_id, 'venda', s.id, s.current_block_index, (o ->> 'valor')::numeric, o ->> 'metodo',
                                    nullif(o ->> 'produto', '')::uuid, (o ->> 'qtd')::numeric, null, p_origem);
  else
    r := public.defcon_lancar_conta(cr.user_id, p_id, 'abordagem', s.id, s.current_block_index, null, null, null, null, null, p_origem);
  end if;

  update public.vant_quick_credenciais
     set ultimo_uso_em = now(),
         usos_no_dia = case when uso_dia = v_dia then usos_no_dia + 1 else 1 end, uso_dia = v_dia
   where id = cr.id;
  return jsonb_build_object('ok', true, 'aplicado', (r ->> 'aplicado')::boolean, 'painel', public.vant_quick_painel(cr.user_id));
end $$;
revoke all on function public.vant_quick_executar(text, text, uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.vant_quick_executar(text, text, uuid, text, text, numeric) to service_role;
