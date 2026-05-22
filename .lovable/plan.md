# Reestruturação da tela de Ranking

## Visão geral

Hoje a aba `/ranking` tem duas ligas separadas (Faturamento e Constância). Vamos transformar em:

1. **Liga Global** — uma única tela com colunas de Faturamento (em PIX) + Streak de Constância lado a lado.
2. **Competições** — nova aba/seção dentro de `/ranking`, com torneios semanais ou mensais criados por administradores, com prêmio em dinheiro/produto, critério de entrada e contabilização **apenas de vendas em PIX**.

Apenas vendas pagas em **PIX** contam para qualquer ranking competitivo (para evitar fraude). Vendas em dinheiro continuam aparecendo no app/relatórios do usuário, mas não somam no ranking nem em competições.

---

## 1. Tela de Ranking reestruturada (`/ranking`)

Estrutura nova:

```text
┌─────────────────────────────────────────┐
│  [Liga Global]   [Competições]          │ ← tabs
├─────────────────────────────────────────┤
│  Seu card: posição, streak 🔥, R$ PIX  │
│  Top 1 (holográfico)                    │
│  Lista: posição | nome | R$ PIX | 🔥dias│
└─────────────────────────────────────────┘
```

- **Liga Global** (substitui as duas ligas atuais):
  - Coluna principal: faturamento em PIX do mês.
  - Coluna secundária: streak de constância (🔥 N dias) — mesmo visual do Duolingo já usado.
  - Ordenação primária: faturamento PIX mês. Empate: maior streak.
  - Card pessoal do usuário no topo mostra ambos.

- **Competições** (nova):
  - Cards de torneios ativos com: nome, prêmio, prazo, critério de entrada, "Participar" / "Você está participando".
  - Histórico de competições finalizadas + status "Você ganhou — entre em contato com o suporte".

## 2. Painel administrativo de Competições

Nova página `/admin/competitions` (visível só para `admin` via `useAdminAccess`):
- Criar competição: nome, descrição, prêmio (texto + valor), tipo (semanal/mensal), data início/fim, critério de entrada (livre / pagar valor X / convite), métrica (faturamento PIX, nº vendas PIX, streak).
- Listar competições com participantes, ranking ao vivo e botão "Finalizar e premiar vencedor".
- Ao finalizar: marca vencedor, dispara notificação in-app.

## 3. Contabilização só de PIX

- Hoje `leaderboard_stats.faturamento_total_mes` usa `work_sessions.total_vendido` (todas as formas). Vamos adicionar `faturamento_pix_mes` calculado a partir de `hourly_goal_blocks.valor_pix` (que já existe).
- `useLeaderboard.updateUserStats` passa a somar `valor_pix` dos blocos do mês em vez de `total_vendido`.
- A coluna antiga continua para histórico, mas a UI mostra só a nova.

## 4. Notificação de prêmio

- Quando admin finaliza competição: cria registro em `competition_winners` e ao abrir a aba o vencedor vê banner: "Você ganhou {prêmio}! Entre em contato com o suporte pelo WhatsApp para receber."
- Validação extra: usuário precisa ter `phone` no `profiles` para participar de competições com prêmio em dinheiro.

---

## Detalhes técnicos

### Novas tabelas (migration)

- `competitions`
  - `name`, `description`, `prize_label` (text), `prize_value` (numeric), `period_type` ('weekly'|'monthly'), `starts_at`, `ends_at`, `metric` ('pix_revenue'|'pix_sales_count'|'streak'), `entry_rule` ('free'|'paid'|'invite'), `entry_fee` (numeric, nullable), `status` ('draft'|'active'|'finished'), `created_by`, `winner_user_id` (nullable).
- `competition_participants`
  - `competition_id`, `user_id`, `joined_at`, `paid` (bool), `score` (numeric, cache).
- `competition_winners`
  - `competition_id`, `user_id`, `prize_label`, `prize_value`, `awarded_at`, `claimed` (bool), `claim_acknowledged_at`.

RLS:
- `competitions`: SELECT para `authenticated`; INSERT/UPDATE/DELETE só para `admin` via `has_role`.
- `competition_participants`: usuário gerencia o próprio; admin lê tudo.
- `competition_winners`: usuário vê o próprio; admin gerencia.

### Alterações em `leaderboard_stats`

- Adicionar `faturamento_pix_mes numeric NOT NULL DEFAULT 0`.
- Recalcular em `useLeaderboard.updateUserStats` somando `valor_pix` de `hourly_goal_blocks` do mês.
- `recalculate_ranking_positions` passa a ordenar por `faturamento_pix_mes`.

### Frontend

Arquivos a criar/editar:
- `src/pages/Ranking.tsx` — reestruturar para tabs Liga Global + Competições, unificar exibição (PIX + 🔥streak).
- `src/components/ranking/CompetitionsTab.tsx` (novo) — lista de competições + participação.
- `src/components/ranking/CompetitionCard.tsx` (novo).
- `src/components/ranking/WinnerBanner.tsx` (novo) — banner "Você ganhou".
- `src/pages/AdminCompetitions.tsx` (novo) — CRUD admin + finalizar.
- `src/hooks/useCompetitions.ts` (novo) — fetch/join/finish.
- `src/hooks/useLeaderboard.ts` — trocar fonte para `faturamento_pix_mes` e remover separação em duas listas.
- Rota `/admin/competitions` em `src/App.tsx` protegida por `useAdminAccess`.

### Preservação visual

Mantemos o tema cinematic dark, holographic Top 1, confetti e fire icon já existentes. Apenas reorganizamos conteúdo dentro das tabs — sem mexer em cores/tokens.

---

## O que NÃO entra agora

- Cobrança real da `entry_fee` (Hotmart/PIX) — fica como TODO; por enquanto admin marca `paid=true` manualmente quando recebe.
- Push notification nativa — usaremos banner in-app + ícone na aba.

Posso prosseguir com a migration + implementação?