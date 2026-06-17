-- Corrige o bug das abordagens infladas no DEFCON.
--
-- Causa raiz: saveBlockApproaches usava .maybeSingle() para decidir entre INSERT/UPDATE.
-- .maybeSingle() retorna erro/null quando há 2+ linhas, então bastava uma corrida inicial
-- criar duas linhas para o mesmo (session_id, block_index) e, a partir daí, cada novo save
-- reinseria uma linha (efeito cascata). Um único bloco chegou a virar ~20 linhas, somando
-- 286 abordagens onde o real era ~115.
--
-- Esta migration: (1) mescla as duplicatas mantendo o maior contador de cada bloco,
-- (2) apaga as linhas redundantes e (3) cria uma constraint única que impede a duplicação
-- no futuro (o código passou a usar upsert com onConflict nessa constraint).

-- 1) Mescla: leva o MAIOR valor de cada contador para todas as linhas do bloco
update public.challenge_blocks cb
set approaches_count = r.max_app,
    sales_count      = r.max_sales
from (
  select session_id,
         block_index,
         max(approaches_count)        as max_app,
         max(coalesce(sales_count,0)) as max_sales
  from public.challenge_blocks
  group by session_id, block_index
) r
where cb.session_id = r.session_id
  and cb.block_index = r.block_index;

-- 2) Remove as linhas duplicadas (mantém 1 por bloco)
delete from public.challenge_blocks cb
using (
  select id,
         row_number() over (
           partition by session_id, block_index
           order by approaches_count desc, created_at desc
         ) as rn
  from public.challenge_blocks
) r
where cb.id = r.id
  and r.rn > 1;

-- 3) Trava: impede novas duplicatas e habilita o upsert(onConflict)
alter table public.challenge_blocks
  drop constraint if exists challenge_blocks_session_block_unique;

alter table public.challenge_blocks
  add constraint challenge_blocks_session_block_unique unique (session_id, block_index);
