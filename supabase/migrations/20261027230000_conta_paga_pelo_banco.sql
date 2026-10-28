-- Rick, 27/10/2026: "paguei o boleto da Claro → no app já consta como pago".
-- Quando o Open Finance traz uma saída que bate com uma conta da aba Contas
-- (nome da conta no extrato + valor que fecha a conta), a conta fica paga no mês.
-- Regras (conservadoras: na dúvida, continua no "Paguei" manual):
--   • o nome da conta precisa aparecer no extrato (palavra inteira), ou ser o
--     emissor conhecido (Nubank = "NU PAGAMENTOS", Riachuelo = "MIDWAY"...),
--     ou ser a fatura de um cartão ligado com "pagamento de fatura" no mesmo banco;
--   • a soma das saídas que batem no mês tem que fechar ≥ 90% do valor da conta;
--   • gasto de consumo (mercado, delivery, Uber, posto, saque, entre contas...) nunca paga conta;
--   • Pix crédito / empréstimo já se pagam sozinhos pelas parcelas (fica de fora);
--   • desmarcou uma conta paga pelo banco? Naquele mês a Vant não marca de novo.

alter table public.planned_bills
  add column if not exists pago_pelo_banco jsonb,
  add column if not exists pago_auto_recusado text;

create or replace function public.contas_pagas_pelo_banco(p_uid uuid)
returns int
language plpgsql security definer set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ciclo text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
  b record;
  v_de date;
  v_tokens text[];
  v_banco_cartao text;
  v_soma numeric;
  v_data date;
  v_banco text;
  v_n int := 0;
  v_ciclos int;
begin
  if p_uid is null then return 0; end if;
  for b in
    select pb.* from public.planned_bills pb
     where pb.user_id = p_uid and coalesce(pb.amount, 0) > 0 and pb.emprestimo_id is null and not pb.paid
       and (case when pb.recurring then coalesce(pb.paid_cycle, '') <> ciclo and coalesce(pb.pago_auto_recusado, '') <> ciclo
                 else pb.due_date between hoje - 45 and hoje + 35 and coalesce(pb.pago_auto_recusado, '') <> 'unico' end)
  loop
    v_de := case when b.recurring then (date_trunc('month', hoje)::date - 3) else b.due_date - 35 end;

    -- palavras do nome da conta que identificam quem recebe
    select coalesce(array_agg(distinct w), '{}') into v_tokens
      from unnest(string_to_array(public.extrato_norm(b.name), ' ')) w
     where char_length(w) >= 3
       and w not in ('CREDITO','CARTAO','CONTA','CONTAS','FATURA','PAGAMENTO','BOLETO','MENSAL','MENSALIDADE',
                     'MEU','MINHA','DOS','DAS','COM','PARA','PRA','CASA','DEBITO','PARCELA','PARCELAS','BUSSINES','BUSINESS',
                     'EMPRESAS','EMPRESA','GOLD','PLATINUM','BLACK','INTERNET','CELULAR','LUZ','AGUA','GAS','BANCO','BANK','PIX','CPF','CNPJ');
    -- emissores conhecidos
    v_tokens := v_tokens
      || case when 'NUBANK' = any(v_tokens) then array['NU PAGAMENTOS','NU FINANCEIRA'] else '{}' end
      || case when 'RIACHUELO' = any(v_tokens) then array['MIDWAY'] else '{}' end
      || case when 'RENNER' = any(v_tokens) then array['REALIZE'] else '{}' end
      || case when 'INFINITY' = any(v_tokens) or 'INFINITYPAY' = any(v_tokens) or 'INFINITEPAY' = any(v_tokens) then array['INFINITE','INFINITEPAY','CLOUDWALK'] else '{}' end
      || case when public.extrato_norm(b.name) ~ '(^| )(MEI|DAS)( |$)' then array['RECEITA FEDERAL','SIMPLES NACIONAL','PGMEI','DAS MEI'] else '{}' end;

    -- fatura de cartão ligado: vale o "pagamento de fatura" saindo do próprio banco do cartão.
    -- Pagamento vindo de outro banco (Itaú → NU PAGAMENTOS) só conta se ele tem um cartão só
    -- daquele emissor; com dois (Nubank e Nubank Empresas) não dá pra saber qual foi pago.
    v_banco_cartao := null;
    if b.cartao_conta_id is not null then
      select public.extrato_norm(c.banco) into v_banco_cartao from public.bank_cartoes c where c.conta_id = b.cartao_conta_id;
      if (select count(*) from public.bank_cartoes x where x.user_id = p_uid and not x.conta_dispensada
            and split_part(public.extrato_norm(x.banco), ' ', 1) = split_part(v_banco_cartao, ' ', 1)) > 1 then
        v_tokens := '{}';
      end if;
    end if;
    if coalesce(array_length(v_tokens, 1), 0) = 0 and v_banco_cartao is null then continue; end if;

    with bate as (
      select l.id, l.data, l.valor, l.banco, l.descricao
        from public.extrato_lancamentos l
       where l.user_id = p_uid and l.tipo = 'saida' and not coalesce(l.do_cartao, false)
         and l.data between v_de and hoje
         and l.categoria not in ('mercado','delivery','restaurante','transporte_app','combustivel','onibus','apostas','saque',
                                 'transferencia_propria','mercadoria','insumos','roupas','farmacia','lazer','compras_debito')
         and (
           exists (select 1 from unnest(v_tokens) t
                    where (' ' || public.extrato_norm(coalesce(l.descricao, '') || ' ' || coalesce(l.comerciante, '')) || ' ')
                          like '% ' || t || ' %')
           or (v_banco_cartao is not null and l.categoria = 'fatura_cartao'
               and public.extrato_norm(coalesce(l.banco, '')) = v_banco_cartao)
         )
    )
    select coalesce(sum(valor), 0), (array_agg(data order by data desc))[1], (array_agg(banco order by data desc))[1]
      into v_soma, v_data, v_banco from bate;
    if v_soma < b.amount * 0.9 then continue; end if;

    if b.recurring then
      v_ciclos := coalesce(b.cycles_paid, 0) + 1;
      update public.planned_bills
         set paid_cycle = ciclo, cycles_paid = v_ciclos, saved_amount = 0,
             paid = (b.duration_months is not null and v_ciclos >= b.duration_months),
             pago_pelo_banco = jsonb_build_object('ciclo', ciclo, 'valor', round(v_soma, 2), 'data', v_data, 'banco', v_banco, 'em', now()),
             updated_at = now()
       where id = b.id;
    else
      update public.planned_bills
         set paid = true,
             pago_pelo_banco = jsonb_build_object('ciclo', 'unico', 'valor', round(v_soma, 2), 'data', v_data, 'banco', v_banco, 'em', now()),
             updated_at = now()
       where id = b.id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;
revoke all on function public.contas_pagas_pelo_banco(uuid) from public, anon, authenticated;

-- o vendedor desmarcou uma conta que a Vant marcou: respeita naquele mês
create or replace function public.planned_bills_desfez_pago_banco()
returns trigger language plpgsql as $function$
begin
  if old.pago_pelo_banco is not null then
    if old.recurring and old.paid_cycle = (old.pago_pelo_banco->>'ciclo') and new.paid_cycle is distinct from old.paid_cycle then
      new.pago_auto_recusado := old.paid_cycle;
      new.pago_pelo_banco := null;
    elsif not old.recurring and old.paid and not new.paid then
      new.pago_auto_recusado := 'unico';
      new.pago_pelo_banco := null;
    end if;
  end if;
  return new;
end $function$;

-- toda leitura do banco (e todo extrato em PDF) que traz saída nova confere as contas
create or replace function public.extrato_conferir_contas()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare r record;
begin
  for r in select distinct user_id from novas where tipo = 'saida' loop
    begin
      perform public.contas_pagas_pelo_banco(r.user_id);
    exception when others then
      raise warning 'contas_pagas_pelo_banco %: %', r.user_id, sqlerrm;  -- nunca derruba a leitura do banco
    end;
  end loop;
  return null;
end $function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'planned_bills_desfez_pago_banco') then
    create trigger planned_bills_desfez_pago_banco before update on public.planned_bills
      for each row execute function public.planned_bills_desfez_pago_banco();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'extrato_conferir_contas') then
    create trigger extrato_conferir_contas after insert on public.extrato_lancamentos
      referencing new table as novas for each statement execute function public.extrato_conferir_contas();
  end if;
end $$;

-- o que já foi pago neste mês e já está no extrato entra agora
do $$
declare r record;
begin
  for r in select distinct user_id from public.planned_bills where coalesce(amount, 0) > 0 loop
    perform public.contas_pagas_pelo_banco(r.user_id);
  end loop;
end $$;
