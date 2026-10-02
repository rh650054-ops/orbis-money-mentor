-- ============================================================
-- ANTI-TRAVAMENTO (02/10/2026) — o app travou inteiro no pico do meio-dia
-- (11:53–11:56 BRT): pool de conexões do PostgREST esgotado + statement timeout.
--
-- Causa 1: recalculate_ranking_positions é chamada pelo app a cada venda e a
--   cada abertura do ranking (~41 mil chamadas). Cada chamada reescrevia TODAS
--   as linhas do mês; chamadas simultâneas esperavam umas às outras (lock de
--   linha) e seguravam conexões. Agora: se já tem um recálculo do mês rodando,
--   a chamada sai na hora (advisory lock), e só grava linha cuja posição mudou
--   (menos escrita e menos tráfego pro Realtime).
-- Causa 2: defcon_sales (74 mil linhas) só tinha a chave primária. Toda busca
--   por sessão (~48 mil chamadas) ou por vendedor+data varria a tabela inteira.
-- ============================================================

create index if not exists defcon_sales_session_idx on public.defcon_sales (session_id);
create index if not exists defcon_sales_user_created_idx on public.defcon_sales (user_id, created_at desc);

create or replace function public.recalculate_ranking_positions(target_month text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare antes jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('recalc_ranking:' || target_month)) then
    return;
  end if;

  select coalesce(jsonb_object_agg(user_id::text, posicao_faturamento), '{}'::jsonb) into antes
  from public.leaderboard_stats
  where mes_referencia = target_month and dias_trabalhados_mes > 0 and posicao_faturamento is not null;

  with ranked_faturamento as (
    select id, row_number() over (order by faturamento_total_mes desc, id) as pos
    from public.leaderboard_stats
    where mes_referencia = target_month and dias_trabalhados_mes > 0
  )
  update public.leaderboard_stats ls
  set posicao_faturamento = rf.pos
  from ranked_faturamento rf
  where ls.id = rf.id and ls.posicao_faturamento is distinct from rf.pos;

  with ranked_constancia as (
    select id, row_number() over (order by dias_trabalhados_mes desc, constancia_streak_atual desc, id) as pos
    from public.leaderboard_stats
    where mes_referencia = target_month and dias_trabalhados_mes > 0
  )
  update public.leaderboard_stats ls
  set posicao_constancia = rc.pos
  from ranked_constancia rc
  where ls.id = rc.id and ls.posicao_constancia is distinct from rc.pos;

  -- ULTRAPASSAGENS: A passou B quando A estava abaixo de B antes e está acima depois.
  -- Um evento pra cada lado; no máximo 3 por pessoa por recálculo; sem repetir o par em 6h.
  with pos_antes as (
    select key::uuid as user_id, value::int as pos from jsonb_each_text(antes)
  ),
  depois as (
    select user_id, posicao_faturamento as pos, nome_usuario as nome, avatar_url as avatar
    from public.leaderboard_stats
    where mes_referencia = target_month and dias_trabalhados_mes > 0 and posicao_faturamento is not null
  ),
  pares as (
    select a_antes.user_id as passou, b_antes.user_id as passado,
           a_antes.pos as passou_antes, a_dep.pos as passou_depois,
           b_antes.pos as passado_antes, b_dep.pos as passado_depois,
           a_dep.nome as passou_nome, a_dep.avatar as passou_avatar,
           b_dep.nome as passado_nome, b_dep.avatar as passado_avatar
    from pos_antes a_antes
    join depois a_dep on a_dep.user_id = a_antes.user_id
    join pos_antes b_antes on b_antes.user_id <> a_antes.user_id
    join depois b_dep on b_dep.user_id = b_antes.user_id
    where a_antes.pos > b_antes.pos and a_dep.pos < b_dep.pos
      and not exists (
        select 1 from public.ranking_eventos e
        where e.user_id = b_antes.user_id and e.outro_user_id = a_antes.user_id
          and e.tipo = 'foi_ultrapassado' and e.created_at > now() - interval '6 hours')
  ),
  limitado as (
    select *, row_number() over (partition by passado order by passou_depois) rn_passado,
              row_number() over (partition by passou order by passado_depois) rn_passou
    from pares
  )
  insert into public.ranking_eventos (user_id, tipo, outro_user_id, outro_nome, outro_avatar, posicao_antes, posicao_depois, mes_referencia)
  select passado, 'foi_ultrapassado', passou, passou_nome, passou_avatar, passado_antes, passado_depois, target_month from limitado where rn_passado <= 3
  union all
  select passou, 'ultrapassou', passado, passado_nome, passado_avatar, passou_antes, passou_depois, target_month from limitado where rn_passou <= 3;
end;
$function$;
