-- Applied to production on 17/10/2026 (MCP apply_migration). Kept here for the record.
-- Rick, 17/10/2026: a vendor with ONE bank has no "work vs personal" split — that bank
-- always counts as sales, even if it was marked personal. A bank with no role chosen
-- counts too (before, two unmarked banks counted as nothing — Zeck, 17/10). Only a bank
-- explicitly marked personal, when the vendor has more than one, is left out.
create or replace function public.banco_conta_de_venda(p_conexao uuid, p_quando timestamp with time zone)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bank_connections bc
     where bc.id = p_conexao and coalesce(bc.status, '') <> 'deleted'
       and (
         bc.papel is null
         or (bc.papel = 'trabalho' and (bc.papel_desde is null or p_quando is null or p_quando >= bc.papel_desde))
         or (select count(*) from public.bank_connections o
              where o.user_id = bc.user_id and coalesce(o.status, '') <> 'deleted') = 1
       ));
$$;
