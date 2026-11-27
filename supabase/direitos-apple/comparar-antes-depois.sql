-- READ ONLY comparison of every account's rights BEFORE and AFTER the three draft migrations of
-- Etapa 2 (20261127120000, 20261127121000, 20261127122000), computed without applying anything.
--   antes_*   what the functions installed in this database answer today;
--   depois_*  what the migrated functions will answer on the day of the migration, written here as
--             plain expressions (no Apple subscription, no suspension and no Apple test account exist
--             on that day, and the courtesy Pros are marked as courtesies with the access they have).
-- It is ONE select inside a READ ONLY transaction: PostgreSQL itself refuses any write. It creates
-- no object and changes no row.
-- casos/49 proves the "depois" expressions: it runs this file on production's functions, applies the
-- real migrations and checks every prediction, account by account, against the migrated functions.
-- Output: one JSON with the totals, each kind of difference and the ids (no name, e-mail or CPF) of
-- the accounts whose answer changes.
-- psql switches (the tests use them): vant_com_detalhe = true adds every account to the JSON;
-- vant_guardar keeps the JSON in the psql variable vant_comparacao instead of printing it.
\if :{?vant_com_detalhe}
\else
\set vant_com_detalhe false
\endif
begin transaction read only;
-- the limit function answers only to the backend: this session says it is the backend (a setting of
-- this transaction, not a write)
set local request.jwt.claims to '{"role":"service_role"}';
set local request.jwt.claim.role to 'service_role';
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
base as (
  select p.user_id, p.plan_status,
         coalesce(p.billing_exempt, false) as isento, coalesce(p.is_demo, false) as demo,
         coalesce(coalesce(p.is_trial_active, false) and p.trial_end >= (select d from hoje), false) as teste_valendo,
         exists (select 1 from public.bancos_extra_compras b where b.user_id = p.user_id and b.ativo and b.ate > now()) as banco_pago,
         (select count(*)::int from public.bancos_extra_compras b where b.user_id = p.user_id and b.ativo and b.ate > now()) as bancos_pagos,
         -- the Pro row as the migrated readers see it: on and inside its period, or a courtesy in force
         exists (select 1 from public.orbis_pro o where o.user_id = p.user_id and o.ativo and o.cancelado_em is null
                    and (o.expira_em is null or o.expira_em > now())) as pro_linha,
         exists (select 1 from public.orbis_pro o where o.user_id = p.user_id and o.ativo and o.cancelado_em is null
                    and (o.expira_em is null or o.expira_em > now())
                    and (o.produto_id in ('ew11enu0', '6vkxbh8c', 't9xt3k4z') or (o.expira_em is not null and o.expira_em > now() + interval '180 days'))) as anual
    from public.profiles p),
d1 as (
  select b.*,
         b.pro_linha or (b.isento and b.banco_pago) as d_pro_pleno,
         b.isento or b.demo or coalesce(b.plan_status = 'active', false) or b.teste_valendo as d_plano_principal
    from base b),
d2 as (
  select d1.*, d1.d_pro_pleno or (d1.banco_pago and d1.d_plano_principal) as d_pro_ativo from d1),
d3 as (
  select d2.*,
         case when d2.isento or d2.demo then 'equipe'
              when d2.anual then 'pro_anual'
              when d2.d_pro_pleno then 'pro'
              when d2.d_pro_ativo then 'essencial_banco'
              when d2.plan_status = 'active' then 'essencial'
              when d2.teste_valendo then 'teste'
              else 'sem_plano' end as d_plano
    from d2),
v as (
select d3.user_id,
       d3.plan_status                                                    as plan_status,
       public.vant_plano(d3.user_id)                                     as antes_plano,
       d3.d_plano                                                        as depois_plano,
       public.vant_pro_pleno(d3.user_id)                                 as antes_pro,
       d3.d_pro_pleno                                                    as depois_pro,
       public.pro_anual(d3.user_id)                                      as antes_anual,
       d3.anual                                                          as depois_anual,
       public.orbis_pro_ativo(d3.user_id)                                as antes_banco_liberado,
       d3.d_pro_ativo                                                    as depois_banco_liberado,
       public.vant_recursos_pro(d3.user_id)                              as antes_recursos_pro,
       d3.d_pro_ativo or public.orbis_is_admin_user(d3.user_id) or d3.isento or d3.demo or d3.teste_valendo as depois_recursos_pro,
       public.mentor_limite_dia(d3.user_id)                              as antes_mentor,
       coalesce((select l.valor::int from public.ai_limites l where l.chave = case d3.d_plano
            when 'pro_anual' then 'chat_limite_anual' when 'equipe' then 'chat_limite_anual' when 'pro' then 'chat_limite_pro'
            when 'essencial_banco' then 'chat_limite_essencial' when 'essencial' then 'chat_limite_essencial'
            else 'chat_limite_trial' end), 10)                           as depois_mentor,
       -- banks the account can connect: included by the plan + extra slots; null = no limit (bancos_extra.isento)
       (public.open_finance_limite(d3.user_id) ->> 'limite')::int       as antes_bancos,
       case when coalesce((select x.isento from public.bancos_extra x where x.user_id = d3.user_id), false) then null
            else (case when d3.anual then 2 when d3.pro_linha then 1 else 0 end)
                 + coalesce((select x.extras from public.bancos_extra x where x.user_id = d3.user_id), 0)
                 + case when d3.d_pro_ativo then d3.bancos_pagos else 0 end end as depois_bancos
  from d3),
dif as (
  select v.* from v
   where (antes_plano, antes_pro, antes_anual, antes_banco_liberado, antes_recursos_pro, antes_mentor, antes_bancos)
        is distinct from (depois_plano, depois_pro, depois_anual, depois_banco_liberado, depois_recursos_pro, depois_mentor, depois_bancos))
select jsonb_pretty(jsonb_build_object(
  'quando', now(),
  'contas', (select count(*) from v),
  'contas_com_alguma_diferenca', (select count(*) from dif),
  'diferencas_por_campo', jsonb_build_object(
     'plano', (select count(*) from v where antes_plano is distinct from depois_plano),
     'pro', (select count(*) from v where antes_pro is distinct from depois_pro),
     'pro_anual', (select count(*) from v where antes_anual is distinct from depois_anual),
     'banco_liberado', (select count(*) from v where antes_banco_liberado is distinct from depois_banco_liberado),
     'recursos_pro', (select count(*) from v where antes_recursos_pro is distinct from depois_recursos_pro),
     'limite_do_mentor', (select count(*) from v where antes_mentor is distinct from depois_mentor),
     'bancos_que_pode_conectar', (select count(*) from v where antes_bancos is distinct from depois_bancos)),
  'planos_antes', (select jsonb_object_agg(antes_plano, n) from (select antes_plano, count(*) n from v group by 1) x),
  'planos_depois', (select jsonb_object_agg(depois_plano, n) from (select depois_plano, count(*) n from v group by 1) x),
  'mudancas_de_plano', coalesce((select jsonb_agg(jsonb_build_object('de', antes_plano, 'para', depois_plano, 'contas', n))
     from (select antes_plano, depois_plano, count(*) n from dif where antes_plano is distinct from depois_plano group by 1, 2) x), '[]'::jsonb),
  'assinantes_hotmart', (select count(*) from v where exists (select 1 from public.subscriptions s where s.user_id = v.user_id and s.status in ('active', 'past_due'))),
  'assinantes_hotmart_com_diferenca', (select count(*) from dif
     where exists (select 1 from public.subscriptions s where s.user_id = dif.user_id and s.status in ('active', 'past_due'))),
  'contas_que_mudam', coalesce((select jsonb_agg(to_jsonb(x) order by x.user_id) from (select * from dif order by user_id limit 100) x), '[]'::jsonb),
  'detalhe', case when :'vant_com_detalhe'::boolean then (select jsonb_agg(to_jsonb(v)) from v) end
)) as comparacao
\if :{?vant_guardar}
\gset vant_
\else
;
\endif
rollback;
