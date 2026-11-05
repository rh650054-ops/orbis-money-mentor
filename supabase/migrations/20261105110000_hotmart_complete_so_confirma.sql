-- 05/11/2026 (Rick, after a seller used 11 days unpaid): PURCHASE_COMPLETE only CONFIRMS, it never extends.
-- It arrives up to ~8 days after APPROVED; if the next charge was already generated in between, it carried
-- that later date and the access jumped to it with the current charge still open (access until December
-- with November unpaid). APPROVED / RENEWAL already bring the right due date. COMPLETE now creates the
-- access only when no row exists (a purchase whose APPROVED never reached us); otherwise it is ignored.
-- Nobody's current period is shortened: the rule applies from the next event on.
create or replace function public.hotmart_acesso_aplicar(
  p_user uuid, p_acao text, p_sub text, p_purchase text, p_fim timestamptz default null, p_complete boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
  v_sub text := nullif(btrim(coalesce(p_sub, '')), '');
  v_outra text; v_outra_fim timestamptz;
  v_dono boolean;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then raise exception 'so o servidor'; end if;
  select * into s from public.subscriptions where user_id = p_user for update;
  v_dono := s.id is null or v_sub is null or nullif(s.hotmart_subscription_id, '') is null
            or s.hotmart_subscription_id = v_sub;

  if p_acao = 'ativar' then
    if p_fim is null then raise exception 'fim obrigatorio'; end if;
    -- 05/11: COMPLETE never changes an existing access row (it only confirms)
    if p_complete and s.id is not null then return 'complete_ignorado'; end if;
    if not v_dono and s.status in ('active', 'past_due') and s.current_period_end > p_fim then
      return 'outra_assinatura_paga_mais_longe';
    end if;
    insert into public.subscriptions as x (user_id, provider, status, current_period_end, grace_until,
                                           hotmart_purchase_id, hotmart_subscription_id, last_event_at)
    values (p_user, 'hotmart', 'active', p_fim, p_fim + interval '3 days', p_purchase, v_sub, now())
    on conflict (user_id) do update set
      provider = 'hotmart', status = 'active', current_period_end = excluded.current_period_end,
      grace_until = excluded.grace_until, hotmart_purchase_id = coalesce(excluded.hotmart_purchase_id, x.hotmart_purchase_id),
      hotmart_subscription_id = coalesce(excluded.hotmart_subscription_id, x.hotmart_subscription_id),
      last_event_at = now(), updated_at = now();
    update public.profiles set plan_status = 'active', is_trial_active = false where user_id = p_user;
    return 'ativada';

  elsif p_acao = 'atrasar' then
    if s.id is null or not v_dono then return 'outra_assinatura'; end if;
    update public.subscriptions
       set status = 'past_due', last_event_at = now(), updated_at = now(),
           hotmart_purchase_id = coalesce(nullif(p_purchase, ''), hotmart_purchase_id)
     where id = s.id;
    return 'atrasada';

  elsif p_acao = 'cancelar' then
    if not v_dono then return 'outra_assinatura'; end if;
    select a.subscription_id, a.proxima_cobranca into v_outra, v_outra_fim
      from public.orbis_hotmart_assinatura a
     where a.user_id = p_user and a.status_hotmart = 'ACTIVE'
       and a.subscription_id <> coalesce(v_sub, '') and a.subscription_id <> ''
       and a.proxima_cobranca > now()
       and not exists (select 1 from public.bancos_extra_compras b where b.chave = a.subscription_id)
     order by a.proxima_cobranca desc limit 1;
    if v_outra is not null then
      insert into public.subscriptions as x (user_id, provider, status, current_period_end, grace_until,
                                             hotmart_subscription_id, last_event_at)
      values (p_user, 'hotmart', 'active', v_outra_fim, v_outra_fim + interval '3 days', v_outra, now())
      on conflict (user_id) do update set
        status = 'active', current_period_end = excluded.current_period_end, grace_until = excluded.grace_until,
        hotmart_subscription_id = excluded.hotmart_subscription_id, last_event_at = now(), updated_at = now();
      update public.profiles set plan_status = 'active' where user_id = p_user;
      return 'trocou_para_outra';
    end if;
    insert into public.subscriptions as x (user_id, provider, status, grace_until, hotmart_purchase_id,
                                           hotmart_subscription_id, last_event_at)
    values (p_user, 'hotmart', 'canceled', now(), p_purchase, v_sub, now())
    on conflict (user_id) do update set
      status = 'canceled', grace_until = now(),
      hotmart_purchase_id = coalesce(excluded.hotmart_purchase_id, x.hotmart_purchase_id),
      hotmart_subscription_id = coalesce(excluded.hotmart_subscription_id, x.hotmart_subscription_id),
      last_event_at = now(), updated_at = now();
    update public.profiles set plan_status = 'expired' where user_id = p_user;
    return 'cancelada';
  end if;
  raise exception 'acao invalida';
end $$;
