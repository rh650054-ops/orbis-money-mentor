-- Caixa da Vant, parte 3: endurecimento apontado pelo Security Advisor.
-- search_path fixo nas funcoes e EXECUTE so pra quem precisa (gatilhos nao sao chamaveis).
alter function public.caixa_brl(numeric) set search_path = public;
alter function public.caixa_vendas(date) set search_path = public;
alter function public.caixa_ajustar_saldo(numeric, text) set search_path = public;
alter function public.caixa_sync_hotmart(numeric, numeric, boolean) set search_path = public;
alter function public.caixa_resumo(date) set search_path = public;
alter function public.caixa_lancar_recorrentes() set search_path = public;

revoke execute on function public.caixa_audita() from public, anon, authenticated;
revoke execute on function public.caixa_hotmart_evento() from public, anon, authenticated;
revoke execute on function public.caixa_eh_socio(), public.caixa_assinantes_ativos(), public.caixa_vendas(date),
  public.caixa_resumo(date), public.caixa_ajustar_saldo(numeric, text), public.caixa_sync_hotmart(numeric, numeric, boolean),
  public.caixa_lancar_recorrentes() from public, anon;
grant execute on function public.caixa_eh_socio(), public.caixa_assinantes_ativos(), public.caixa_vendas(date),
  public.caixa_resumo(date), public.caixa_ajustar_saldo(numeric, text), public.caixa_sync_hotmart(numeric, numeric, boolean),
  public.caixa_lancar_recorrentes() to authenticated;
revoke all on public.caixa_lancamentos, public.caixa_influenciadores, public.caixa_recorrentes, public.caixa_config,
  public.caixa_auditoria, public.caixa_socios from anon;
