-- ============================================================
-- COBRADOR COMPLETO (mockup cobrador.png) — 03/10/2026
--   • cobrancas.lembrar_em: "cobrar de novo daqui a 2 dias" (o app mostra quando chega a hora)
--   • cobrancas_painel(): quem ainda deve (cobranças abertas dos últimos 30 dias) +
--     quanto foi recuperado no mês + "X de Y cobranças pagas".
-- Só o dono lê (security invoker, RLS de cobrancas). Sem comandos de apagar.
-- ============================================================
alter table public.cobrancas add column if not exists lembrar_em timestamptz;

create or replace function public.cobrancas_painel()
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  with mes as (select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as ini),
  minhas as (select * from public.cobrancas where user_id = auth.uid())
  select jsonb_build_object(
    'recuperado_mes', coalesce((select sum(coalesce(valor_pago, valor)) from minhas where status = 'paga' and paga_em >= (select ini from mes)), 0),
    'pagas_mes', (select count(*) from minhas where status = 'paga' and paga_em >= (select ini from mes)),
    'criadas_mes', (select count(*) from minhas where criada_em >= (select ini from mes)),
    'abertas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', cliente_nome, 'telefone', cliente_telefone, 'valor', valor, 'descricao', descricao,
        'status', status, 'criada_em', criada_em, 'enviada_em', enviada_em, 'expira_em', expira_em,
        'lembrar_em', lembrar_em, 'client_id', defcon_client_id,
        'hora_de_cobrar', lembrar_em is not null and lembrar_em <= now())
        order by (lembrar_em is not null and lembrar_em <= now()) desc, criada_em desc)
      from minhas where status in ('pendente', 'expirada') and criada_em >= now() - interval '30 days'), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
grant execute on function public.cobrancas_painel() to authenticated;
