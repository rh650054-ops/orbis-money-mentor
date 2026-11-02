-- 02/11/2026 (Rick: "essa fatura não é desse mês, é do mês que vem e está atrapalhando").
-- He paid the C6 invoice due 01/11 on 23/10. The payment was stamped as cycle 2026-10 (the
-- month it was PAID), so on 01/11 the invoice looked unpaid → "Contas vencidas R$ 491".
-- Card invoices now belong to their due date's month; the window starts after the payment
-- already used for the previous invoice. Other bills keep the calendar-month rule.

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
  v_ciclo text;
begin
  if p_uid is null then return 0; end if;
  for b in
    select pb.* from public.planned_bills pb
     where pb.user_id = p_uid and coalesce(pb.amount, 0) > 0 and pb.emprestimo_id is null and not pb.paid
       and (case when pb.recurring then
                   coalesce(pb.paid_cycle, '') <> (case when pb.cartao_conta_id is not null and pb.due_date is not null then to_char(pb.due_date, 'YYYY-MM') else ciclo end)
                   and coalesce(pb.pago_auto_recusado, '') <> (case when pb.cartao_conta_id is not null and pb.due_date is not null then to_char(pb.due_date, 'YYYY-MM') else ciclo end)
                 else pb.due_date between hoje - 45 and hoje + 35 and coalesce(pb.pago_auto_recusado, '') <> 'unico' end)
  loop
    -- 02/11: a card invoice paid BEFORE its due date belongs to that due date's month
    -- (paid on 23/10 the invoice due 01/11 → cycle 2026-11, not 2026-10), and a payment
    -- already used for the previous invoice never pays the next one.
    v_ciclo := case when b.cartao_conta_id is not null and b.due_date is not null then to_char(b.due_date, 'YYYY-MM') else ciclo end;
    v_de := case when b.cartao_conta_id is not null and b.due_date is not null
                   then greatest(b.due_date - 35, coalesce((b.pago_pelo_banco->>'data')::date + 1, b.due_date - 35))
                 when b.recurring then (date_trunc('month', hoje)::date - 3) else b.due_date - 35 end;

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
         set paid_cycle = v_ciclo, cycles_paid = v_ciclos, saved_amount = 0,
             paid = (b.duration_months is not null and v_ciclos >= b.duration_months),
             pago_pelo_banco = jsonb_build_object('ciclo', v_ciclo, 'valor', round(v_soma, 2), 'data', v_data, 'banco', v_banco, 'em', now()),
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

-- invoices already paid early but stamped with the payment month: move them to the due month
-- (two steps so the "user undid it" trigger doesn't take it as a manual undo)
update public.planned_bills b
   set pago_pelo_banco = jsonb_set(b.pago_pelo_banco, '{ciclo}', to_jsonb(to_char(b.due_date, 'YYYY-MM')))
 where b.cartao_conta_id is not null and b.recurring and b.due_date is not null
   and b.pago_pelo_banco is not null and b.paid_cycle = b.pago_pelo_banco->>'ciclo'
   and (b.pago_pelo_banco->>'data')::date between b.due_date - 35 and b.due_date
   and b.paid_cycle <> to_char(b.due_date, 'YYYY-MM');
update public.planned_bills b
   set paid_cycle = b.pago_pelo_banco->>'ciclo'
 where b.cartao_conta_id is not null and b.recurring and b.pago_pelo_banco is not null
   and b.paid_cycle is distinct from b.pago_pelo_banco->>'ciclo'
   and b.pago_pelo_banco->>'ciclo' = to_char(b.due_date, 'YYYY-MM');
