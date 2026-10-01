-- Caixa da Vant, parte 2 (30/09/2026): o saldo acompanha a Hotmart sozinho.
-- 1) Toda venda aprovada depois da abertura entra no caixa com o LIQUIDO do produtor
--    (comissao PRODUCER do payload = o que cai no saldo da Hotmart). Reembolso e
--    chargeback saem. O gatilho nunca derruba o webhook de pagamento.
-- 2) O saldo inicial vira um "ajuste" de abertura (nao conta como "entrou no mes").
-- 3) Corrigir saldo registra "de X para Y — motivo" e exige motivo.
-- 4) "Atualizar com a Hotmart": guarda disponivel/a receber e, se pedir, ajusta o caixa.

insert into public.caixa_config (chave, valor) values
  ('aberto_em', to_jsonb(now())),
  ('hotmart_disponivel', '74.84'::jsonb),
  ('hotmart_atualizado_em', to_jsonb(now()))
on conflict (chave) do nothing;

update public.caixa_lancamentos set tipo = 'ajuste', categoria = 'saldo_inicial'
 where chave_externa = 'inicial:hotmart:2026-09-30' and tipo <> 'ajuste';

create or replace function public.caixa_brl(v numeric) returns text
language sql immutable as $$
  select 'R$ ' || translate(to_char(v, 'FM999G999G990D00'), ',.', '.,')
$$;

create or replace function public.caixa_ajustar_saldo(p_novo_saldo numeric, p_motivo text)
returns numeric language plpgsql security invoker as $$
declare v_atual numeric; v_dif numeric;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  if p_novo_saldo is null or abs(p_novo_saldo) > 100000000 then raise exception 'valor invalido'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'diga o motivo'; end if;
  select coalesce(sum(valor), 0) into v_atual from public.caixa_lancamentos where status = 'pago' and afeta_saldo;
  v_dif := round(p_novo_saldo - v_atual, 2);
  if v_dif = 0 then return v_atual; end if;
  insert into public.caixa_lancamentos (tipo, valor, descricao, categoria, origem, status, criado_por)
    values ('ajuste', v_dif, left(format('Saldo de %s para %s — %s', public.caixa_brl(v_atual), public.caixa_brl(p_novo_saldo), trim(p_motivo)), 200),
            'ajuste', 'ajuste', 'pago', auth.uid());
  return p_novo_saldo;
end $$;
grant execute on function public.caixa_ajustar_saldo(numeric, text) to authenticated;

create or replace function public.caixa_sync_hotmart(p_disponivel numeric, p_receber numeric, p_ajustar boolean)
returns numeric language plpgsql security invoker as $$
declare v_dif numeric := 0; v_antes numeric;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  if p_disponivel is null or p_receber is null or p_disponivel < 0 or p_receber < 0 then raise exception 'valores invalidos'; end if;
  insert into public.caixa_config (chave, valor, atualizado_por, atualizado_em) values
    ('hotmart_disponivel', to_jsonb(round(p_disponivel, 2)), auth.uid(), now()),
    ('hotmart_a_receber', to_jsonb(round(p_receber, 2)), auth.uid(), now()),
    ('hotmart_atualizado_em', to_jsonb(now()), auth.uid(), now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
  if p_ajustar then
    select coalesce(sum(valor), 0) into v_antes from public.caixa_lancamentos where status = 'pago' and afeta_saldo;
    perform public.caixa_ajustar_saldo(p_disponivel + p_receber, 'bater com a Hotmart (' || public.caixa_brl(p_disponivel) || ' disponível + ' || public.caixa_brl(p_receber) || ' a receber)');
    v_dif := round(p_disponivel + p_receber - v_antes, 2);
  end if;
  return v_dif;
end $$;
grant execute on function public.caixa_sync_hotmart(numeric, numeric, boolean) to authenticated;

create or replace function public.caixa_hotmart_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_abertura timestamptz; v_liq numeric; v_tx text;
begin
  select (valor #>> '{}')::timestamptz into v_abertura from public.caixa_config where chave = 'aberto_em';
  if v_abertura is null or new.recebido_em < v_abertura then return new; end if;
  if new.event_type not in ('PURCHASE_APPROVED','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') then return new; end if;
  select sum((c->>'value')::numeric) into v_liq
    from jsonb_array_elements(case when jsonb_typeof(new.payload->'data'->'commissions') = 'array'
                                   then new.payload->'data'->'commissions' else '[]'::jsonb end) c
   where c->>'source' = 'PRODUCER';
  if v_liq is null and new.valor is not null then v_liq := round(new.valor * 0.851 - 1, 2); end if; -- taxa real observada: 14,9% + R$ 1
  if v_liq is null or v_liq <= 0 then return new; end if;
  v_tx := coalesce(new.purchase_id, new.event_id::text);
  if new.event_type = 'PURCHASE_APPROVED' then
    insert into public.caixa_lancamentos (data, tipo, valor, descricao, categoria, origem, status, chave_externa, obs)
    values ((new.recebido_em at time zone 'America/Sao_Paulo')::date, 'entrada', v_liq,
            case when coalesce(new.eh_renovacao, false) then 'Renovação' else 'Assinatura nova' end || ' — Hotmart ' || v_tx,
            'vendas_hotmart', 'hotmart', 'pago', 'hotmart:' || v_tx || ':ok',
            'Líquido do produtor. Venda de ' || public.caixa_brl(coalesce(new.valor, 0)) || '.')
    on conflict (chave_externa) do nothing;
  else
    insert into public.caixa_lancamentos (data, tipo, valor, descricao, categoria, origem, status, chave_externa)
    values ((new.recebido_em at time zone 'America/Sao_Paulo')::date, 'saida', -v_liq,
            case when new.event_type = 'PURCHASE_CHARGEBACK' then 'Chargeback' else 'Reembolso' end || ' — Hotmart ' || v_tx,
            'estornos', 'hotmart', 'pago', 'hotmart:' || v_tx || ':estorno')
    on conflict (chave_externa) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'caixa_hotmart_evento: %', sqlerrm;  -- nunca derruba o webhook de pagamento
  return new;
end $$;
drop trigger if exists caixa_hotmart on public.hotmart_eventos;
create trigger caixa_hotmart after insert on public.hotmart_eventos for each row execute function public.caixa_hotmart_evento();

-- Resumo: "entrou" agora e so dinheiro novo (vendas, aportes); abertura e ajustes ficam de fora.
-- Novos campos: vendas do mes (qtd/liquido), assinantes ativos e novos no mes (pra projecao e CAC).
create or replace function public.caixa_vendas(p_mes date default null)
returns jsonb language plpgsql security invoker stable as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_mes, v_hoje))::date;
  v_fim date := (v_ini + interval '1 month')::date;
  v_ab timestamptz;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  select (valor #>> '{}')::timestamptz into v_ab from public.caixa_config where chave = 'aberto_em';
  return jsonb_build_object(
    'qtd', (select count(*) from public.caixa_lancamentos where categoria = 'vendas_hotmart' and data >= v_ini and data < v_fim),
    'liquido', (select coalesce(sum(valor), 0) from public.caixa_lancamentos where categoria = 'vendas_hotmart' and data >= v_ini and data < v_fim),
    'estornos', (select coalesce(-sum(valor), 0) from public.caixa_lancamentos where categoria = 'estornos' and data >= v_ini and data < v_fim),
    'aberto_em', v_ab,
    'assinantes', (select public.caixa_assinantes_ativos()),
    'liquido_medio', (select coalesce(round(avg(valor), 2), 24.45) from public.caixa_lancamentos where categoria = 'vendas_hotmart'));
end $$;

create or replace function public.caixa_assinantes_ativos() returns int
language sql stable security definer set search_path = public as $$
  select case when public.caixa_eh_socio() then (select count(*)::int from public.subscriptions where status = 'active') else null end
$$;
grant execute on function public.caixa_vendas(date), public.caixa_assinantes_ativos() to authenticated;
revoke execute on function public.caixa_assinantes_ativos() from anon;
