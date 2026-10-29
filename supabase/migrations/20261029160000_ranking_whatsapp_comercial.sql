-- ============================================================================
-- RANKING → WHATSAPP DO LEAD, SÓ PRA EQUIPE COMERCIAL — 29/10/2026
-- Rick: "o Paulo e o Yan podem clicar em qualquer lead do rank que vai ter o WhatsApp.
-- Não libera pra nenhum outro usuário." Mesma trava do CRM (admin_access: admin/comercial).
-- O número nunca vai na lista: é pedido um a um, na hora do toque, e só pra quem passa
-- em is_orbis_crm(). Cada pedido fica registrado (quem pediu, de quem, quando).
-- ============================================================================

create table if not exists public.ranking_contatos (
  id bigserial primary key,
  por uuid not null references auth.users(id) on delete cascade,
  lead uuid not null references auth.users(id) on delete cascade,
  em timestamptz not null default now()
);
alter table public.ranking_contatos enable row level security;
-- sem policies: só a função abaixo escreve; leitura pelo painel do Supabase

create or replace function public.ranking_whatsapp_lead(p_user uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_fone text;
begin
  if auth.uid() is null or not public.is_orbis_crm() then
    raise exception 'apenas equipe comercial';
  end if;
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into v_fone from profiles where user_id = p_user;
  if v_fone is null or length(v_fone) < 10 then return null; end if;
  if length(v_fone) in (10, 11) then v_fone := '55' || v_fone; end if;
  insert into ranking_contatos (por, lead) values (auth.uid(), p_user);
  return v_fone;
end;
$function$;
revoke all on function public.ranking_whatsapp_lead(uuid) from public, anon;
grant execute on function public.ranking_whatsapp_lead(uuid) to authenticated;
