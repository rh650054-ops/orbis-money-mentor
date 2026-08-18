-- TRAVAS DE GASTO + CORREÇÕES DA VARREDURA DE SEGURANÇA (17/08/2026)
-- (Aplicadas em produção via mcp apply_migration; este arquivo é o registro no repo.)

-- ===== Travas de gasto (fonte: medidor ai_custos) =====
create index if not exists ai_custos_user_ts_idx on public.ai_custos (user_id, ts desc);

create or replace function public.orbis_gasto_usuario_hoje(p_user uuid)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(custo_usd), 0) from public.ai_custos
  where user_id = p_user
    and ts >= ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
$$;

create or replace function public.orbis_gasto_global_hoje()
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(custo_usd), 0) from public.ai_custos
  where ts >= ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
$$;

create or replace function public.orbis_uso_mes(p_user uuid, p_feature text)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(count), 0)::int from public.ai_usage
  where user_id = p_user and feature = p_feature
    and dia >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
$$;

-- ===== Correções críticas de RLS =====
-- CRM de influenciadores estava ALL liberado pra role public (qualquer pessoa com
-- a chave publicável lia e REESCREVIA contatos, config e atividades).
drop policy if exists crm_config_all on public.crm_config;
drop policy if exists crm_influenciadores_all on public.crm_influenciadores;
drop policy if exists crm_atividades_read on public.crm_atividades;
create policy crm_config_admin on public.crm_config
  for all using (public.is_orbis_admin()) with check (public.is_orbis_admin());
create policy crm_influenciadores_admin on public.crm_influenciadores
  for all using (public.is_orbis_admin()) with check (public.is_orbis_admin());
create policy crm_atividades_admin on public.crm_atividades
  for select using (public.is_orbis_admin());

-- orbis_bugs: qualquer anônimo podia LER, EDITAR e APAGAR todos os reports.
drop policy if exists orbis_bugs_select on public.orbis_bugs;
drop policy if exists orbis_bugs_update on public.orbis_bugs;
drop policy if exists orbis_bugs_delete on public.orbis_bugs;
create policy orbis_bugs_select_admin on public.orbis_bugs for select using (public.is_orbis_admin());
create policy orbis_bugs_update_admin on public.orbis_bugs for update using (public.is_orbis_admin()) with check (public.is_orbis_admin());
create policy orbis_bugs_delete_admin on public.orbis_bugs for delete using (public.is_orbis_admin());

-- Views com SECURITY DEFINER (erro do advisor): passam a respeitar o RLS de quem lê.
alter view public.vw_custos_ia_dia set (security_invoker = on);
alter view public.crm_leads_por_ref set (security_invoker = on);
