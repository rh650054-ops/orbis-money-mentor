-- Moderação de ranking: permite a admins ocultar usuários do ranking de forma permanente.

-- 1) Marca no perfil: quando true, o usuário não entra no ranking.
alter table public.profiles
  add column if not exists ranking_hidden boolean not null default false;

-- 2) Admins podem gerenciar (excluir/atualizar) qualquer linha do ranking.
--    Política aditiva (OR com as existentes), baseada no has_role -> user_roles.
drop policy if exists "Admins manage leaderboard_stats" on public.leaderboard_stats;
create policy "Admins manage leaderboard_stats"
  on public.leaderboard_stats for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
