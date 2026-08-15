-- PROBLEMA: quem compra na Hotmart ANTES de criar a conta no Orbis ficava no limbo.
-- O webhook até guardava a compra órfã em unlinked_purchases, mas NINGUÉM nunca
-- reivindicava: a pessoa se cadastrava depois e continuava como não-pagante.
-- (Aplicada em produção em 15/08/2026 via mcp apply_migration; este arquivo é o
-- registro no repositório.)
--
-- SOLUÇÃO em duas partes:
--  1) orbis_achar_usuario(email, cpf): busca unificada (CPF no perfil, e-mail no
--     perfil E no login), sem diferenciar maiúsculas — usada pelo hotmart-webhook v16.
--  2) Gatilho em profiles: no cadastro (ou quando o e-mail/CPF do perfil muda),
--     procura compra aprovada órfã com aquele e-mail/CPF e ativa na hora.

create or replace function public.orbis_achar_usuario(p_email text, p_cpf text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
        v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if v_cpf <> '' then
    select user_id into v_id from public.profiles where regexp_replace(coalesce(cpf,''), '\D', '', 'g') = v_cpf limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  if v_email <> '' then
    select user_id into v_id from public.profiles where lower(btrim(coalesce(email,''))) = v_email limit 1;
    if v_id is not null then return v_id; end if;
    select id into v_id from auth.users where lower(email) = v_email limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  return null;
end $$;

create or replace function public.reivindicar_compras_hotmart()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare compra record;
        v_email text := lower(btrim(coalesce(new.email, '')));
        v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
begin
  if v_email = '' and v_cpf = '' then return new; end if;

  select * into compra from public.unlinked_purchases
   where linked_at is null
     and (upper(coalesce(event_type,'')) like '%PURCHASE_APPROVED%'
       or upper(coalesce(event_type,'')) like '%PURCHASE_COMPLETE%'
       or upper(coalesce(event_type,'')) like '%SUBSCRIPTION_RENEWAL%')
     and ((v_email <> '' and lower(btrim(coalesce(buyer_email,''))) = v_email)
       or (v_cpf <> '' and regexp_replace(coalesce(buyer_cpf,''), '\D', '', 'g') = v_cpf))
   order by created_at desc limit 1;

  if compra.id is null then return new; end if;

  insert into public.subscriptions (user_id, provider, status, current_period_end, grace_until,
                                    hotmart_purchase_id, hotmart_subscription_id, last_event_at)
  values (new.user_id, 'hotmart', 'active', now() + interval '30 days', now() + interval '33 days',
          compra.hotmart_purchase_id, compra.hotmart_subscription_id, now())
  on conflict (user_id) do update
    set status='active', current_period_end=excluded.current_period_end,
        grace_until=excluded.grace_until, hotmart_purchase_id=excluded.hotmart_purchase_id,
        hotmart_subscription_id=excluded.hotmart_subscription_id, last_event_at=now(), updated_at=now();

  update public.unlinked_purchases set linked_at=now(), linked_to_user_id=new.user_id where id = compra.id;

  new.plan_status := 'active';
  new.is_trial_active := false;
  return new;
end $$;

drop trigger if exists trg_reivindicar_compras on public.profiles;
create trigger trg_reivindicar_compras
  before insert or update of email, cpf on public.profiles
  for each row execute function public.reivindicar_compras_hotmart();
