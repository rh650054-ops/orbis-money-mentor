-- 03/11/2026 (Rick): "sistema conectado com o CRM pra ver as vendas do time comercial
-- e já saber quanto vamos pagar pra cada um".
-- Rules agreed with Rick:
--   * A sale = a CRM card in "ganho" with a responsible seller (crm_cartoes.responsavel).
--   * Commission base = the client's FIRST paid Hotmart charge (not a renewal) after the seller
--     took the card, up to 30 days after it closed. If that charge was refunded / charged back,
--     the next valid one counts. Value = LÍQUIDO (what reaches VANT after Hotmart).
--   * 30% when the lead is the seller's own or came from a founder code (RICK5, MOHAMED34,
--     ORBIS5); 10% when it came from an influencer/affiliate link. Override via
--     crm_ajustes.chave = 'comissao_equipe' {pct_proprio, pct_influenciador, codigos_socios}.
--   * Paid every day 10 for the previous month's sales (month of the charge).

create table if not exists public.crm_equipe_pagamentos (
  id bigserial primary key,
  user_id uuid not null,
  referencia text not null check (referencia ~ '^\d{4}-\d{2}$'),
  valor numeric(10,2) not null check (valor > 0),
  obs text,
  pago_em timestamptz not null default now(),
  por uuid default auth.uid()
);
create index if not exists crm_equipe_pagamentos_user_ref on public.crm_equipe_pagamentos (user_id, referencia);
alter table public.crm_equipe_pagamentos enable row level security;
-- no policies on purpose: read/write only through the security definer functions below.

create or replace function public.crm_equipe_vendas()
returns table (
  cartao_id bigint, vendedor uuid, cliente_id uuid, cliente text, ref text,
  fechado_em timestamptz, assumiu_em timestamptz, purchase_id text, pago_em timestamptz,
  bruto numeric, liquido numeric, pct numeric, comissao numeric, mes text, status text
)
language sql stable security definer set search_path to 'public'
as $$
  with cfg as (
    select coalesce((a.valor->>'pct_proprio')::numeric, 30) as pp,
           coalesce((a.valor->>'pct_influenciador')::numeric, 10) as pi,
           coalesce((select array_agg(upper(x)) from jsonb_array_elements_text(a.valor->'codigos_socios') x),
                    array['RICK5','MOHAMED34','ORBIS5']) as socios
      from (select (select valor from public.crm_ajustes where chave = 'comissao_equipe') as valor) a
  ),
  cancelada as (
    select distinct e.purchase_id from public.hotmart_eventos e
     where e.purchase_id is not null
       and e.event_type in ('PURCHASE_REFUNDED','PURCHASE_PROTEST','PURCHASE_CHARGEBACK')
    union
    select r.purchase_id from public.hotmart_reembolsos r where r.purchase_id is not null
  ),
  c as (
    select c.id, c.responsavel, c.user_id, c.ref, c.fechado_em,
           coalesce(c.responsavel_em, c.criado_em) as assumiu
      from public.crm_cartoes c
     where c.status = 'ganho' and c.responsavel is not null and c.user_id is not null
  ),
  v as (
    select c.*, h.purchase_id, h.recebido_em, h.bruto, h.liquido,
           (h.purchase_id in (select purchase_id from cancelada)) as foi_cancelada
      from c
      left join lateral (
        select h.* from public._crm_compras_hotmart h
         where h.user_id = c.user_id and not h.renovacao
           and h.recebido_em >= (date_trunc('day', c.assumiu at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
           and h.recebido_em <= coalesce(c.fechado_em, now()) + interval '30 days'
         order by (h.purchase_id in (select purchase_id from cancelada)), h.recebido_em
         limit 1
      ) h on true
  ),
  linhas as (
    select v.id, v.responsavel, v.user_id,
           coalesce(nullif(trim(p.nickname), ''), 'Cliente') as cliente,
           v.ref, v.fechado_em, v.assumiu, v.purchase_id, v.recebido_em, v.bruto, v.liquido,
           case when v.ref is null or upper(v.ref) = any (cfg.socios)
                  or not exists (select 1 from public.parceiros pa where upper(pa.code) = upper(v.ref))
                then cfg.pp else cfg.pi end as pct,
           v.foi_cancelada
      from v cross join cfg
      left join public.profiles p on p.user_id = v.user_id
  )
  select distinct on (coalesce(l.purchase_id, 'c' || l.id))
         l.id, l.responsavel, l.user_id, l.cliente, l.ref, l.fechado_em, l.assumiu,
         l.purchase_id, l.recebido_em, l.bruto, l.liquido, l.pct,
         case when l.purchase_id is null or l.foi_cancelada then 0 else round(l.liquido * l.pct / 100, 2) end,
         to_char(coalesce(l.recebido_em, l.fechado_em) at time zone 'America/Sao_Paulo', 'YYYY-MM'),
         case when l.purchase_id is null then 'sem_pagamento' when l.foi_cancelada then 'cancelada' else 'valida' end
    from linhas l
   order by coalesce(l.purchase_id, 'c' || l.id), l.fechado_em;
$$;
revoke all on function public.crm_equipe_vendas() from public, anon, authenticated;

-- One row per seller for the month. Admin sees everyone; a seller sees only themself.
create or replace function public.crm_equipe_comissoes(p_mes text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_admin boolean; v_out jsonb;
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  if p_mes !~ '^\d{4}-\d{2}$' then raise exception 'mês inválido'; end if;
  v_admin := public.is_orbis_admin();

  with membros as (
    select e.user_id from public.crm_equipe e where e.ativo
    union
    select distinct x.vendedor from public.crm_equipe_vendas() x where x.mes = p_mes
  ),
  vis as (select m.user_id from membros m where v_admin or m.user_id = auth.uid())
  select coalesce(jsonb_agg(r order by (r->>'comissao')::numeric desc, r->>'nome'), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
        'user_id', m.user_id,
        'nome', coalesce(nullif(trim(p.nickname), ''), 'Vendedor'),
        'avatar', p.avatar_url,
        'mes', p_mes,
        'pagar_em', to_char((to_date(p_mes || '-10', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM-DD'),
        'vendas', coalesce((select count(*) from public.crm_equipe_vendas() x where x.vendedor = m.user_id and x.mes = p_mes and x.status = 'valida'), 0),
        'liquido', coalesce((select sum(x.liquido) from public.crm_equipe_vendas() x where x.vendedor = m.user_id and x.mes = p_mes and x.status = 'valida'), 0),
        'comissao', coalesce((select sum(x.comissao) from public.crm_equipe_vendas() x where x.vendedor = m.user_id and x.mes = p_mes), 0),
        'pago', coalesce((select sum(g.valor) from public.crm_equipe_pagamentos g where g.user_id = m.user_id and g.referencia = p_mes), 0),
        'pagamentos', coalesce((select jsonb_agg(jsonb_build_object('valor', g.valor, 'em', to_char(g.pago_em at time zone 'America/Sao_Paulo', 'DD/MM'), 'obs', g.obs) order by g.pago_em desc)
                                  from public.crm_equipe_pagamentos g where g.user_id = m.user_id and g.referencia = p_mes), '[]'::jsonb),
        'itens', coalesce((select jsonb_agg(jsonb_build_object(
                     'cliente', x.cliente, 'ref', x.ref,
                     'pago_em', to_char(x.pago_em at time zone 'America/Sao_Paulo', 'DD/MM'),
                     'fechado_em', to_char(x.fechado_em at time zone 'America/Sao_Paulo', 'DD/MM'),
                     'bruto', x.bruto, 'liquido', x.liquido, 'pct', x.pct, 'comissao', x.comissao, 'status', x.status)
                     order by coalesce(x.pago_em, x.fechado_em))
                   from public.crm_equipe_vendas() x where x.vendedor = m.user_id and x.mes = p_mes), '[]'::jsonb)
      ) as r
        from vis m
        left join public.profiles p on p.user_id = m.user_id
    ) t;
  return v_out;
end $$;
revoke all on function public.crm_equipe_comissoes(text) from public, anon;
grant execute on function public.crm_equipe_comissoes(text) to authenticated;

create or replace function public.crm_equipe_pagar(p_user uuid, p_mes text, p_valor numeric, p_obs text default null)
returns bigint
language plpgsql security definer set search_path to 'public'
as $$
declare v_id bigint;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if p_mes !~ '^\d{4}-\d{2}$' then raise exception 'mês inválido'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor precisa ser maior que zero'; end if;
  insert into public.crm_equipe_pagamentos (user_id, referencia, valor, obs, por)
  values (p_user, p_mes, round(p_valor, 2), nullif(trim(p_obs), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.crm_equipe_pagar(uuid, text, numeric, text) from public, anon;
grant execute on function public.crm_equipe_pagar(uuid, text, numeric, text) to authenticated;
