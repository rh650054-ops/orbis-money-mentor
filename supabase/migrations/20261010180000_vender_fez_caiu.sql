-- ============================================================
-- FEZ × CAIU POR DIA — aba Vender (Rick, 10/10/2026)
-- "Na aba de vender, pode ter algo aonde o usuário vê quantos caiu em cada
--  dia e quantos ele fez."
--   fez     = o que ele vendeu no dia (recebido + fiado), igual ao ranking do dia
--   dinheiro= o que ele disse que foi em espécie
--   caiu    = Pix + maquininha que o banco viu no dia (só Pro/teste com banco;
--             pra quem não tem, volta null e a tela mostra o convite do Pro)
--   conferido = dia já passou da meia-noite (o banco já conferiu o ranking)
-- Só lê os dados de quem chama (auth.uid()). Sem comandos de apagar.
-- ============================================================
create or replace function public.vender_fez_caiu(p_dias integer default 7)
returns table(dia date, fez numeric, dinheiro numeric, caiu numeric, conferido boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date := hoje - greatest(1, least(coalesce(p_dias, 7), 31)) + 1;
  tem_banco boolean;
begin
  if u is null then return; end if;
  tem_banco := (public.orbis_pro_ativo(u) or public.open_finance_teste(u))
    and exists (select 1 from public.bank_connections bc
                where bc.user_id = u and coalesce(bc.status, '') <> 'deleted');

  return query
  with v as (
    select ds.date as d,
           round(coalesce(ds.total_profit, 0) + coalesce(ds.total_debt, 0), 2) as fez,
           round(coalesce(ds.cash_sales, 0), 2) as din
      from public.daily_sales ds
     where ds.user_id = u and ds.date between de and hoje
  ),
  b as (
    select x.dia as d, round(coalesce(x.total, 0), 2) as caiu
      from public.banco_entradas_por_dia(u, de, hoje) x
     where tem_banco
  )
  select coalesce(v.d, b.d) as dia,
         coalesce(v.fez, 0) as fez,
         coalesce(v.din, 0) as dinheiro,
         case when tem_banco then coalesce(b.caiu, 0) else null end as caiu,
         coalesce(v.d, b.d) < hoje as conferido
    from v full join b on b.d = v.d
   where coalesce(v.fez, 0) > 0 or coalesce(b.caiu, 0) > 0
   order by 1 desc;
end $$;

revoke all on function public.vender_fez_caiu(integer) from public, anon;
grant execute on function public.vender_fez_caiu(integer) to authenticated;
