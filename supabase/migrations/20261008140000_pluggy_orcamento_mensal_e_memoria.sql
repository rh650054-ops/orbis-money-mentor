-- 08/10/2026 — Open Finance monthly budget + database load cuts.
--
-- 1) MONTHLY BUDGET. Open Finance Brasil caps every CPF + bank at 240 fresh
--    transaction pulls per month (docs.pluggy.ai/docs/rate-limits-of). Past it the
--    bank stops sending transactions until next month (Pix, ranking and Raio-X
--    freeze). Each "pedido" (PATCH /items) now comes out of a budget kept on the
--    connection; the agenda in supabase/functions/_shared/pluggy-agenda.ts spends it.

alter table public.bank_connections
  add column if not exists pedidos_mes text,
  add column if not exists pedidos_mes_qtd integer not null default 0,
  add column if not exists pedidos_dia date,
  add column if not exists pedidos_dia_qtd integer not null default 0;

comment on column public.bank_connections.pedidos_mes is
  'Brasília month (YYYY-MM) of pedidos_mes_qtd. A different month means the counter restarts at 0.';
comment on column public.bank_connections.pedidos_mes_qtd is
  'Fresh pulls from the bank (Pluggy PATCH) this month. Budget ORCAMENTO_MES (210 of Open Finance''s 240).';
comment on column public.bank_connections.pedidos_dia is 'Brasília day of pedidos_dia_qtd.';
comment on column public.bank_connections.pedidos_dia_qtd is 'Fresh pulls from the bank made on pedidos_dia.';

-- What October already spent is not stored anywhere, so start from a CONSERVATIVE
-- estimate: until 08/10 01:00 the old robot asked a pull every hour 08h–24h
-- (16/day per bank); since the travas, at most one pull per read.
do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if to_char(v_hoje, 'YYYY-MM') = '2026-10' then
    update public.bank_connections c set
      pedidos_mes = '2026-10',
      pedidos_mes_qtd =
        16 * greatest(0, date '2026-10-08' - greatest(date '2026-10-01', (c.created_at at time zone 'America/Sao_Paulo')::date))
        + 3 * greatest(0, v_hoje - greatest(date '2026-10-08', (c.created_at at time zone 'America/Sao_Paulo')::date))
        + case when c.leituras_dia = v_hoje then c.leituras_qtd else 0 end,
      pedidos_dia = case when c.leituras_dia = v_hoje then v_hoje end,
      pedidos_dia_qtd = case when c.leituras_dia = v_hoje then c.leituras_qtd else 0 end
    where c.status <> 'deleted' and c.pedidos_mes is null;
  end if;
end $$;

-- 2) PARTNERS SYNC (parc_sync, every hour): took ~22 s per run, almost all of it in
--    "when did this person first become a lead", which compared every attributed
--    user against every lead through a slow phone normalisation (~600k calls).
--    Split the OR into two indexed lookups (LEAST ignores NULLs, same result) …
create index if not exists leads_email_norm_idx on public.leads (lower(trim(email)), created_at);
create index if not exists leads_fone_chave_idx on public.leads (public.orbis_fone_chave(whatsapp), created_at);

--    … and stop rewriting all ~660 indications every hour when nothing changed
--    (6.4k rewrites/day). Patched in place: the function body lives only in the
--    database; the DO block fails loudly if the text it expects is not there.
do $$
declare
  d text := pg_get_functiondef('public.parc_sync'::regproc);
  velho_lead text := E'(select min(l.created_at) from leads l\n             where (pr.email is not null and lower(trim(l.email)) = lower(trim(pr.email)))\n                or (public.orbis_fone_chave(l.whatsapp) is not null\n                    and public.orbis_fone_chave(l.whatsapp) = public.orbis_fone_chave(coalesce(nullif(pr.phone,''''), pr.whatsapp_public)))) as cadastro_em';
  novo_lead text := E'least(\n             (select min(l.created_at) from leads l\n               where pr.email is not null and lower(trim(l.email)) = lower(trim(pr.email))),\n             (select min(l.created_at) from leads l\n               where public.orbis_fone_chave(l.whatsapp) = public.orbis_fone_chave(coalesce(nullif(pr.phone,''''), pr.whatsapp_public)))\n           ) as cadastro_em';
  velho_up text := E'status = excluded.status, atualizado_em = now()\n    returning 1';
  novo_up text := E'status = excluded.status, atualizado_em = now()\n    where (parc_indicacoes.user_id, parc_indicacoes.nome, parc_indicacoes.prova, parc_indicacoes.cadastro_em,\n           parc_indicacoes.conta_em, parc_indicacoes.teste_em, parc_indicacoes.assinou_em, parc_indicacoes.plano, parc_indicacoes.status)\n      is distinct from\n          (excluded.user_id, excluded.nome, excluded.prova, coalesce(parc_indicacoes.cadastro_em, excluded.cadastro_em),\n           coalesce(parc_indicacoes.conta_em, excluded.conta_em), coalesce(parc_indicacoes.teste_em, excluded.teste_em),\n           coalesce(parc_indicacoes.assinou_em, excluded.assinou_em), coalesce(excluded.plano, parc_indicacoes.plano), excluded.status)\n    returning 1';
begin
  if position(novo_up in d) > 0 then
    raise notice 'parc_sync already patched';
    return;
  end if;
  if position(velho_lead in d) = 0 or position(velho_up in d) = 0 then
    raise exception 'parc_sync changed since 08/10/2026 — patch not applied';
  end if;
  d := replace(replace(d, velho_lead, novo_lead), velho_up, novo_up);
  execute d;
end $$;

-- 3) MERCADO PAGO SYNC: every 5 min for 12 connections and zero MP sales stored.
--    Every 30 min is plenty while nobody sells through it.
do $$
declare v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'mp-sync-5min';
  if v_id is not null then
    perform cron.alter_job(v_id, schedule := '*/30 * * * *');
  end if;
end $$;

-- 4) REALTIME: the app listens (postgres_changes) to hourly_goal_blocks, ranking_eventos
--    and competition_participants. auto_detected_sales, ai_messages and chat_messages
--    were published but nobody listens — and auto_detected_sales is rewritten on every
--    bank read, so realtime decoded thousands of changes for no one.
do $$
declare t text;
begin
  foreach t in array array['auto_detected_sales', 'ai_messages', 'chat_messages'] loop
    if exists (select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
