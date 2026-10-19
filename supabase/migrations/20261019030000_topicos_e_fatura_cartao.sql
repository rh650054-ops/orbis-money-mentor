-- Rick, 18/10/2026:
-- 1) "Outros" com nome: o vendedor cria a própria categoria (tópico) e ela ganha
--    barra de progresso em "Onde você gastou" (com teto opcional).
-- 2) Fatura do cartão de crédito (lida pelo Open Finance) entra sozinha na aba Contas.

-- ============ 1) categorias do próprio vendedor ============
alter table public.extrato_categorias
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists criado_em timestamptz default now();
create index if not exists extrato_categorias_user_idx on public.extrato_categorias(user_id) where user_id is not null;

-- cada um só vê as globais e as suas (as funções que listam categorias são invoker)
alter policy extrato_cat_sel on public.extrato_categorias
  using (user_id is null or user_id = auth.uid());

create or replace function public.extrato_categoria_criar(p_nome text, p_teto numeric default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_norm text;
  v_slug text;
  v_rotulo text;
begin
  if u is null then raise exception 'login necessario'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 30 then raise exception 'nome invalido'; end if;
  v_norm := public.extrato_norm(v_nome);
  if v_norm = '' then raise exception 'nome invalido'; end if;

  -- já existe (global ou dele) com esse nome? usa a mesma
  select c.slug, c.rotulo into v_slug, v_rotulo from public.extrato_categorias c
   where c.tipo = 'saida' and (c.user_id is null or c.user_id = u)
     and public.extrato_norm(c.rotulo) = v_norm
   order by c.user_id nulls first limit 1;

  if v_slug is null then
    if (select count(*) from public.extrato_categorias where user_id = u) >= 30 then
      raise exception 'limite de categorias';
    end if;
    v_slug := 'u_' || left(md5(u::text || v_norm), 12);
    v_rotulo := upper(left(v_nome, 1)) || substr(v_nome, 2);
    insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem, user_id)
    values (v_slug, v_rotulo, null, 'pessoal', 'saida', 900, u)
    on conflict (slug) do nothing;
  end if;

  if coalesce(p_teto, 0) > 0 and v_slug not in ('transferencia_propria', 'fatura_cartao', 'nao_identificado') then
    insert into public.financas_tetos (user_id, categoria, valor)
    values (u, v_slug, round(p_teto, 2))
    on conflict (user_id, categoria) do update set valor = excluded.valor, atualizado_em = now();
  end if;
  return jsonb_build_object('slug', v_slug, 'rotulo', v_rotulo);
end $function$;
revoke all on function public.extrato_categoria_criar(text, numeric) from public, anon;
grant execute on function public.extrato_categoria_criar(text, numeric) to authenticated;

-- ============ 2) fatura do cartão → aba Contas ============
alter table public.planned_bills add column if not exists cartao_conta_id text;
create unique index if not exists planned_bills_cartao_uidx on public.planned_bills(user_id, cartao_conta_id) where cartao_conta_id is not null;
alter table public.bank_cartoes add column if not exists conta_dispensada boolean not null default false;

-- Uma conta por cartão: o valor e o vencimento acompanham o banco; o nome, o risco e
-- o "paguei" continuam do vendedor. Cartão que ele já tinha cadastrado na mão é ligado,
-- não duplicado. Apagou a conta? Não volta (conta_dispensada).
create or replace function public.cartao_sincronizar_conta(p_conta_id text)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  c record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_vence date;
  v_nome text;
  v_bill uuid;
  v_primeira text;
begin
  select * into c from public.bank_cartoes where conta_id = p_conta_id;
  if not found or c.conta_dispensada or c.fatura is null then return; end if;
  -- só cartão de conexão viva
  if not exists (select 1 from public.bank_connections bc where bc.id = c.bank_connection_id and coalesce(bc.status, '') <> 'deleted') then return; end if;

  -- o banco às vezes manda o vencimento da fatura passada: rola pro próximo mês
  v_vence := c.vence;
  if v_vence is not null then
    while v_vence < hoje - 3 loop v_vence := (v_vence + interval '1 month')::date; end loop;
  end if;

  select id into v_bill from public.planned_bills where user_id = c.user_id and cartao_conta_id = p_conta_id;
  if v_bill is null then
    -- cartão que ele já tinha cadastrado na mão com o nome do banco
    v_primeira := split_part(public.extrato_norm(coalesce(c.banco, '')), ' ', 1);
    if char_length(v_primeira) >= 2 then
      select b.id into v_bill from public.planned_bills b
       where b.user_id = c.user_id and b.is_credit_card and b.cartao_conta_id is null
         and public.extrato_norm(b.name) like '%' || v_primeira || '%'
       order by b.created_at limit 1;
    end if;
    if v_bill is not null then
      update public.planned_bills set cartao_conta_id = p_conta_id where id = v_bill;
    end if;
  end if;

  if v_bill is null then
    if c.fatura <= 0 then return; end if;   -- cartão zerado não vira conta nova
    v_nome := 'Fatura ' || coalesce(nullif(trim(c.banco), ''), 'cartão');
    if (select count(*) from public.bank_cartoes x where x.user_id = c.user_id and x.banco is not distinct from c.banco and not x.conta_dispensada) > 1
       and coalesce(c.nome, '') <> '' then
      v_nome := v_nome || ' ' || c.nome;
    end if;
    insert into public.planned_bills (user_id, name, amount, due_date, recurring, is_credit_card, cartao_conta_id)
    values (c.user_id, left(v_nome, 60), round(c.fatura, 2), v_vence, true, true, p_conta_id);
  else
    update public.planned_bills
       set amount = round(c.fatura, 2), due_date = coalesce(v_vence, due_date), is_credit_card = true,
           recurring = true, updated_at = now()
     where id = v_bill
       and (amount is distinct from round(c.fatura, 2) or due_date is distinct from coalesce(v_vence, due_date));
  end if;
end $function$;
revoke all on function public.cartao_sincronizar_conta(text) from public, anon, authenticated;

create or replace function public.bank_cartoes_virar_conta()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  perform public.cartao_sincronizar_conta(new.conta_id);
  return null;
exception when others then
  raise warning 'cartao_sincronizar_conta %: %', new.conta_id, sqlerrm;  -- nunca derruba a leitura do banco
  return null;
end $function$;

create or replace function public.planned_bills_cartao_apagada()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.bank_cartoes set conta_dispensada = true
   where conta_id = old.cartao_conta_id and user_id = old.user_id;
  return null;
end $function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'bank_cartoes_virar_conta') then
    create trigger bank_cartoes_virar_conta after insert or update of fatura, vence on public.bank_cartoes
      for each row execute function public.bank_cartoes_virar_conta();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'planned_bills_cartao_apagada') then
    create trigger planned_bills_cartao_apagada after delete on public.planned_bills
      for each row when (old.cartao_conta_id is not null) execute function public.planned_bills_cartao_apagada();
  end if;
end $$;

-- cartões que já estão no banco entram agora
do $$
declare r record;
begin
  for r in select conta_id from public.bank_cartoes loop
    perform public.cartao_sincronizar_conta(r.conta_id);
  end loop;
end $$;
