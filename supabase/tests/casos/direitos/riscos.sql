-- THE RISKS RECORDED IN PR #373 (27/11/2026), one scenario each. Fictional data only.
-- The same steps run twice:
--   casos/44  on production's functions as they are today  (:corrigido false: "as it is today")
--   casos/45  after the three draft migrations             (:corrigido true:  "FIXED")
-- so every changed answer is visible side by side, and everything else is asserted equal.
\if :{?corrigido}
\else
\set corrigido false
\endif
select now() + interval '20 days' as fim \gset
create or replace function pg_temp.admin(p_ligado boolean) returns void language plpgsql as $$
begin
  perform set_config('teste.admin', case when p_ligado then 'on' else 'off' end, false);
  if p_ligado then perform pg_temp.app(pg_temp.id('r_admin')); else perform pg_temp.servidor(); end if;
end $$;
select pg_temp.conta('r_admin');

-- ============================================================ 1. administrative deactivation
select pg_temp.conta(k) from unnest(array['s_pagante', 's_sem_pagar']) k;
select public.hotmart_acesso_aplicar(pg_temp.id('s_pagante'), 'ativar', 'SUB-s_pagante', 'HP-s1', :'fim'::timestamptz, false) \gset x_
select pg_temp.admin(true);
select public.admin_assinatura_manual(pg_temp.id('s_pagante'), false, 'teste de suspensao ficticia') \gset x_
select public.admin_assinatura_manual(pg_temp.id('s_sem_pagar'), true, 'ativacao manual ficticia') \gset x_
select public.admin_assinatura_manual(pg_temp.id('s_sem_pagar'), false, 'desfazendo a ativacao manual') \gset x_
select pg_temp.admin(false);
select t.verdade('S1 an admin deactivation blocks the account now and is written to the log',
  pg_temp.plano('s_pagante') = 'expired' and pg_temp.plano('s_sem_pagar') = 'expired'
  and (select count(*) = 3 from public.assinatura_manual));
-- the next Hotmart charge arrives
select public.hotmart_acesso_aplicar(pg_temp.id('s_pagante'), 'ativar', 'SUB-s_pagante', 'HP-s2', :'fim'::timestamptz + interval '30 days', false) \gset x_
\if :corrigido
select t.verdade('S2 FIXED: the next Hotmart charge is recorded (the Hotmart row is paid and up to date) but does NOT undo the admin''s deactivation',
  pg_temp.plano('s_pagante') = 'expired' and public.conta_suspensa(pg_temp.id('s_pagante'))
  and (select status = 'active' and current_period_end > now() + interval '40 days' from public.subscriptions where user_id = pg_temp.id('s_pagante'))
  and public.vant_plano(pg_temp.id('s_pagante')) = 'sem_plano');
select t.verdade('S3 FIXED: deactivating an account nobody is paying for is NOT a suspension: a purchase made later turns it on as before',
  not public.conta_suspensa(pg_temp.id('s_sem_pagar')));
\else
select t.verdade('S2 as it is today: the next Hotmart charge silently undoes the admin''s deactivation',
  pg_temp.plano('s_pagante') = 'active');
select t.verdade('S3 as it is today: nothing protects a deactivation from the next charge (no suspension rule on the profile)',
  not exists (select 1 from pg_trigger where tgname = 'zz_profiles_respeita_suspensao'));
\endif
select public.hotmart_acesso_aplicar(pg_temp.id('s_sem_pagar'), 'ativar', 'SUB-s_sem_pagar', 'HP-s3', :'fim'::timestamptz, false) \gset x_
select t.verdade('S4 an account deactivated while nobody paid for it: a purchase made later turns it on (both before and after)',
  pg_temp.plano('s_sem_pagar') = 'active');
select pg_temp.admin(true);
select public.admin_assinatura_manual(pg_temp.id('s_pagante'), true, 'reativando a conta ficticia') \gset x_
select pg_temp.admin(false);
select t.verdade('S5 the admin activates by hand: the account is on again (both before and after)',
  pg_temp.plano('s_pagante') = 'active' and public.vant_plano(pg_temp.id('s_pagante')) = 'essencial');

-- ============================================================ 2. Hotmart revocation and the courtesy
select pg_temp.conta(k) from unnest(array['c_cortesia_e_hotmart', 'c_so_hotmart']) k;
select public.pro_conceder(pg_temp.id('c_cortesia_e_hotmart'), 'cortesia', null, null, null) \gset x_
select public.pro_conceder(pg_temp.id('c_cortesia_e_hotmart'), 'hotmart', 'SUB-c1', '5y86n311', now() + interval '33 days') \gset x_
select public.pro_conceder(pg_temp.id('c_so_hotmart'), 'hotmart', 'SUB-c2', '5y86n311', now() + interval '33 days') \gset x_
select t.verdade('C1 courtesy Pro, then a Hotmart Pro bought on top: Pro on, the row now says "hotmart"',
  public.vant_pro_pleno(pg_temp.id('c_cortesia_e_hotmart'))
  and (select origem = 'hotmart' and expira_em is not null from public.orbis_pro where user_id = pg_temp.id('c_cortesia_e_hotmart')));
select public.pro_revogar(pg_temp.id('c_cortesia_e_hotmart')) \gset x_
select public.pro_revogar(pg_temp.id('c_so_hotmart')) \gset x_
\if :corrigido
select t.verdade('C2 FIXED: the Hotmart Pro is revoked, the independent courtesy stays: Pro on, one bank included, origin shown as courtesy',
  public.vant_pro_pleno(pg_temp.id('c_cortesia_e_hotmart')) and public.vant_plano(pg_temp.id('c_cortesia_e_hotmart')) = 'pro'
  and (public.open_finance_limite(pg_temp.id('c_cortesia_e_hotmart')) ->> 'incluidos')::int = 1
  and (select not ativo and cancelado_em is not null and cortesia from public.orbis_pro where user_id = pg_temp.id('c_cortesia_e_hotmart'))
  and exists (select 1 from public.vant_direitos(pg_temp.id('c_cortesia_e_hotmart')) d where d.direito = 'pro' and d.origem = 'cortesia'));
\else
select t.verdade('C2 as it is today: the Hotmart revocation takes the courtesy away with it',
  not public.vant_pro_pleno(pg_temp.id('c_cortesia_e_hotmart')));
\endif
select t.verdade('C3 a Pro that was only Hotmart''s is off after the revocation (both before and after)',
  not public.vant_pro_pleno(pg_temp.id('c_so_hotmart')) and (select not ativo from public.orbis_pro where user_id = pg_temp.id('c_so_hotmart')));
\if :corrigido
select public.pro_cortesia_revogar(pg_temp.id('c_cortesia_e_hotmart')) \gset x_
select t.verdade('C4 FIXED: taking a courtesy away is its own action, and it ends the Pro',
  not public.vant_pro_pleno(pg_temp.id('c_cortesia_e_hotmart')));
select pg_temp.app(pg_temp.id('c_so_hotmart'));
select t.verdade('C5 FIXED: a logged-in person cannot take a courtesy away',
  t.erro(format('select public.pro_cortesia_revogar(%L)', pg_temp.id('c_so_hotmart'))) like '%so o servidor ou um admin mexe na cortesia');
select pg_temp.servidor();
\endif

-- ============================================================ 3. the extra bank and the main plan
select pg_temp.conta(k) from unnest(array['k_bloqueada', 'k_essencial']) k;
select pg_temp.conta('k_teste', 'teste');
select public.hotmart_acesso_aplicar(pg_temp.id('k_essencial'), 'ativar', 'SUB-k_essencial', 'HP-k', :'fim'::timestamptz, false) \gset x_
select public.banco_extra_registrar(pg_temp.id(k), 'SUB-BANCO-' || k, true, now() + interval '30 days') from unnest(array['k_bloqueada', 'k_essencial', 'k_teste']) k;
\if :corrigido
select t.verdade('K1 FIXED: a paid extra bank on an account WITHOUT a valid main plan gives nothing: no plan name, no bank features, no Pro resources, no slot, test-level Mentor limit',
  public.vant_plano(pg_temp.id('k_bloqueada')) = 'sem_plano' and not public.orbis_pro_ativo(pg_temp.id('k_bloqueada'))
  and not public.vant_recursos_pro(pg_temp.id('k_bloqueada')) and public.mentor_limite_dia(pg_temp.id('k_bloqueada')) = 10
  and (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'limite')::int = 0
  and not (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'pode_conectar')::boolean
  and not (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'liberado')::boolean);
select t.verdade('K2 FIXED: the purchase itself is kept: the slot is still recorded as paid, and the main plan was never written by it',
  (select ativo and ate > now() from public.bancos_extra_compras where chave = 'SUB-BANCO-k_bloqueada') and pg_temp.plano('k_bloqueada') = 'expired');
select public.hotmart_acesso_aplicar(pg_temp.id('k_bloqueada'), 'ativar', 'SUB-k_bloqueada', 'HP-k2', :'fim'::timestamptz, false) \gset x_
select t.verdade('K3 FIXED: when the main plan is paid again the kept slot works again, with nothing to redo',
  public.vant_plano(pg_temp.id('k_bloqueada')) = 'essencial_banco' and public.orbis_pro_ativo(pg_temp.id('k_bloqueada'))
  and (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'extras')::int = 1);
\else
select t.verdade('K1 as it is today: a paid extra bank on a blocked account reads as a plan ("essencial_banco") and opens the bank features, the Pro resources and the Essencial Mentor limit on the server',
  public.vant_plano(pg_temp.id('k_bloqueada')) = 'essencial_banco' and public.orbis_pro_ativo(pg_temp.id('k_bloqueada'))
  and public.vant_recursos_pro(pg_temp.id('k_bloqueada')) and public.mentor_limite_dia(pg_temp.id('k_bloqueada')) = 30
  and (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'limite')::int = 1
  and (public.open_finance_limite(pg_temp.id('k_bloqueada')) ->> 'pode_conectar')::boolean);
select t.verdade('K2 as it is today: the main plan itself was never written by the extra bank', pg_temp.plano('k_bloqueada') = 'expired');
\endif
select t.verdade('K4 Essencial paid + extra bank: plan "essencial_banco", bank features on, one extra slot (both before and after)',
  public.vant_plano(pg_temp.id('k_essencial')) = 'essencial_banco' and public.orbis_pro_ativo(pg_temp.id('k_essencial'))
  and (public.open_finance_limite(pg_temp.id('k_essencial')) ->> 'extras')::int = 1 and not public.vant_pro_pleno(pg_temp.id('k_essencial')));
select t.verdade('K5 as it is today, NOT changed: with a valid plan, the extra bank alone also opens the Pro resources (vant_recursos_pro)',
  public.vant_recursos_pro(pg_temp.id('k_essencial')));
select t.verdade('K6 free test still running + extra bank: the slot works during the test (both before and after)',
  public.orbis_pro_ativo(pg_temp.id('k_teste')) and (public.open_finance_limite(pg_temp.id('k_teste')) ->> 'extras')::int = 1);

-- ============================================================ 4. Hotmart cancellation (recorded, NOT changed)
select pg_temp.conta('x_cancela');
select public.hotmart_acesso_aplicar(pg_temp.id('x_cancela'), 'ativar', 'SUB-x_cancela', 'HP-x', :'fim'::timestamptz, false) \gset x_
select public.hotmart_acesso_aplicar(pg_temp.id('x_cancela'), 'cancelar', 'SUB-x_cancela', 'HP-x') \gset x_
select t.verdade('X1 as it is today, NOT changed: a Hotmart cancellation blocks the account at once, even with 20 paid days left',
  pg_temp.plano('x_cancela') = 'expired'
  and (select status = 'canceled' and grace_until <= now() from public.subscriptions where user_id = pg_temp.id('x_cancela')));

-- ============================================================ 5. the counters, with no Apple test account
select pg_temp.conta(k) from unnest(array['i_assinante', 'i_bloqueado']) k;
select pg_temp.conta('i_em_teste', 'teste');
select pg_temp.conta('i_equipe', 'equipe');
update public.profiles set email = nickname || '@exemplo.test' where user_id in (pg_temp.id('i_assinante'), pg_temp.id('i_bloqueado'), pg_temp.id('i_em_teste'), pg_temp.id('i_equipe'));
update public.profiles set plan_status = 'active' where user_id = pg_temp.id('i_equipe');
insert into public.leads (nome, email) select 'Lead Ficticio', 'i_assinante@exemplo.test' union all select 'Outro Lead', 'i_bloqueado@exemplo.test';
select public.hotmart_acesso_aplicar(pg_temp.id('i_assinante'), 'ativar', 'SUB-i_assinante', 'HP-i', :'fim'::timestamptz, false) \gset x_
select t.verdade('I1 the subscriber counters see the paying account and not the blocked, the test or the courtesy ones (both before and after)',
  (select count(*) = 1 from public.lista_assinantes() l where l.email = 'i_assinante@exemplo.test')
  and not exists (select 1 from public.lista_assinantes() l where l.email in ('i_bloqueado@exemplo.test', 'i_em_teste@exemplo.test', 'i_equipe@exemplo.test'))
  and (select count(*) = 1 from public.leads_assinantes_no_app() e where e = 'i_assinante@exemplo.test')
  and not exists (select 1 from public.leads_assinantes_no_app() e where e = 'i_bloqueado@exemplo.test'));
select t.igual('I2 total of paying subscribers = the accounts with the plan on that are not courtesy (both before and after)',
  public.total_assinantes_app(),
  (select count(*) from public.profiles where plan_status = 'active' and not coalesce(billing_exempt, false)));
select t.verdade('I3 the CRM questions (both before and after): a paying Essencial is an upgrade candidate; a blocked account whose test is over and that never bought is a rescue candidate',
  public._crm_assinante_sem_pro(pg_temp.id('i_assinante')) and not public._crm_assinante_sem_pro(pg_temp.id('i_bloqueado'))
  and public._crm_trial_sem_assinar(pg_temp.id('i_bloqueado')) and not public._crm_trial_sem_assinar(pg_temp.id('i_assinante')));
