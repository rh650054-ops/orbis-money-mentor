-- 27/11/2026: the risks recorded in PR #373, photographed on production's functions AS THEY ARE,
-- before any of them is fixed (Rick: "antes de modificar essas funções, crie testes que reproduzam
-- seu comportamento atual"). Scenarios: casos/direitos/riscos.sql.
\ir direitos/preparo.sql
\ir ../schema/extra/direitos_producao_20261127_b.sql
select pg_temp.servidor();
select t.verdade('F0 every function under test is production''s: fingerprints equal to the production catalog of 27/11/2026',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname, left(md5(lower(regexp_replace(p.prosrc, '\s+', '', 'g'))), 10)) in
          (('hotmart_acesso_aplicar', '29d8a279c8'), ('expire_overdue_subscriptions', '47843e903e'), ('vant_pro_pleno', 'ebb3e5b5e9'),
           ('pro_anual', '23c31b060e'), ('open_finance_limite', '0c9fbcebc2'), ('orbis_pro_status', '42fd3773ab'),
           ('orbis_pro_ativo', '0bca1afef2'), ('vant_plano', 'b5096ae261'), ('pro_conceder', '06d0bacb4a'), ('pro_revogar', '57cdf97bdb'),
           ('cortesia_com_banco_pago', 'adc206ecbf'), ('banco_extra_registrar', 'cfef5bec44'),
           ('admin_assinatura_manual', '52e799d460'), ('total_assinantes_app', 'a9354b933f'), ('lista_assinantes', '8f6367dbb2'),
           ('leads_assinantes_no_app', '8700c8fcef'), ('beta_vagas_preenchidas', '6db9db3070'), ('_crm_trial_sem_assinar', 'd574837fcb'),
           ('_crm_assinante_sem_pro', 'b36b636e3c'), ('vant_recursos_pro', '9ba18c0e97'), ('mentor_limite_dia', 'f8b2afb2b3'))) = 21);
\ir direitos/riscos.sql
