-- Caixa da Vant: quanto o APP chamou de IA (tabela ai_usage), por recurso.
-- E o lado "app" da conta: mostra se o consumo das APIs bate com o uso real
-- dos vendedores. So socio enxerga; devolve so contagens, sem usuario.
create or replace function public.caixa_ia_app()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('feature', feature, 'hoje', hoje, 'sete', sete, 'mes', mes, 'pessoas', pessoas) order by mes desc), '[]'::jsonb)
    from (select feature,
                 coalesce(sum(count) filter (where dia = v_hoje), 0) hoje,
                 coalesce(sum(count) filter (where dia > v_hoje - 7), 0) sete,
                 coalesce(sum(count) filter (where dia >= date_trunc('month', v_hoje)::date), 0) mes,
                 count(distinct user_id) filter (where dia >= date_trunc('month', v_hoje)::date) pessoas
            from public.ai_usage where dia > v_hoje - 40 group by feature) x
   where mes > 0 or sete > 0);
end $$;
revoke execute on function public.caixa_ia_app() from public, anon;
grant execute on function public.caixa_ia_app() to authenticated;
