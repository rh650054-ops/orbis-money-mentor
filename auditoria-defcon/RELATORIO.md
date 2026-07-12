# Auditoria DEFCON 4 — Orbis

**Data:** 07/07/2026 · **Auditor:** Claude (Cowork) · **Status:** CONCLUÍDA (1ª rodada)

## Placar da auditoria
- **21 achados** no total (6 componentes/hooks + núcleo + offline).
- **6 bugs CORRIGIDOS** e validados (tsc limpo) — ver `BUGS-CORRIGIDOS.md`.
- **6 achados NÃO corrigidos** de propósito (exigem mudança de banco / sync — risco no
  lançamento) — ver `NAO-CORRIGIDOS.md`, cada um com risco + correção recomendada.
- **Conclusão de segurança:** o caminho crítico de DINHEIRO do DEFCON (blocos →
  `daily_sales` → ranking) está sólido: upserts atômicos por `(user_id,date)` e
  `(session_id,block_index)`, e a fila offline preserva o dinheiro de forma idempotente
  (estado absoluto do bloco). Os itens em aberto afetam contadores/estoque secundários,
  nunca o faturamento.


Objetivo: mapear todo o sistema do DEFCON 4, encontrar bugs (críticos a mínimos),
corrigir o que for possível e registrar o que não foi corrigido (e por quê).

## Estrutura deste diretório
- `RELATORIO.md` — este arquivo: sumário vivo da auditoria
- `BUGS-CORRIGIDOS.md` — cada bug corrigido: sintoma, causa, correção
- `NAO-CORRIGIDOS.md` — o que ficou de fora: motivo e recomendação

## Escopo mapeado (sistema DEFCON 4)
- **Núcleo:** `src/hooks/useDefconChallenge.ts` (máquina de estados: idle → running → block_report → break → lunch_pause → finished/abandoned)
- **Página:** `src/pages/DefconChallenge.tsx` (rota /defcon, fora do Layout)
- **Componentes:** DefconStartScreen, DefconRunning, DefconBreak, DefconLunchPause,
  DefconBlockReport, DefconDayReport, DefconEndScreen, DefconQuickSaleButtons,
  DefconSmartNotification, DefconOccurrenceModal, DefconLoadoutManager, DefconHub,
  DefconShareCarousel, CompetitionStatementUpload, DefconX1Live
- **Hooks satélites:** useDefconLoadout, useDefconPresence, useDefconQuickNotification,
  useDefconOnboarding, useX1DefconAlert, useMonthlyGoalRequired
- **Offline:** shared/lib/offline-db, offline-sync, utils/syncDailySales
- **Service worker:** public/sw.js (notificações de ação rápida + cache network-first)
- **Banco:** challenge_sessions, challenge_blocks(?), daily_sales, defcon_clients,
  work_sessions, pix_accounts

*(atualizado conforme a auditoria avança)*
