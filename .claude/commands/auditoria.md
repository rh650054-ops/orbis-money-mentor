---
description: Auditoria geral do VANT — 6 auditores em paralelo + um crítico, só leitura, relatório em pt-BR.
argument-hint: [área opcional: ranking | open-finance | financeiro | vendas-dia | seguranca | assinaturas]
---

Run the VANT audit. Nothing is changed: every auditor is read-only.

1. `git pull` to audit the latest code.
2. If an area was given ($ARGUMENTS), run only that auditor. Otherwise launch these six subagents IN PARALLEL (one message, six Task calls): auditor-ranking, auditor-open-finance, auditor-financeiro, auditor-vendas-dia, auditor-seguranca, auditor-assinaturas.
3. When all are back, give their findings to the auditor-critico subagent.
4. Write the final report in Brazilian Portuguese to `.claude/auditorias/AAAA-MM-DD.md` (git-ignored: the repo is public and the report names users) and show it here:
   - a table: # · problema · área · gravidade · usuários afetados · confirmado?
   - then each finding with prova, causa raiz and correção sugerida
   - at the end, "O que eu corrigiria primeiro" with the top 3
5. Do NOT fix anything. Ask which findings to fix; each fix follows CLAUDE.md (list what changes and what is removed, preflight, PR).
