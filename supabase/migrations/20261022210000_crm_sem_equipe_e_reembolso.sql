-- 22/10/2026 (Rick): fichas erradas no CRM.
-- 1) A equipe (admin_access ativo) não vira ficha de cliente. Paulo e Rayanne caíram no Trial
--    porque criaram conta no app pra entrar no CRM.
create or replace function public.crm_cartao_sem_equipe()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and exists (
    select 1 from public.profiles p join public.admin_access a
      on a.enabled and regexp_replace(coalesce(a.cpf,''),'\D','','g') = regexp_replace(coalesce(p.cpf,''),'\D','','g')
     where p.user_id = new.user_id and regexp_replace(coalesce(p.cpf,''),'\D','','g') <> '') then
    return null;  -- não cria a ficha
  end if;
  return new;
end $$;
drop trigger if exists crm_cartao_sem_equipe on public.crm_cartoes;
create trigger crm_cartao_sem_equipe before insert on public.crm_cartoes
  for each row execute function public.crm_cartao_sem_equipe();

-- fichas que já existiam: Paulo (2638) e Rayanne (2663) no Trial
update public.crm_cartoes set status = 'arquivado', fechado_em = now(), atualizado_em = now()
 where id in (2638, 2663) and status = 'aberto';

-- 2) Lucas (2443) pediu reembolso em 13/10 e seguia no Upgrade Pro como se pagasse
update public.crm_cartoes set status = 'arquivado', fechado_em = now(), atualizado_em = now()
 where id = 2443 and status = 'aberto';
